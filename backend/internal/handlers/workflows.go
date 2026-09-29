package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"automationhub/internal/models"
	"automationhub/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var validTriggerTypes = map[string]bool{
	"manual": true, "schedule": true, "webhook": true, "dataset_upload": true,
}

var validActionTypes = map[string]bool{
	"transform": true, "http_request": true, "notify": true, "export": true, "delay": true,
}

type workflowRequest struct {
	Name          string         `json:"name" binding:"required,min=2"`
	Description   string         `json:"description"`
	Enabled       *bool          `json:"enabled"`
	TriggerType   string         `json:"triggerType" binding:"required"`
	TriggerConfig map[string]any `json:"triggerConfig"`
	Steps         []struct {
		Name       string         `json:"name"`
		ActionType string         `json:"actionType" binding:"required"`
		Config     map[string]any `json:"config"`
	} `json:"steps" binding:"required,min=1"`
}

func (r *workflowRequest) validate() string {
	if !validTriggerTypes[r.TriggerType] {
		return "triggerType must be one of: manual, schedule, webhook, dataset_upload"
	}
	if r.TriggerType == "schedule" {
		spec, _ := r.TriggerConfig["cron"].(string)
		if strings.TrimSpace(spec) == "" {
			return "schedule trigger requires a cron expression in triggerConfig.cron"
		}
		if err := services.ValidateSpec(spec); err != nil {
			return "invalid cron expression: " + err.Error()
		}
	}
	for i, step := range r.Steps {
		if !validActionTypes[step.ActionType] {
			return "step " + string(rune('1'+i)) + " has an unknown actionType; must be one of: transform, http_request, notify, export, delay"
		}
	}
	return ""
}

func (s *Server) CreateWorkflow(c *gin.Context) {
	var req workflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, triggerType and at least one step are required"})
		return
	}
	if msg := req.validate(); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	if req.TriggerConfig == nil {
		req.TriggerConfig = map[string]any{}
	}

	var webhookToken *string
	if req.TriggerType == "webhook" {
		token := randomToken()
		webhookToken = &token
	}

	tx, err := s.DB.Begin(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer tx.Rollback(c)

	var id uuid.UUID
	err = tx.QueryRow(c,
		`INSERT INTO workflows (owner_id, name, description, enabled, trigger_type, trigger_config, webhook_token)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		s.userID(c), req.Name, req.Description, enabled, req.TriggerType, req.TriggerConfig, webhookToken,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create workflow"})
		return
	}

	for i, step := range req.Steps {
		config := step.Config
		if config == nil {
			config = map[string]any{}
		}
		if _, err := tx.Exec(c,
			`INSERT INTO workflow_steps (workflow_id, position, name, action_type, config) VALUES ($1, $2, $3, $4, $5)`,
			id, i, step.Name, step.ActionType, config); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create workflow steps"})
			return
		}
	}
	if err := tx.Commit(c); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	s.Scheduler.Sync(c, id)
	wf, _ := s.loadWorkflow(c, id)
	c.JSON(http.StatusCreated, wf)
}

func (s *Server) UpdateWorkflow(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	existing, ok := s.loadOwnedWorkflow(c, id)
	if !ok {
		return
	}

	var req workflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, triggerType and at least one step are required"})
		return
	}
	if msg := req.validate(); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	enabled := existing.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	if req.TriggerConfig == nil {
		req.TriggerConfig = map[string]any{}
	}

	webhookToken := existing.WebhookToken
	if req.TriggerType == "webhook" && webhookToken == nil {
		token := randomToken()
		webhookToken = &token
	}
	if req.TriggerType != "webhook" {
		webhookToken = nil
	}

	tx, err := s.DB.Begin(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer tx.Rollback(c)

	if _, err := tx.Exec(c,
		`UPDATE workflows SET name = $2, description = $3, enabled = $4, trigger_type = $5,
		 trigger_config = $6, webhook_token = $7, updated_at = now() WHERE id = $1`,
		id, req.Name, req.Description, enabled, req.TriggerType, req.TriggerConfig, webhookToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update workflow"})
		return
	}
	if _, err := tx.Exec(c, `DELETE FROM workflow_steps WHERE workflow_id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	for i, step := range req.Steps {
		config := step.Config
		if config == nil {
			config = map[string]any{}
		}
		if _, err := tx.Exec(c,
			`INSERT INTO workflow_steps (workflow_id, position, name, action_type, config) VALUES ($1, $2, $3, $4, $5)`,
			id, i, step.Name, step.ActionType, config); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update workflow steps"})
			return
		}
	}
	if err := tx.Commit(c); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	s.Scheduler.Sync(c, id)
	wf, _ := s.loadWorkflow(c, id)
	c.JSON(http.StatusOK, wf)
}

func (s *Server) ListWorkflows(c *gin.Context) {
	query := `SELECT id FROM workflows`
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
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		ids = append(ids, id)
	}
	rows.Close()

	workflows := []models.Workflow{}
	for _, id := range ids {
		wf, err := s.loadWorkflow(c, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		workflows = append(workflows, *wf)
	}
	c.JSON(http.StatusOK, workflows)
}

func (s *Server) GetWorkflow(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	wf, ok := s.loadOwnedWorkflow(c, id)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, wf)
}

func (s *Server) DeleteWorkflow(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if _, ok := s.loadOwnedWorkflow(c, id); !ok {
		return
	}
	if _, err := s.DB.Exec(c, `DELETE FROM workflows WHERE id = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	s.Scheduler.Remove(id)
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// RunWorkflow triggers a manual execution, optionally with a JSON payload.
func (s *Server) RunWorkflow(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if _, ok := s.loadOwnedWorkflow(c, id); !ok {
		return
	}
	var payload map[string]any
	c.ShouldBindJSON(&payload) // optional body

	execID, err := s.Engine.Trigger(c, id, "manual", payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"executionId": execID})
}

func (s *Server) loadOwnedWorkflow(c *gin.Context, id uuid.UUID) (*models.Workflow, bool) {
	wf, err := s.loadWorkflow(c, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workflow not found"})
		return nil, false
	}
	if !s.isAdmin(c) && wf.OwnerID != s.userID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have access to this workflow"})
		return nil, false
	}
	return wf, true
}

func (s *Server) loadWorkflow(c *gin.Context, id uuid.UUID) (*models.Workflow, error) {
	var wf models.Workflow
	err := s.DB.QueryRow(c,
		`SELECT id, owner_id, name, description, enabled, trigger_type, trigger_config, webhook_token, created_at, updated_at
		 FROM workflows WHERE id = $1`, id,
	).Scan(&wf.ID, &wf.OwnerID, &wf.Name, &wf.Description, &wf.Enabled,
		&wf.TriggerType, &wf.TriggerConfig, &wf.WebhookToken, &wf.CreatedAt, &wf.UpdatedAt)
	if err != nil {
		return nil, err
	}

	rows, err := s.DB.Query(c,
		`SELECT id, position, name, action_type, config FROM workflow_steps
		 WHERE workflow_id = $1 ORDER BY position`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	wf.Steps = []models.WorkflowStep{}
	for rows.Next() {
		var step models.WorkflowStep
		if err := rows.Scan(&step.ID, &step.Position, &step.Name, &step.ActionType, &step.Config); err != nil {
			return nil, err
		}
		wf.Steps = append(wf.Steps, step)
	}
	return &wf, rows.Err()
}

func randomToken() string {
	b := make([]byte, 24)
	rand.Read(b)
	return hex.EncodeToString(b)
}
