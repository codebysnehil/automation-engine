package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// snapshotsKept is how many restore points we hold per dataset. Rows are
// duplicated on disk, so this is a deliberate storage-vs-safety trade.
const snapshotsKept = 3

// Snapshot is a restore point for a dataset.
type Snapshot struct {
	ID          uuid.UUID  `json:"id"`
	DatasetID   uuid.UUID  `json:"datasetId"`
	ExecutionID *uuid.UUID `json:"executionId,omitempty"`
	Reason      string     `json:"reason"`
	RowCount    int        `json:"rowCount"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// TakeSnapshot copies a dataset's current columns and rows into a restore
// point. The copy runs entirely inside Postgres, so even a 50k-row dataset
// costs one statement rather than a round trip per row.
func TakeSnapshot(ctx context.Context, tx pgx.Tx, datasetID uuid.UUID, executionID *uuid.UUID, reason string) (uuid.UUID, error) {
	var rowCount int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM dataset_rows WHERE dataset_id = $1`, datasetID).Scan(&rowCount); err != nil {
		return uuid.Nil, fmt.Errorf("count rows for snapshot: %w", err)
	}

	var snapshotID uuid.UUID
	if err := tx.QueryRow(ctx,
		`INSERT INTO dataset_snapshots (dataset_id, execution_id, reason, row_count)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		datasetID, executionID, reason, rowCount).Scan(&snapshotID); err != nil {
		return uuid.Nil, fmt.Errorf("create snapshot: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO dataset_snapshot_columns (snapshot_id, name, position, data_type)
		 SELECT $1, name, position, data_type FROM dataset_columns WHERE dataset_id = $2`,
		snapshotID, datasetID); err != nil {
		return uuid.Nil, fmt.Errorf("snapshot columns: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO dataset_snapshot_rows (snapshot_id, row_index, data)
		 SELECT $1, row_index, data FROM dataset_rows WHERE dataset_id = $2`,
		snapshotID, datasetID); err != nil {
		return uuid.Nil, fmt.Errorf("snapshot rows: %w", err)
	}

	// Drop anything past the retention window.
	if _, err := tx.Exec(ctx,
		`DELETE FROM dataset_snapshots WHERE id IN (
			SELECT id FROM dataset_snapshots WHERE dataset_id = $1
			ORDER BY created_at DESC OFFSET $2
		)`, datasetID, snapshotsKept); err != nil {
		return uuid.Nil, fmt.Errorf("prune snapshots: %w", err)
	}

	return snapshotID, nil
}

// ListSnapshots returns a dataset's restore points, newest first.
func ListSnapshots(ctx context.Context, db *pgxpool.Pool, datasetID uuid.UUID) ([]Snapshot, error) {
	rows, err := db.Query(ctx,
		`SELECT id, dataset_id, execution_id, reason, row_count, created_at
		 FROM dataset_snapshots WHERE dataset_id = $1 ORDER BY created_at DESC`, datasetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Snapshot{}
	for rows.Next() {
		var s Snapshot
		if err := rows.Scan(&s.ID, &s.DatasetID, &s.ExecutionID, &s.Reason, &s.RowCount, &s.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// RestoreSnapshot rolls a dataset back to a restore point. The current state is
// itself snapshotted first, so an undo can be undone.
func RestoreSnapshot(ctx context.Context, db *pgxpool.Pool, datasetID, snapshotID uuid.UUID) (int, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var owns bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dataset_snapshots WHERE id = $1 AND dataset_id = $2)`,
		snapshotID, datasetID).Scan(&owns); err != nil {
		return 0, err
	}
	if !owns {
		return 0, fmt.Errorf("restore point does not belong to this dataset")
	}

	if _, err := TakeSnapshot(ctx, tx, datasetID, nil, "before undo"); err != nil {
		return 0, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM dataset_rows WHERE dataset_id = $1`, datasetID); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dataset_columns WHERE dataset_id = $1`, datasetID); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO dataset_columns (dataset_id, name, position, data_type)
		 SELECT $1, name, position, data_type FROM dataset_snapshot_columns WHERE snapshot_id = $2`,
		datasetID, snapshotID); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO dataset_rows (dataset_id, row_index, data)
		 SELECT $1, row_index, data FROM dataset_snapshot_rows WHERE snapshot_id = $2`,
		datasetID, snapshotID); err != nil {
		return 0, err
	}

	var restored int
	if err := tx.QueryRow(ctx,
		`UPDATE datasets SET row_count = (SELECT count(*) FROM dataset_rows WHERE dataset_id = $1),
		 updated_at = now() WHERE id = $1 RETURNING row_count`, datasetID).Scan(&restored); err != nil {
		return 0, err
	}

	return restored, tx.Commit(ctx)
}
