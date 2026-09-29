package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Engine executes workflows: it records an execution, runs each step in
// order, streams logs to execution_logs, and notifies the owner on failure.
type Engine struct {
	db       *pgxpool.Pool
	notifier *Notifier
	exporter *Exporter
	client   *http.Client
}

func NewEngine(db *pgxpool.Pool, notifier *Notifier, exporter *Exporter) *Engine {
	return &Engine{
		db:       db,
		notifier: notifier,
		exporter: exporter,
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

type workflowRecord struct {
	ID      uuid.UUID
	OwnerID uuid.UUID
	Name    string
	Enabled bool
}

type stepRecord struct {
	Position   int
	Name       string
	ActionType string
	Config     map[string]any
}

// Trigger starts a workflow run asynchronously and returns the execution ID.
func (e *Engine) Trigger(ctx context.Context, workflowID uuid.UUID, source string, payload map[string]any) (uuid.UUID, error) {
	var wf workflowRecord
	err := e.db.QueryRow(ctx,
		`SELECT id, owner_id, name, enabled FROM workflows WHERE id = $1`, workflowID,
	).Scan(&wf.ID, &wf.OwnerID, &wf.Name, &wf.Enabled)
	if err != nil {
		return uuid.Nil, fmt.Errorf("workflow not found: %w", err)
	}
	if !wf.Enabled {
		return uuid.Nil, fmt.Errorf("workflow %q is disabled", wf.Name)
	}

	var execID uuid.UUID
	err = e.db.QueryRow(ctx,
		`INSERT INTO executions (workflow_id, trigger_source) VALUES ($1, $2) RETURNING id`,
		workflowID, source,
	).Scan(&execID)
	if err != nil {
		return uuid.Nil, err
	}

	go e.run(execID, wf, payload)
	return execID, nil
}

func (e *Engine) run(execID uuid.UUID, wf workflowRecord, payload map[string]any) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	steps, err := e.loadSteps(ctx, wf.ID)
	if err != nil {
		e.finish(ctx, execID, wf, "failed", fmt.Sprintf("could not load steps: %v", err))
		return
	}

	e.log(ctx, execID, nil, "info", fmt.Sprintf("execution started with %d step(s)", len(steps)))

	// runCtx is shared state across steps: trigger payload plus values steps
	// set for later steps (e.g. datasetId, last HTTP response).
	runCtx := map[string]any{}
	if payload != nil {
		runCtx["payload"] = payload
		if id, ok := payload["datasetId"].(string); ok {
			runCtx["datasetId"] = id
		}
	}

	for _, step := range steps {
		pos := step.Position
		label := step.Name
		if label == "" {
			label = step.ActionType
		}
		e.log(ctx, execID, &pos, "info", fmt.Sprintf("step %d (%s) started", pos+1, label))
		if err := e.runStep(ctx, execID, wf, step, runCtx); err != nil {
			e.log(ctx, execID, &pos, "error", fmt.Sprintf("step %d (%s) failed: %v", pos+1, label, err))
			e.finish(ctx, execID, wf, "failed", err.Error())
			return
		}
		e.log(ctx, execID, &pos, "info", fmt.Sprintf("step %d (%s) completed", pos+1, label))
	}

	e.finish(ctx, execID, wf, "success", "")
}

func (e *Engine) runStep(ctx context.Context, execID uuid.UUID, wf workflowRecord, step stepRecord, runCtx map[string]any) error {
	switch step.ActionType {
	case "transform":
		return e.actionTransform(ctx, execID, step, runCtx)
	case "http_request":
		return e.actionHTTPRequest(ctx, execID, step, runCtx)
	case "notify":
		return e.actionNotify(ctx, wf, step)
	case "export":
		return e.actionExport(ctx, execID, step, runCtx)
	case "delay":
		seconds := configFloat(step.Config, "seconds", 1)
		if seconds > 300 {
			seconds = 300
		}
		select {
		case <-time.After(time.Duration(seconds * float64(time.Second))):
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	default:
		return fmt.Errorf("unknown action type %q", step.ActionType)
	}
}

func (e *Engine) actionTransform(ctx context.Context, execID uuid.UUID, step stepRecord, runCtx map[string]any) error {
	datasetID, err := resolveDatasetID(step.Config, runCtx)
	if err != nil {
		return err
	}
	rawOps, _ := json.Marshal(step.Config["operations"])
	var ops []TransformOp
	if err := json.Unmarshal(rawOps, &ops); err != nil || len(ops) == 0 {
		return fmt.Errorf("transform step has no valid operations")
	}
	stepLabel := step.Name
	if stepLabel == "" {
		stepLabel = fmt.Sprintf("step %d", step.Position+1)
	}
	before, after, err := ApplyTransforms(ctx, e.db, datasetID, ops, &execID, stepLabel)
	if err != nil {
		return err
	}
	e.recordDatasetTouch(ctx, execID, datasetID, "transform", &before, &after)
	pos := step.Position
	e.log(ctx, execID, &pos, "info",
		fmt.Sprintf("transformed dataset %s: %d rows -> %d rows (%d operation(s))", datasetID, before, after, len(ops)))
	return nil
}

// recordDatasetTouch notes that this run acted on a dataset, so the execution
// screen can link straight to the result instead of leaving a bare UUID in a log.
func (e *Engine) recordDatasetTouch(ctx context.Context, execID, datasetID uuid.UUID, action string, before, after *int) {
	if _, err := e.db.Exec(ctx,
		`INSERT INTO execution_datasets (execution_id, dataset_id, action, rows_before, rows_after)
		 VALUES ($1, $2, $3, $4, $5)`,
		execID, datasetID, action, before, after); err != nil {
		log.Printf("could not record dataset touch for execution %s: %v", execID, err)
	}
}

func (e *Engine) actionHTTPRequest(ctx context.Context, execID uuid.UUID, step stepRecord, runCtx map[string]any) error {
	url := configString(step.Config, "url", "")
	if url == "" {
		return fmt.Errorf("http_request step is missing a URL")
	}
	method := configString(step.Config, "method", "GET")
	body := configString(step.Config, "body", "")

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader([]byte(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if headers, ok := step.Config["headers"].(map[string]any); ok {
		for k, v := range headers {
			req.Header.Set(k, fmt.Sprintf("%v", v))
		}
	}

	resp, err := e.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))

	runCtx["lastHttpStatus"] = resp.StatusCode
	runCtx["lastHttpBody"] = string(respBody)

	pos := step.Position
	e.log(ctx, execID, &pos, "info", fmt.Sprintf("%s %s -> %d (%d bytes)", method, url, resp.StatusCode, len(respBody)))
	if resp.StatusCode >= 400 {
		return fmt.Errorf("%s %s returned status %d", method, url, resp.StatusCode)
	}
	return nil
}

func (e *Engine) actionNotify(ctx context.Context, wf workflowRecord, step stepRecord) error {
	title := configString(step.Config, "title", fmt.Sprintf("Workflow %q notification", wf.Name))
	message := configString(step.Config, "message", "")
	return e.notifier.Notify(ctx, wf.OwnerID, title, message, "workflow")
}

func (e *Engine) actionExport(ctx context.Context, execID uuid.UUID, step stepRecord, runCtx map[string]any) error {
	datasetID, err := resolveDatasetID(step.Config, runCtx)
	if err != nil {
		return err
	}
	format := configString(step.Config, "format", "xlsx")
	path, name, err := e.exporter.Export(ctx, datasetID, format)
	if err != nil {
		return err
	}
	runCtx["lastExportPath"] = path
	e.recordDatasetTouch(ctx, execID, datasetID, "export", nil, nil)
	pos := step.Position
	e.log(ctx, execID, &pos, "info", fmt.Sprintf("exported dataset %s to %s", datasetID, name))
	return nil
}

func (e *Engine) loadSteps(ctx context.Context, workflowID uuid.UUID) ([]stepRecord, error) {
	rows, err := e.db.Query(ctx,
		`SELECT position, name, action_type, config FROM workflow_steps
		 WHERE workflow_id = $1 ORDER BY position`, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var steps []stepRecord
	for rows.Next() {
		var s stepRecord
		if err := rows.Scan(&s.Position, &s.Name, &s.ActionType, &s.Config); err != nil {
			return nil, err
		}
		steps = append(steps, s)
	}
	return steps, rows.Err()
}

func (e *Engine) finish(ctx context.Context, execID uuid.UUID, wf workflowRecord, status, errMsg string) {
	_, err := e.db.Exec(ctx,
		`UPDATE executions SET status = $2, error = $3, finished_at = now() WHERE id = $1`,
		execID, status, errMsg)
	if err != nil {
		log.Printf("could not finalize execution %s: %v", execID, err)
	}
	e.log(ctx, execID, nil, "info", fmt.Sprintf("execution finished with status %q", status))
	if status == "failed" {
		e.notifier.Notify(ctx, wf.OwnerID,
			fmt.Sprintf("Workflow %q failed", wf.Name), errMsg, "error")
	}
}

func (e *Engine) log(ctx context.Context, execID uuid.UUID, stepPos *int, level, message string) {
	_, err := e.db.Exec(ctx,
		`INSERT INTO execution_logs (execution_id, step_position, level, message) VALUES ($1, $2, $3, $4)`,
		execID, stepPos, level, message)
	if err != nil {
		log.Printf("could not write execution log: %v", err)
	}
}

func resolveDatasetID(config, runCtx map[string]any) (uuid.UUID, error) {
	raw := configString(config, "datasetId", "")
	if raw == "" {
		if v, ok := runCtx["datasetId"].(string); ok {
			raw = v
		}
	}
	if raw == "" {
		return uuid.Nil, fmt.Errorf("no dataset specified: set datasetId in the step config or trigger payload")
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid dataset id %q", raw)
	}
	return id, nil
}

func configString(config map[string]any, key, def string) string {
	if v, ok := config[key].(string); ok && v != "" {
		return v
	}
	return def
}

func configFloat(config map[string]any, key string, def float64) float64 {
	if v, ok := config[key].(float64); ok {
		return v
	}
	return def
}
