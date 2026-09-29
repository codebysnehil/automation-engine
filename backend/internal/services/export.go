package services

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
)

type Exporter struct {
	db        *pgxpool.Pool
	exportDir string
}

func NewExporter(db *pgxpool.Pool, exportDir string) *Exporter {
	os.MkdirAll(exportDir, 0o755)
	return &Exporter{db: db, exportDir: exportDir}
}

// Export writes a dataset to disk as xlsx, csv, or json and returns the
// file path and download name.
func (e *Exporter) Export(ctx context.Context, datasetID uuid.UUID, format string) (path, name string, err error) {
	var dsName string
	if err = e.db.QueryRow(ctx, `SELECT name FROM datasets WHERE id = $1`, datasetID).Scan(&dsName); err != nil {
		return "", "", fmt.Errorf("dataset not found: %w", err)
	}

	columns, rows, err := e.loadData(ctx, datasetID)
	if err != nil {
		return "", "", err
	}

	stamp := time.Now().Format("20060102-150405")
	base := fmt.Sprintf("%s-%s", sanitizeFilename(dsName), stamp)

	switch format {
	case "csv":
		name = base + ".csv"
		path = filepath.Join(e.exportDir, name)
		err = writeCSV(path, columns, rows)
	case "json":
		name = base + ".json"
		path = filepath.Join(e.exportDir, name)
		err = writeJSON(path, rows)
	default:
		name = base + ".xlsx"
		path = filepath.Join(e.exportDir, name)
		err = writeXLSX(path, columns, rows)
	}
	if err != nil {
		return "", "", err
	}
	return path, name, nil
}

func (e *Exporter) loadData(ctx context.Context, datasetID uuid.UUID) ([]string, []map[string]any, error) {
	colRows, err := e.db.Query(ctx,
		`SELECT name FROM dataset_columns WHERE dataset_id = $1 ORDER BY position`, datasetID)
	if err != nil {
		return nil, nil, err
	}
	defer colRows.Close()
	var columns []string
	for colRows.Next() {
		var name string
		if err := colRows.Scan(&name); err != nil {
			return nil, nil, err
		}
		columns = append(columns, name)
	}

	dataRows, err := e.db.Query(ctx,
		`SELECT data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index`, datasetID)
	if err != nil {
		return nil, nil, err
	}
	defer dataRows.Close()
	var rows []map[string]any
	for dataRows.Next() {
		var data map[string]any
		if err := dataRows.Scan(&data); err != nil {
			return nil, nil, err
		}
		rows = append(rows, data)
	}
	return columns, rows, nil
}

func writeXLSX(path string, columns []string, rows []map[string]any) error {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Data"
	f.SetSheetName("Sheet1", sheet)

	header := make([]any, len(columns))
	for i, c := range columns {
		header[i] = c
	}
	if err := f.SetSheetRow(sheet, "A1", &header); err != nil {
		return err
	}
	for i, row := range rows {
		values := make([]any, len(columns))
		for j, c := range columns {
			values[j] = row[c]
		}
		cell, _ := excelize.CoordinatesToCellName(1, i+2)
		if err := f.SetSheetRow(sheet, cell, &values); err != nil {
			return err
		}
	}
	return f.SaveAs(path)
}

func writeCSV(path string, columns []string, rows []map[string]any) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	defer w.Flush()
	if err := w.Write(columns); err != nil {
		return err
	}
	for _, row := range rows {
		record := make([]string, len(columns))
		for i, c := range columns {
			record[i] = stringify(row[c])
		}
		if err := w.Write(record); err != nil {
			return err
		}
	}
	return nil
}

func writeJSON(path string, rows []map[string]any) error {
	data, err := json.MarshalIndent(rows, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func stringify(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return fmt.Sprintf("%v", t)
	default:
		return fmt.Sprintf("%v", t)
	}
}

func sanitizeFilename(name string) string {
	out := make([]rune, 0, len(name))
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			out = append(out, r)
		case r == ' ':
			out = append(out, '-')
		}
	}
	if len(out) == 0 {
		return "dataset"
	}
	return string(out)
}
