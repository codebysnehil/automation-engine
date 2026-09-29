package handlers

import (
	"net/http"
	"strconv"

	"automationhub/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (s *Server) ListExecutions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 200 {
		limit = 50
	}

	query := `SELECT e.id, e.workflow_id, w.name, e.trigger_source, e.status, e.error, e.started_at, e.finished_at
	          FROM executions e JOIN workflows w ON w.id = e.workflow_id`
	args := []any{}
	where := []string{}

	if !s.isAdmin(c) {
		args = append(args, s.userID(c))
		where = append(where, `w.owner_id = $`+strconv.Itoa(len(args)))
	}
	if wfParam := c.Query("workflowId"); wfParam != "" {
		wfID, err := uuid.Parse(wfParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflowId"})
			return
		}
		args = append(args, wfID)
		where = append(where, `e.workflow_id = $`+strconv.Itoa(len(args)))
	}
	for i, cond := range where {
		if i == 0 {
			query += ` WHERE ` + cond
		} else {
			query += ` AND ` + cond
		}
	}
	args = append(args, limit)
	query += ` ORDER BY e.started_at DESC LIMIT $` + strconv.Itoa(len(args))

	rows, err := s.DB.Query(c, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	executions := []models.Execution{}
	for rows.Next() {
		var e models.Execution
		if err := rows.Scan(&e.ID, &e.WorkflowID, &e.WorkflowName, &e.TriggerSource,
			&e.Status, &e.Error, &e.StartedAt, &e.FinishedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		executions = append(executions, e)
	}
	c.JSON(http.StatusOK, executions)
}

func (s *Server) GetExecution(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	var e models.Execution
	var ownerID uuid.UUID
	err := s.DB.QueryRow(c,
		`SELECT e.id, e.workflow_id, w.name, w.owner_id, e.trigger_source, e.status, e.error, e.started_at, e.finished_at
		 FROM executions e JOIN workflows w ON w.id = e.workflow_id WHERE e.id = $1`, id,
	).Scan(&e.ID, &e.WorkflowID, &e.WorkflowName, &ownerID, &e.TriggerSource,
		&e.Status, &e.Error, &e.StartedAt, &e.FinishedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "execution not found"})
		return
	}
	if !s.isAdmin(c) && ownerID != s.userID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have access to this execution"})
		return
	}

	rows, err := s.DB.Query(c,
		`SELECT id, step_position, level, message, created_at FROM execution_logs
		 WHERE execution_id = $1 ORDER BY id`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	logs := []models.ExecutionLog{}
	for rows.Next() {
		var l models.ExecutionLog
		if err := rows.Scan(&l.ID, &l.StepPosition, &l.Level, &l.Message, &l.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		logs = append(logs, l)
	}
	c.JSON(http.StatusOK, gin.H{"execution": e, "logs": logs, "datasets": s.executionDatasets(c, id)})
}

// ExecutionDataset is a dataset this run acted on, with the restore point the
// run created (when one still exists) so the change can be undone from here.
type ExecutionDataset struct {
	DatasetID   uuid.UUID  `json:"datasetId"`
	Name        string     `json:"name"`
	Action      string     `json:"action"`
	RowsBefore  *int       `json:"rowsBefore,omitempty"`
	RowsAfter   *int       `json:"rowsAfter,omitempty"`
	CurrentRows int        `json:"currentRows"`
	SnapshotID  *uuid.UUID `json:"snapshotId,omitempty"`
}

func (s *Server) executionDatasets(c *gin.Context, execID uuid.UUID) []ExecutionDataset {
	rows, err := s.DB.Query(c,
		`SELECT ed.dataset_id, d.name, ed.action, ed.rows_before, ed.rows_after, d.row_count,
		        (SELECT ds.id FROM dataset_snapshots ds
		          WHERE ds.execution_id = ed.execution_id AND ds.dataset_id = ed.dataset_id
		          ORDER BY ds.created_at DESC LIMIT 1)
		 FROM execution_datasets ed
		 JOIN datasets d ON d.id = ed.dataset_id
		 WHERE ed.execution_id = $1
		 ORDER BY ed.id`, execID)
	if err != nil {
		return []ExecutionDataset{}
	}
	defer rows.Close()

	out := []ExecutionDataset{}
	for rows.Next() {
		var ed ExecutionDataset
		if err := rows.Scan(&ed.DatasetID, &ed.Name, &ed.Action, &ed.RowsBefore,
			&ed.RowsAfter, &ed.CurrentRows, &ed.SnapshotID); err != nil {
			return out
		}
		out = append(out, ed)
	}
	return out
}
