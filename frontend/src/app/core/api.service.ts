import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  AppNotification,
  DashboardStats,
  Dataset,
  DatasetColumn,
  DatasetRowsPage,
  DatasetSnapshot,
  Execution,
  ExecutionDataset,
  ExecutionLog,
  User,
  Workflow,
  WorkflowStep,
} from './models';

export interface WorkflowPayload {
  name: string;
  description: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  steps: WorkflowStep[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Dashboard
  dashboardStats() {
    return this.http.get<DashboardStats>('/api/dashboard/stats');
  }

  // Datasets
  listDatasets() {
    return this.http.get<Dataset[]>('/api/datasets');
  }

  getDataset(id: string) {
    return this.http.get<{ dataset: Dataset; columns: DatasetColumn[] }>(`/api/datasets/${id}`);
  }

  getDatasetRows(
    id: string,
    opts: { page: number; pageSize: number; search?: string; sort?: string; order?: string }
  ) {
    let params = new HttpParams()
      .set('page', opts.page)
      .set('pageSize', opts.pageSize);
    if (opts.search) params = params.set('search', opts.search);
    if (opts.sort) params = params.set('sort', opts.sort).set('order', opts.order ?? 'asc');
    return this.http.get<DatasetRowsPage>(`/api/datasets/${id}/rows`, { params });
  }

  uploadDataset(file: File, name?: string) {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    return this.http.post<Dataset>('/api/datasets/upload', form);
  }

  deleteDataset(id: string) {
    return this.http.delete(`/api/datasets/${id}`);
  }

  listSnapshots(id: string) {
    return this.http.get<DatasetSnapshot[]>(`/api/datasets/${id}/snapshots`);
  }

  restoreSnapshot(id: string, snapshotId: string) {
    return this.http.post<{ restored: boolean; rowCount: number }>(
      `/api/datasets/${id}/snapshots/${snapshotId}/restore`,
      {},
    );
  }

  exportDatasetUrl(id: string, format: string): string {
    return `/api/datasets/${id}/export?format=${format}`;
  }

  downloadDataset(id: string, format: string) {
    return this.http.get(this.exportDatasetUrl(id, format), { responseType: 'blob' });
  }

  // Workflows
  listWorkflows() {
    return this.http.get<Workflow[]>('/api/workflows');
  }

  getWorkflow(id: string) {
    return this.http.get<Workflow>(`/api/workflows/${id}`);
  }

  createWorkflow(payload: WorkflowPayload) {
    return this.http.post<Workflow>('/api/workflows', payload);
  }

  updateWorkflow(id: string, payload: WorkflowPayload) {
    return this.http.put<Workflow>(`/api/workflows/${id}`, payload);
  }

  deleteWorkflow(id: string) {
    return this.http.delete(`/api/workflows/${id}`);
  }

  runWorkflow(id: string) {
    return this.http.post<{ executionId: string }>(`/api/workflows/${id}/run`, {});
  }

  // Executions
  listExecutions(workflowId?: string) {
    let params = new HttpParams();
    if (workflowId) params = params.set('workflowId', workflowId);
    return this.http.get<Execution[]>('/api/executions', { params });
  }

  getExecution(id: string) {
    return this.http.get<{ execution: Execution; logs: ExecutionLog[]; datasets: ExecutionDataset[] }>(
      `/api/executions/${id}`,
    );
  }

  // Notifications
  listNotifications() {
    return this.http.get<{ notifications: AppNotification[]; unread: number }>('/api/notifications');
  }

  markNotificationRead(id: string) {
    return this.http.post(`/api/notifications/${id}/read`, {});
  }

  markAllNotificationsRead() {
    return this.http.post('/api/notifications/read-all', {});
  }

  // Users (admin)
  listUsers() {
    return this.http.get<User[]>('/api/users');
  }

  updateUserRole(id: string, role: string) {
    return this.http.patch(`/api/users/${id}/role`, { role });
  }

  deleteUser(id: string) {
    return this.http.delete(`/api/users/${id}`);
  }
}
