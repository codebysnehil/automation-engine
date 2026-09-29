import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideClock,
  LucideCopy,
  LucideHistory,
  LucideMousePointerClick,
  LucidePencil,
  LucidePlay,
  LucidePlus,
  LucideTrash2,
  LucideUpload,
  LucideWebhook,
  LucideWorkflow,
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { actionColor } from '../../core/action-colors';
import { Workflow } from '../../core/models';

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  schedule: 'Schedule',
  webhook: 'Webhook',
  dataset_upload: 'On upload',
};

@Component({
  selector: 'app-workflow-list',
  imports: [
    CommonModule,
    RouterLink,
    LucidePlus,
    LucidePlay,
    LucidePencil,
    LucideTrash2,
    LucideHistory,
    LucideCopy,
    LucideWorkflow,
    LucideMousePointerClick,
    LucideClock,
    LucideWebhook,
    LucideUpload,
  ],
  template: `
    <div class="page !pt-0">
      <div class="section-hero section-workflows flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-3.5">
          <span class="section-tile mt-0.5">
            <svg lucideWorkflow [size]="20"></svg>
          </span>
          <div>
            <h1 class="page-title">Workflows</h1>
            <p class="page-sub">Trigger → steps → done. Automate transforms, HTTP calls, exports and notifications</p>
          </div>
        </div>
        <a class="btn btn-primary" routerLink="/workflows/new"><svg lucidePlus></svg> New workflow</a>
      </div>

      @if (workflows().length === 0 && !loading()) {
        <div class="empty-state">
          <svg lucideWorkflow [size]="20"></svg>
          <p>No workflows yet.</p>
          <a routerLink="/workflows/new" class="font-medium text-foreground underline underline-offset-4">
            Create your first workflow
          </a>
        </div>
      } @else if (workflows().length > 0) {
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Steps</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (w of workflows(); track w.id) {
                <tr>
                  <td class="max-w-[260px]">
                    <a [routerLink]="['/workflows', w.id, 'edit']" class="font-medium hover:underline underline-offset-4">{{ w.name }}</a>
                    @if (w.description) {
                      <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ w.description }}</p>
                    }
                  </td>
                  <td>
                    <span class="inline-flex items-center gap-1.5 text-[13px]">
                      @switch (w.triggerType) {
                        @case ('manual') { <svg lucideMousePointerClick class="text-muted-foreground" [size]="14"></svg> }
                        @case ('schedule') { <svg lucideClock class="text-muted-foreground" [size]="14"></svg> }
                        @case ('webhook') { <svg lucideWebhook class="text-muted-foreground" [size]="14"></svg> }
                        @case ('dataset_upload') { <svg lucideUpload class="text-muted-foreground" [size]="14"></svg> }
                      }
                      {{ triggerLabel(w.triggerType) }}
                    </span>
                    @if (w.triggerType === 'schedule') {
                      <p class="mt-0.5 font-mono text-2xs text-muted-foreground">{{ w.triggerConfig['cron'] }}</p>
                    }
                    @if (w.triggerType === 'webhook' && w.webhookToken) {
                      <button
                        class="mt-0.5 flex items-center gap-1 font-mono text-2xs text-muted-foreground transition-colors hover:text-foreground"
                        title="Copy webhook URL"
                        (click)="copyWebhook(w)"
                      >
                        /api/hooks/{{ w.webhookToken.slice(0, 10) }}… <svg lucideCopy [size]="10"></svg>
                      </button>
                    }
                  </td>
                  <td>
                    <span class="inline-flex flex-wrap items-center gap-1">
                      @for (s of w.steps; track s.id; let last = $last) {
                        <span class="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium">
                          <span class="h-1.5 w-1.5 rounded-full" [style.background]="actionColor(s.actionType)"></span>
                          {{ s.name || s.actionType }}
                        </span>
                        @if (!last) {
                          <span class="text-muted-foreground/60">→</span>
                        }
                      }
                    </span>
                  </td>
                  <td>
                    <span class="badge" [class]="w.enabled ? 'badge badge-success' : 'badge badge-neutral'">
                      <span class="dot"></span>{{ w.enabled ? 'Enabled' : 'Disabled' }}
                    </span>
                  </td>
                  <td class="text-muted-foreground">{{ w.updatedAt | date: 'MMM d, HH:mm' }}</td>
                  <td>
                    <span class="flex items-center justify-end gap-1">
                      <button class="btn btn-outline btn-sm" (click)="run(w)" [disabled]="!w.enabled" title="Run now">
                        <svg lucidePlay></svg> Run
                      </button>
                      <a class="btn btn-ghost btn-icon btn-sm text-muted-foreground" [routerLink]="['/executions']"
                         [queryParams]="{ workflowId: w.id }" title="Run history">
                        <svg lucideHistory [size]="14"></svg>
                      </a>
                      <a class="btn btn-ghost btn-icon btn-sm text-muted-foreground" [routerLink]="['/workflows', w.id, 'edit']" title="Edit">
                        <svg lucidePencil [size]="14"></svg>
                      </a>
                      <button class="btn btn-ghost btn-icon btn-sm text-muted-foreground hover:text-red-500 dark:hover:text-red-400" (click)="remove(w)" title="Delete">
                        <svg lucideTrash2 [size]="14"></svg>
                      </button>
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (message()) {
        <p class="mt-3 text-xs text-ok">{{ message() }}</p>
      }
    </div>
  `,
})
export class WorkflowListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  workflows = signal<Workflow[]>([]);
  loading = signal(true);
  message = signal('');
  actionColor = actionColor;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.api.listWorkflows().subscribe({
      next: (ws) => {
        this.workflows.set(ws);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  triggerLabel(t: string): string {
    return TRIGGER_LABELS[t] ?? t;
  }

  run(w: Workflow): void {
    this.api.runWorkflow(w.id).subscribe({
      next: (res) => this.router.navigate(['/executions', res.executionId]),
      error: (err) => this.message.set(err?.error?.error ?? 'Run failed'),
    });
  }

  copyWebhook(w: Workflow): void {
    const url = `${location.origin}/api/hooks/${w.webhookToken}`;
    navigator.clipboard.writeText(url);
    this.message.set('Webhook URL copied to clipboard');
    setTimeout(() => this.message.set(''), 2500);
  }

  remove(w: Workflow): void {
    if (!confirm(`Delete workflow "${w.name}"?`)) return;
    this.api.deleteWorkflow(w.id).subscribe(() => this.refresh());
  }
}
