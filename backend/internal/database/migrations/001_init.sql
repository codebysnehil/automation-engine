CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL DEFAULT '',
    sheet_name TEXT NOT NULL DEFAULT '',
    row_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dataset_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'string'
);
CREATE INDEX IF NOT EXISTS idx_dataset_columns_dataset ON dataset_columns(dataset_id);

CREATE TABLE IF NOT EXISTS dataset_rows (
    id BIGSERIAL PRIMARY KEY,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    row_index INT NOT NULL,
    data JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset ON dataset_rows(dataset_id, row_index);

CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    trigger_config JSONB NOT NULL DEFAULT '{}',
    webhook_token TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    position INT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    action_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id, position);

CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'running',
    error TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS execution_logs (
    id BIGSERIAL PRIMARY KEY,
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    step_position INT,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution ON execution_logs(execution_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
