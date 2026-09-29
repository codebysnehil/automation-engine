import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideDatabase,
  LucideLoaderCircle,
  LucideTriangleAlert,
  LucideUndo2,
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { Execution, ExecutionDataset, ExecutionLog } from '../../core/models';

@Component({
  selector: 'app-execution-detail',
  imports: [
    CommonModule,
    RouterLink,
    LucideTriangleAlert,
    LucideLoaderCircle,
    LucideDatabase,
    LucideUndo2,
    LucideArrowRight,
  ],
  template: `
    <div class="page">
      @if (execution(); as e) {
        <div class="mb-6">
          <nav class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <a routerLink="/executions" class="hover:text-foreground">Executions</a>
            <span>/</span>
            <span class="font-mono text-foreground">{{ e.id.slice(0, 8) }}</span>
          </nav>
          <div class="flex items-center gap-3">
            <h1 class="page-title">{{ e.workflowName }}</h1>
            <span class="badge" [class]="'badge badge-' + e.status">
              <span class="dot"></span>{{ e.status }}
            </span>
          </div>
          <p class="page-sub">
            Triggered by {{ e.triggerSource }} · started {{ e.startedAt | date: 'MMM d, y HH:mm:ss' }}
            @if (e.finishedAt) { · finished {{ e.finishedAt | date: 'HH:mm:ss' }} }
          </p>
        </div>

        @if (e.error) {
          <div class="mb-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <svg lucideTriangleAlert class="mt-0.5 shrink-0 text-err" [size]="15"></svg>
            <div>
              <p class="text-sm font-medium text-err">Execution failed</p>
              <p class="mt-0.5 text-xs text-err opacity-80">{{ e.error }}</p>
            </div>
          </div>
        }

        <!-- What this run actually did to your data, and where to go next. -->
        @for (d of datasets(); track d.datasetId) {
          <div class="card mb-4 border-excel/40 bg-excel/[0.04] p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-start gap-3">
                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-excel/15 text-excel">
                  <svg lucideDatabase [size]="15"></svg>
                </span>
                <div>
                  <p class="text-[13px] font-medium">
                    {{ d.action === 'export' ? 'Exported' : 'Updated' }} {{ d.name }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    @if (d.action === 'transform' && d.rowsBefore != null && d.rowsAfter != null) {
                      {{ d.rowsBefore | number }} rows → <span class="font-medium text-foreground">{{ d.rowsAfter | number }} rows</span>
                      ({{ d.rowsBefore - d.rowsAfter | number }} removed) · now holds {{ d.currentRows | number }}
                    } @else {
                      {{ d.currentRows | number }} rows
                    }
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                @if (d.snapshotId) {
                  <button class="btn btn-outline btn-sm" (click)="undo(d)" [disabled]="undoing() === d.datasetId">
                    @if (undoing() === d.datasetId) {
                      <svg lucideLoaderCircle class="animate-spin"></svg> Undoing…
                    } @else {
                      <svg lucideUndo2></svg> Undo this run
                    }
                  </button>
                }
                <a class="btn btn-primary btn-sm" [routerLink]="['/datasets', d.datasetId]">
                  Open dataset <svg lucideArrowRight [size]="13"></svg>
                </a>
              </div>
            </div>
            @if (undoMessage()[d.datasetId]; as msg) {
              <p class="mt-2.5 border-t border-border pt-2.5 text-xs text-ok">{{ msg }}</p>
            }
          </div>
        }

        <div class="card">
          <div class="border-b border-border px-5 py-3.5">
            <h2 class="text-sm font-semibold">Logs</h2>
          </div>
          <div class="p-2">
            @for (log of logs(); track log.id) {
              <div class="flex items-baseline gap-4 rounded px-3 py-1.5 font-mono text-xs hover:bg-accent/40">
                <span class="shrink-0 text-muted-foreground/70">{{ log.createdAt | date: 'HH:mm:ss.SSS' }}</span>
                <span class="w-14 shrink-0" [class]="log.level === 'error' ? 'text-err' : 'text-blue-600 dark:text-blue-400'">
                  {{ log.stepPosition !== null ? 'step ' + (log.stepPosition + 1) : 'run' }}
                </span>
                <span [class]="log.level === 'error' ? 'text-err' : ''">{{ log.message }}</span>
              </div>
            }
            @if (e.status === 'running') {
              <div class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <svg lucideLoaderCircle class="animate-spin" [size]="13"></svg> still running…
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="flex items-center justify-center py-24 text-muted-foreground">
          <svg lucideLoaderCircle class="animate-spin" [size]="20"></svg>
        </div>
      }
    </div>
  `,
})
export class ExecutionDetailComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  execution = signal<Execution | null>(null);
  logs = signal<ExecutionLog[]>([]);
  datasets = signal<ExecutionDataset[]>([]);
  undoing = signal<string | null>(null);
  undoMessage = signal<Record<string, string>>({});

  private executionId = '';
  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.executionId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.timer = setInterval(() => this.load(), 2000);
  }

  private load(): void {
    this.api.getExecution(this.executionId).subscribe((res) => {
      this.execution.set(res.execution);
      this.logs.set(res.logs);
      this.datasets.set(res.datasets ?? []);
      if (res.execution.status !== 'running') clearInterval(this.timer);
    });
  }

  /** Roll a dataset back to the restore point this run created. */
  undo(d: ExecutionDataset): void {
    if (!d.snapshotId) return;
    if (!confirm(`Undo this run's changes to "${d.name}", restoring ${(d.rowsBefore ?? 0).toLocaleString()} rows?`)) {
      return;
    }
    this.undoing.set(d.datasetId);
    this.api.restoreSnapshot(d.datasetId, d.snapshotId).subscribe({
      next: (res) => {
        this.undoing.set(null);
        this.undoMessage.update((m) => ({
          ...m,
          [d.datasetId]: `Undone — "${d.name}" is back to ${res.rowCount.toLocaleString()} rows.`,
        }));
        this.load();
      },
      error: (err) => {
        this.undoing.set(null);
        this.undoMessage.update((m) => ({
          ...m,
          [d.datasetId]: err?.error?.error ?? 'Undo failed.',
        }));
      },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
