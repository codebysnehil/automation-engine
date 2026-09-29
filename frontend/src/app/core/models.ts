export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Dataset {
  id: string;
  ownerId: string;
  name: string;
  originalFilename: string;
  sheetName: string;
  rowCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetColumn {
  id: string;
  name: string;
  position: number;
  dataType: 'string' | 'number' | 'boolean' | 'date';
}

export interface DatasetRowsPage {
  rows: { rowIndex: number; data: Record<string, unknown> }[];
  total: number;
  page: number;
  pageSize: number;
  columns: DatasetColumn[];
}

/** A restore point captured before something rewrote a dataset in place. */
export interface DatasetSnapshot {
  id: string;
  datasetId: string;
  executionId?: string;
  reason: string;
  rowCount: number;
  createdAt: string;
}

export type TriggerType = 'manual' | 'schedule' | 'webhook' | 'dataset_upload';
export type ActionType = 'transform' | 'http_request' | 'notify' | 'export' | 'delay';

export interface WorkflowStep {
  id?: string;
  position?: number;
  name: string;
  actionType: ActionType;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  webhookToken?: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName?: string;
  triggerSource: string;
  status: 'running' | 'success' | 'failed';
  error: string;
  startedAt: string;
  finishedAt: string | null;
}

/** A dataset a run acted on, with the restore point that run created. */
export interface ExecutionDataset {
  datasetId: string;
  name: string;
  action: 'transform' | 'export' | string;
  rowsBefore?: number;
  rowsAfter?: number;
  currentRows: number;
  snapshotId?: string;
}

export interface ExecutionLog {
  id: number;
  stepPosition: number | null;
  level: 'info' | 'error';
  message: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: string;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityDay {
  date: string;
  success: number;
  failed: number;
}

export interface DashboardStats {
  datasets: number;
  totalRows: number;
  workflows: number;
  activeWorkflows: number;
  executions: number;
  succeeded: number;
  failed: number;
  avgDurationMs: number;
  runsLast7: number;
  runsPrev7: number;
  activity: ActivityDay[];
  recentExecutions: Execution[];
  recentDatasets: Dataset[];
}
