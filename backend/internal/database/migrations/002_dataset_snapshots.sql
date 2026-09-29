-- Restore points. A snapshot is taken immediately before anything rewrites a
-- dataset in place (today: transform steps), so a bad filter is always undoable.
CREATE TABLE IF NOT EXISTS dataset_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT '',
    row_count INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_dataset
    ON dataset_snapshots(dataset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dataset_snapshot_columns (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES dataset_snapshots(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'string'
);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshot_columns_snapshot
    ON dataset_snapshot_columns(snapshot_id, position);

CREATE TABLE IF NOT EXISTS dataset_snapshot_rows (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES dataset_snapshots(id) ON DELETE CASCADE,
    row_index INT NOT NULL,
    data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshot_rows_snapshot
    ON dataset_snapshot_rows(snapshot_id, row_index);
