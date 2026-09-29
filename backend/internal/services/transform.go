package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TransformOp struct {
	Type   string `json:"type"`
	Column string `json:"column,omitempty"`
	From   string `json:"from,omitempty"`
	To     string `json:"to,omitempty"`
	Op     string `json:"op,omitempty"`
	Value  string `json:"value,omitempty"`
}

// ApplyTransforms loads a dataset's rows, applies the operations in order,
// and rewrites the dataset atomically. Returns rows before/after counts.
//
// Because the rewrite is destructive, a restore point is captured in the same
// transaction before anything is deleted — so the change is always undoable.
func ApplyTransforms(ctx context.Context, db *pgxpool.Pool, datasetID uuid.UUID, ops []TransformOp,
	executionID *uuid.UUID, reason string) (before, after int, err error) {
	colRows, err := db.Query(ctx,
		`SELECT name, data_type FROM dataset_columns WHERE dataset_id = $1 ORDER BY position`, datasetID)
	if err != nil {
		return 0, 0, err
	}
	type column struct{ Name, DataType string }
	var columns []column
	for colRows.Next() {
		var c column
		if err := colRows.Scan(&c.Name, &c.DataType); err != nil {
			colRows.Close()
			return 0, 0, err
		}
		columns = append(columns, c)
	}
	colRows.Close()
	if len(columns) == 0 {
		return 0, 0, fmt.Errorf("dataset %s not found or has no columns", datasetID)
	}

	dataRows, err := db.Query(ctx,
		`SELECT data FROM dataset_rows WHERE dataset_id = $1 ORDER BY row_index`, datasetID)
	if err != nil {
		return 0, 0, err
	}
	var rows []map[string]any
	for dataRows.Next() {
		var data map[string]any
		if err := dataRows.Scan(&data); err != nil {
			dataRows.Close()
			return 0, 0, err
		}
		rows = append(rows, data)
	}
	dataRows.Close()
	before = len(rows)

	for _, op := range ops {
		switch op.Type {
		case "dedupe":
			rows = dedupeRows(rows)
		case "filter":
			rows = filterRows(rows, op)
		case "rename_column":
			for i, c := range columns {
				if c.Name == op.From {
					columns[i].Name = op.To
				}
			}
			for _, row := range rows {
				if v, ok := row[op.From]; ok {
					row[op.To] = v
					delete(row, op.From)
				}
			}
		case "drop_column":
			kept := columns[:0]
			for _, c := range columns {
				if c.Name != op.Column {
					kept = append(kept, c)
				}
			}
			columns = kept
			for _, row := range rows {
				delete(row, op.Column)
			}
		case "trim", "uppercase", "lowercase":
			for _, row := range rows {
				if s, ok := row[op.Column].(string); ok {
					switch op.Type {
					case "trim":
						row[op.Column] = strings.TrimSpace(s)
					case "uppercase":
						row[op.Column] = strings.ToUpper(s)
					case "lowercase":
						row[op.Column] = strings.ToLower(s)
					}
				}
			}
		case "fill_empty":
			for _, row := range rows {
				if row[op.Column] == nil || row[op.Column] == "" {
					row[op.Column] = op.Value
				}
			}
		default:
			return 0, 0, fmt.Errorf("unknown transform operation %q", op.Type)
		}
	}
	after = len(rows)

	tx, err := db.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	// Capture the pre-transform state before the delete below wipes it.
	if _, err := TakeSnapshot(ctx, tx, datasetID, executionID, reason); err != nil {
		return 0, 0, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM dataset_rows WHERE dataset_id = $1`, datasetID); err != nil {
		return 0, 0, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dataset_columns WHERE dataset_id = $1`, datasetID); err != nil {
		return 0, 0, err
	}
	for i, c := range columns {
		if _, err := tx.Exec(ctx,
			`INSERT INTO dataset_columns (dataset_id, name, position, data_type) VALUES ($1, $2, $3, $4)`,
			datasetID, c.Name, i, c.DataType); err != nil {
			return 0, 0, err
		}
	}
	copyRows := make([][]any, len(rows))
	for i, row := range rows {
		copyRows[i] = []any{datasetID, i, row}
	}
	if _, err := tx.CopyFrom(ctx, pgx.Identifier{"dataset_rows"},
		[]string{"dataset_id", "row_index", "data"}, pgx.CopyFromRows(copyRows)); err != nil {
		return 0, 0, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE datasets SET row_count = $2, updated_at = now() WHERE id = $1`,
		datasetID, len(rows)); err != nil {
		return 0, 0, err
	}
	return before, after, tx.Commit(ctx)
}

func dedupeRows(rows []map[string]any) []map[string]any {
	seen := make(map[string]struct{}, len(rows))
	out := rows[:0]
	for _, row := range rows {
		key, err := json.Marshal(row)
		if err != nil {
			out = append(out, row)
			continue
		}
		if _, dup := seen[string(key)]; dup {
			continue
		}
		seen[string(key)] = struct{}{}
		out = append(out, row)
	}
	return out
}

func filterRows(rows []map[string]any, op TransformOp) []map[string]any {
	out := rows[:0]
	for _, row := range rows {
		if matchesFilter(row[op.Column], op.Op, op.Value) {
			out = append(out, row)
		}
	}
	return out
}

func matchesFilter(cell any, op, value string) bool {
	cellStr := stringify(cell)
	switch op {
	case "equals":
		return strings.EqualFold(cellStr, value)
	case "not_equals":
		return !strings.EqualFold(cellStr, value)
	case "contains":
		return strings.Contains(strings.ToLower(cellStr), strings.ToLower(value))
	case "not_empty":
		return cellStr != ""
	case "is_empty":
		return cellStr == ""
	case "greater_than", "less_than":
		cellNum, err1 := toFloat(cell)
		valNum, err2 := strconv.ParseFloat(value, 64)
		if err1 != nil || err2 != nil {
			return false
		}
		if op == "greater_than" {
			return cellNum > valNum
		}
		return cellNum < valNum
	}
	return false
}

func toFloat(v any) (float64, error) {
	switch t := v.(type) {
	case float64:
		return t, nil
	case string:
		return strconv.ParseFloat(t, 64)
	case nil:
		return 0, fmt.Errorf("nil value")
	default:
		return 0, fmt.Errorf("not a number")
	}
}
