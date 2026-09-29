package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"automationhub/internal/models"
	"automationhub/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// UploadDataset accepts a multipart Excel/CSV file, parses it into a
// structured dataset, and fires any dataset_upload-triggered workflows.
func (s *Server) UploadDataset(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a file is required (field name: file)"})
		return
	}
	if fileHeader.Size > 50<<20 {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file exceeds the 50 MB limit"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read uploaded file"})
		return
	}
	defer file.Close()

	sheet, err := services.ParseTabular(file, fileHeader.Filename)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		name = strings.TrimSuffix(fileHeader.Filename, "."+lastExt(fileHeader.Filename))
	}

	ownerID := s.userID(c)
	tx, err := s.DB.Begin(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer tx.Rollback(c)

	var ds models.Dataset
	err = tx.QueryRow(c,
		`INSERT INTO datasets (owner_id, name, original_filename, sheet_name, row_count)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, owner_id, name, original_filename, sheet_name, row_count, status, created_at, updated_at`,
		ownerID, name, fileHeader.Filename, sheet.SheetName, len(sheet.Rows),
	).Scan(&ds.ID, &ds.OwnerID, &ds.Name, &ds.OriginalFilename, &ds.SheetName, &ds.RowCount, &ds.Status, &ds.CreatedAt, &ds.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create dataset"})
		return
	}

	for i, col := range sheet.Columns {
		if _, err := tx.Exec(c,
			`INSERT INTO dataset_columns (dataset_id, name, position, data_type) VALUES ($1, $2, $3, $4)`,
			ds.ID, col.Name, i, col.DataType); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not store columns"})
			return
		}
	}

	copyRows := make([][]any, len(sheet.Rows))
	for i, row := range sheet.Rows {
		copyRows[i] = []any{ds.ID, i, row}
	}
	if _, err := tx.CopyFrom(c, pgx.Identifier{"dataset_rows"},
		[]string{"dataset_id", "row_index", "data"}, pgx.CopyFromRows(copyRows)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not store rows"})
		return
	}

	if err := tx.Commit(c); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	go s.fireUploadWorkflows(ownerID, ds.ID)
	c.JSON(http.StatusCreated, ds)
}

// fireUploadWorkflows triggers the owner's enabled workflows that listen for
// dataset uploads, passing the new dataset's id in the payload.
func (s *Server) fireUploadWorkflows(ownerID, datasetID uuid.UUID) {
	ctx := context.Background()
	rows, err := s.DB.Query(ctx,
		`SELECT id FROM workflows WHERE owner_id = $1 AND trigger_type = 'dataset_upload' AND enabled = true`,
		ownerID)
	if err != nil {
		log.Printf("could not query upload-triggered workflows: %v", err)
		return
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	for _, id := range ids {
		if _, err := s.Engine.Trigger(ctx, id, "dataset_upload",
			map[string]any{"datasetId": datasetID.String()}); err != nil {
			log.Printf("upload trigger for workflow %s failed: %v", id, err)
		}
	}
}

func (s *Server) ListDatasets(c *gin.Context) {
	query := `SELECT id, owner_id, name, original_filename, sheet_name, row_count, status, created_at, updated_at
	          FROM datasets`
	args := []any{}
	if !s.isAdmin(c) {
		query += ` WHERE owner_id = $1`
		args = append(args, s.userID(c))
	}
	query += ` ORDER BY created_at DESC`

	rows, err := s.DB.Query(c, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	datasets := []models.Dataset{}
	for rows.Next() {
		var ds models.Dataset
		if err := rows.Scan(&ds.ID, &ds.OwnerID, &ds.Name, &ds.OriginalFilename, &ds.SheetName,
			&ds.RowCount, &ds.Status, &ds.CreatedAt, &ds.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		datasets = append(datasets, ds)
	}
	c.JSON(http.StatusOK, datasets)
}

func (s *Server) GetDataset(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	ds, ok := s.loadOwnedDataset(c, id)
	if !ok {
		return
	}

	cols, err := s.loadColumns(c, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"dataset": ds, "columns": cols})
}

// GetDatasetRows returns a page of rows with optional search and sorting.
func (s *Server) GetDatasetRows(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if _, ok := s.loadOwnedDataset(c, id); !ok {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "25"))
	if pageSize < 1 || pageSize > 200 {
		pageSize = 25
	}
	search := strings.TrimSpace(c.Query("search"))
	sortCol := c.Query("sort")
	order := "ASC"
	if strings.EqualFold(c.Query("order"), "desc") {
		order = "DESC"
	}

	cols, err := s.loadColumns(c, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	where := `dataset_id = $1`
	args := []any{id}
	if search != "" {
		args = append(args, "%"+search+"%")
		where += fmt.Sprintf(` AND data::text ILIKE $%d`, len(args))
	}

	var total int
	if err := s.DB.QueryRow(c,
		`SELECT count(*) FROM dataset_rows WHERE `+where, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// Sorting: only allow real column names (prevents SQL injection), and
	// cast to numeric for number columns so 9 sorts before 10.
	orderBy := `row_index ASC`
	for _, col := range cols {
		if col.Name == sortCol {
			escaped := strings.ReplaceAll(col.Name, "'", "''")
			if col.DataType == "number" {
				orderBy = fmt.Sprintf(`(data->>'%s')::numeric %s NULLS LAST`, escaped, order)
			} else {
				orderBy = fmt.Sprintf(`data->>'%s' %s NULLS LAST`, escaped, order)
			}
			break
		}
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(
		`SELECT row_index, data FROM dataset_rows WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d`,
		where, orderBy, len(args)-1, len(args))

	rows, err := s.DB.Query(c, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	type rowOut struct {
		RowIndex int            `json:"rowIndex"`
		Data     map[string]any `json:"data"`
	}
	out := []rowOut{}
	for rows.Next() {
		var r rowOut
		if err := rows.Scan(&r.RowIndex, &r.Data); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		out = append(out, r)
	}

	c.JSON(http.StatusOK, gin.H{
		"rows":     out,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"columns":  cols,
	})
}

func (s *Server) DeleteDataset(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if _, ok := s.loadOwnedDataset(c, id); !ok {
		return
	}
	if _, err := s.DB.Exec(c, `DELETE FROM datasets WHERE id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ListDatasetSnapshots returns the dataset's restore points, newest first.
func (s *Server) ListDatasetSnapshots(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if _, ok := s.loadOwnedDataset(c, id); !ok {
		return
	}
	snaps, err := services.ListSnapshots(c, s.DB, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	c.JSON(http.StatusOK, snaps)
}

// RestoreDatasetSnapshot rolls the dataset back to a restore point.
func (s *Server) RestoreDatasetSnapshot(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	snapshotID, ok := parseIDParam(c, "snapshotId")
	if !ok {
		return
	}
	if _, ok := s.loadOwnedDataset(c, id); !ok {
		return
	}
	restored, err := services.RestoreSnapshot(c, s.DB, id, snapshotID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"restored": true, "rowCount": restored})
}

func (s *Server) ExportDataset(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if _, ok := s.loadOwnedDataset(c, id); !ok {
		return
	}
	format := c.DefaultQuery("format", "xlsx")
	path, name, err := s.Exporter.Export(c, id, format)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer os.Remove(path)
	c.FileAttachment(path, name)
}

func (s *Server) loadOwnedDataset(c *gin.Context, id uuid.UUID) (*models.Dataset, bool) {
	var ds models.Dataset
	err := s.DB.QueryRow(c,
		`SELECT id, owner_id, name, original_filename, sheet_name, row_count, status, created_at, updated_at
		 FROM datasets WHERE id = $1`, id,
	).Scan(&ds.ID, &ds.OwnerID, &ds.Name, &ds.OriginalFilename, &ds.SheetName,
		&ds.RowCount, &ds.Status, &ds.CreatedAt, &ds.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dataset not found"})
		return nil, false
	}
	if !s.isAdmin(c) && ds.OwnerID != s.userID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have access to this dataset"})
		return nil, false
	}
	return &ds, true
}

func (s *Server) loadColumns(c *gin.Context, datasetID uuid.UUID) ([]models.DatasetColumn, error) {
	rows, err := s.DB.Query(c,
		`SELECT id, name, position, data_type FROM dataset_columns WHERE dataset_id = $1 ORDER BY position`,
		datasetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cols := []models.DatasetColumn{}
	for rows.Next() {
		var col models.DatasetColumn
		if err := rows.Scan(&col.ID, &col.Name, &col.Position, &col.DataType); err != nil {
			return nil, err
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

func lastExt(filename string) string {
	parts := strings.Split(filename, ".")
	return parts[len(parts)-1]
}
