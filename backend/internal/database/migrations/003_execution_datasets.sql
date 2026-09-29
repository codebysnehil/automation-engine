-- Which datasets a run touched, and what it did to them. Gives the execution
-- screen somewhere to send the user afterwards, and doubles as an audit trail.
CREATE TABLE IF NOT EXISTS execution_datasets (
    id BIGSERIAL PRIMARY KEY,
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    rows_before INT,
    rows_after INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_execution_datasets_execution
    ON execution_datasets(execution_id, id);
