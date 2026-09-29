package handlers

import (
	"net/http"

	"automationhub/internal/models"

	"github.com/gin-gonic/gin"
)

// DashboardStats aggregates counts and recent activity for the home screen.
func (s *Server) DashboardStats(c *gin.Context) {
	userID := s.userID(c)
	admin := s.isAdmin(c)

	scope := func(ownerCol string) (string, []any) {
		if admin {
			return "", nil
		}
		return " WHERE " + ownerCol + " = $1", []any{userID}
	}

	var datasets, totalRows, workflows, executions, succeeded, failed int

	where, args := scope("owner_id")
	s.DB.QueryRow(c, `SELECT count(*), COALESCE(sum(row_count), 0) FROM datasets`+where, args...).Scan(&datasets, &totalRows)
	s.DB.QueryRow(c, `SELECT count(*) FROM workflows`+where, args...).Scan(&workflows)

	execWhere := ""
	execArgs := []any{}
	if !admin {
		execWhere = ` WHERE w.owner_id = $1`
		execArgs = []any{userID}
	}
	base := `FROM executions e JOIN workflows w ON w.id = e.workflow_id` + execWhere
	s.DB.QueryRow(c, `SELECT count(*) `+base, execArgs...).Scan(&executions)
	s.DB.QueryRow(c, `SELECT count(*) `+base+cond(execWhere)+`e.status = 'success'`, execArgs...).Scan(&succeeded)
	s.DB.QueryRow(c, `SELECT count(*) `+base+cond(execWhere)+`e.status = 'failed'`, execArgs...).Scan(&failed)

	recentQuery := `SELECT e.id, e.workflow_id, w.name, e.trigger_source, e.status, e.error, e.started_at, e.finished_at ` +
		base + ` ORDER BY e.started_at DESC LIMIT 6`
	rows, err := s.DB.Query(c, recentQuery, execArgs...)
	recent := []models.Execution{}
	if err == nil {
		for rows.Next() {
			var e models.Execution
			if rows.Scan(&e.ID, &e.WorkflowID, &e.WorkflowName, &e.TriggerSource,
				&e.Status, &e.Error, &e.StartedAt, &e.FinishedAt) == nil {
				recent = append(recent, e)
			}
		}
		rows.Close()
	}

	var activeWorkflows int
	s.DB.QueryRow(c, `SELECT count(*) FROM workflows`+where+cond(where)+`enabled`, args...).Scan(&activeWorkflows)

	// Average wall-clock duration of finished runs, in milliseconds.
	var avgDurationMs float64
	s.DB.QueryRow(c, `SELECT COALESCE(avg(EXTRACT(EPOCH FROM (e.finished_at - e.started_at)) * 1000), 0) `+
		base+cond(execWhere)+`e.finished_at IS NOT NULL`, execArgs...).Scan(&avgDurationMs)

	// Runs in the last 7 days vs the 7 before that — drives the trend delta.
	var runsLast7, runsPrev7 int
	s.DB.QueryRow(c, `SELECT count(*) `+base+cond(execWhere)+`e.started_at >= now() - interval '7 days'`,
		execArgs...).Scan(&runsLast7)
	s.DB.QueryRow(c, `SELECT count(*) `+base+cond(execWhere)+
		`e.started_at >= now() - interval '14 days' AND e.started_at < now() - interval '7 days'`,
		execArgs...).Scan(&runsPrev7)

	activity := s.executionActivity(c, execWhere, execArgs)

	dsQuery := `SELECT id, owner_id, name, original_filename, sheet_name, row_count, status, created_at, updated_at FROM datasets` +
		where + ` ORDER BY created_at DESC LIMIT 5`
	dsRows, err := s.DB.Query(c, dsQuery, args...)
	recentDatasets := []models.Dataset{}
	if err == nil {
		for dsRows.Next() {
			var d models.Dataset
			if dsRows.Scan(&d.ID, &d.OwnerID, &d.Name, &d.OriginalFilename, &d.SheetName,
				&d.RowCount, &d.Status, &d.CreatedAt, &d.UpdatedAt) == nil {
				recentDatasets = append(recentDatasets, d)
			}
		}
		dsRows.Close()
	}

	c.JSON(http.StatusOK, gin.H{
		"datasets":         datasets,
		"totalRows":        totalRows,
		"workflows":        workflows,
		"activeWorkflows":  activeWorkflows,
		"executions":       executions,
		"succeeded":        succeeded,
		"failed":           failed,
		"avgDurationMs":    int64(avgDurationMs),
		"runsLast7":        runsLast7,
		"runsPrev7":        runsPrev7,
		"activity":         activity,
		"recentExecutions": recent,
		"recentDatasets":   recentDatasets,
	})
}

// ActivityDay is one day of the 14-day execution history shown on the dashboard.
type ActivityDay struct {
	Date    string `json:"date"`
	Success int    `json:"success"`
	Failed  int    `json:"failed"`
}

// executionActivity returns success/failed run counts per day for the last 14 days,
// including days with no runs so the chart keeps an even time axis.
func (s *Server) executionActivity(c *gin.Context, execWhere string, execArgs []any) []ActivityDay {
	query := `
		WITH scoped AS (
			SELECT e.status, e.started_at
			FROM executions e JOIN workflows w ON w.id = e.workflow_id` + execWhere + `
		)
		SELECT to_char(d, 'YYYY-MM-DD'),
		       count(*) FILTER (WHERE s.status = 'success'),
		       count(*) FILTER (WHERE s.status = 'failed')
		FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d
		LEFT JOIN scoped s ON s.started_at >= d AND s.started_at < d + interval '1 day'
		GROUP BY d ORDER BY d`

	days := []ActivityDay{}
	rows, err := s.DB.Query(c, query, execArgs...)
	if err != nil {
		return days
	}
	defer rows.Close()
	for rows.Next() {
		var a ActivityDay
		if rows.Scan(&a.Date, &a.Success, &a.Failed) == nil {
			days = append(days, a)
		}
	}
	return days
}

func cond(existingWhere string) string {
	if existingWhere == "" {
		return ` WHERE `
	}
	return ` AND `
}
