import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideHistory } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { Execution } from '../../core/models';

type StatusFilter = 'all' | 'success' | 'failed' | 'running';

@Component({
  selector: 'app-execution-list',
  imports: [CommonModule, RouterLink, LucideHistory],
  template: `
    <div class="page !pt-0">
      <div class="section-hero section-executions flex items-start gap-3.5">
        <span class="section-tile mt-0.5">
          <svg lucideHistory [size]="20"></svg>
        </span>
        <div>
          <h1 class="page-title">Executions</h1>
          <p class="page-sub">Every workflow run, with status and full logs — refreshes automatically</p>
        </div>
      </div>

      @if (executions().length === 0 && !loading()) {
        <div class="empty-state">
          <svg lucideHistory [size]="20"></svg>
          <p>No executions yet. Run a workflow to see its history here.</p>
          <a class="btn btn-outline btn-sm mt-1" routerLink="/workflows">Go to workflows</a>
        </div>
      } @else if (executions().length > 0) {
        <!-- One filter row above everything it scopes -->
        <div class="mb-4 flex flex-wrap items-center gap-2">
          @for (f of filters; track f.value) {
            <button
              class="filter-chip"
              [class.filter-chip-on]="filter() === f.value"
              (click)="filter.set(f.value)"
            >
              {{ f.label }}
              <span class="filter-count">{{ count(f.value) }}</span>
            </button>
          }
          <span class="ml-auto text-xs text-muted-foreground">
            Showing {{ visible().length | number }} of {{ executions().length | number }} runs
          </span>
        </div>

        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Workflow</th>
                <th>Trigger</th>
                <th>Started</th>
                <th class="text-right">Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              @for (e of visible(); track e.id) {
                <tr>
                  <td>
                    <span class="badge" [class]="'badge badge-' + e.status">
                      <span class="dot"></span>{{ e.status }}
                    </span>
                  </td>
                  <td>
                    <a [routerLink]="['/executions', e.id]" class="font-medium hover:underline underline-offset-4">
                      {{ e.workflowName }}
                    </a>
                  </td>
                  <td>
                    <span class="chip">{{ e.triggerSource }}</span>
                  </td>
                  <td class="text-muted-foreground">
                    <span class="block">{{ ago(e.startedAt) }}</span>
                    <span class="block text-2xs text-muted-foreground/70">{{ e.startedAt | date: 'MMM d, HH:mm:ss' }}</span>
                  </td>
                  <td class="text-right tabular-nums">{{ duration(e) }}</td>
                  <td class="max-w-[280px] truncate text-xs" [class]="e.error ? 'text-err' : 'text-muted-foreground'">
                    {{ e.error || '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (visible().length === 0) {
          <div class="empty-state mt-4">
            <p>No {{ filter() }} runs in this list.</p>
          </div>
        }
      }
    </div>
  `,
})
export class ExecutionListComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  executions = signal<Execution[]>([]);
  loading = signal(true);
  filter = signal<StatusFilter>('all');

  filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'success', label: 'Succeeded' },
    { value: 'failed', label: 'Failed' },
    { value: 'running', label: 'Running' },
  ];

  visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.executions() : this.executions().filter((e) => e.status === f);
  });

  private timer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  refresh(): void {
    const workflowId = this.route.snapshot.queryParamMap.get('workflowId') ?? undefined;
    this.api.listExecutions(workflowId).subscribe({
      next: (es) => {
        this.executions.set(es);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  count(f: StatusFilter): number {
    return f === 'all' ? this.executions().length : this.executions().filter((e) => e.status === f).length;
  }

  duration(e: Execution): string {
    if (!e.finishedAt) return 'running…';
    const ms = new Date(e.finishedAt).getTime() - new Date(e.startedAt).getTime();
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  }

  ago(iso: string): string {
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86_400)}d ago`;
  }
}
