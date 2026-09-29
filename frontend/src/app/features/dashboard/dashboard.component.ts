import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideArrowRight,
  LucideChartColumn,
  LucideCircleCheck,
  LucideCircleX,
  LucideDatabase,
  LucideLayoutDashboard,
  LucideLoaderCircle,
  LucideMinus,
  LucidePlus,
  LucideTable,
  LucideTimer,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideUpload,
  LucideWorkflow,
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { ActivityDay, DashboardStats } from '../../core/models';

/** Plot height in px. Axis labels live outside it so the card never scrolls. */
const PLOT_H = 176;

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    LucideLayoutDashboard,
    LucideDatabase,
    LucideWorkflow,
    LucideUpload,
    LucidePlus,
    LucideArrowRight,
    LucideLoaderCircle,
    LucideTrendingUp,
    LucideTrendingDown,
    LucideMinus,
    LucideCircleCheck,
    LucideCircleX,
    LucideTimer,
    LucideActivity,
    LucideChartColumn,
    LucideTable,
  ],
  template: `
    <div class="page !pt-0">
      <div class="section-hero section-dashboard flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-3.5">
          <span class="section-tile mt-0.5">
            <svg lucideLayoutDashboard [size]="20"></svg>
          </span>
          <div>
            <h1 class="page-title">{{ greeting() }}</h1>
            <p class="page-sub">{{ today | date: 'EEEE, d MMMM' }} · here's how your automations are running</p>
          </div>
        </div>
        <div class="flex gap-2">
          <a class="btn btn-outline" routerLink="/datasets">
            <svg lucideUpload></svg> Upload data
          </a>
          <a class="btn btn-primary" routerLink="/workflows/new">
            <svg lucidePlus></svg> New workflow
          </a>
        </div>
      </div>

      @if (stats(); as s) {
        <!-- KPI row -->
        <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div class="stat">
            <p class="stat-label"><svg lucideActivity [size]="14"></svg> Total runs</p>
            <p class="stat-value">{{ s.executions | number }}</p>
            <p class="stat-foot">
              <span class="stat-delta" [class]="deltaClass()">
                @if (delta() > 0) { <svg lucideTrendingUp [size]="11"></svg> }
                @else if (delta() < 0) { <svg lucideTrendingDown [size]="11"></svg> }
                @else { <svg lucideMinus [size]="11"></svg> }
                {{ delta() > 0 ? '+' : '' }}{{ delta() }}%
              </span>
              vs previous 7 days
            </p>
          </div>

          <div class="stat">
            <p class="stat-label"><svg lucideWorkflow [size]="14"></svg> Active workflows</p>
            <p class="stat-value">{{ s.activeWorkflows | number }}</p>
            <p class="stat-foot">of {{ s.workflows | number }} built · {{ s.workflows - s.activeWorkflows }} paused</p>
          </div>

          <div class="stat">
            <p class="stat-label"><svg lucideDatabase [size]="14"></svg> Datasets</p>
            <p class="stat-value">{{ s.datasets | number }}</p>
            <p class="stat-foot">{{ compact(s.totalRows) }} rows stored</p>
          </div>

          <div class="stat">
            <p class="stat-label"><svg lucideTimer [size]="14"></svg> Avg run time</p>
            <p class="stat-value">{{ duration(s.avgDurationMs) }}</p>
            <p class="stat-foot">across {{ finishedRuns() | number }} finished runs</p>
          </div>
        </div>

        <!-- Chart + reliability -->
        <div class="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section class="card">
            <div class="card-head">
              <div>
                <h2 class="card-title">Runs per day</h2>
                <p class="mt-0.5 text-xs text-muted-foreground">Last 14 days · {{ windowTotal() | number }} runs</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="hidden items-center gap-3 sm:flex">
                  <span class="legend-key">
                    <span class="legend-swatch" style="background: var(--chart-runs)"></span> Succeeded
                  </span>
                  <span class="legend-key">
                    <span class="legend-swatch" style="background: var(--chart-failed)"></span> Failed
                  </span>
                </span>
                <button
                  class="btn btn-ghost btn-icon btn-sm text-muted-foreground"
                  (click)="showTable.set(!showTable())"
                  [title]="showTable() ? 'Show chart' : 'Show as table'"
                >
                  @if (showTable()) { <svg lucideChartColumn [size]="14"></svg> }
                  @else { <svg lucideTable [size]="14"></svg> }
                </button>
              </div>
            </div>

            <div class="p-5">
              @if (windowTotal() === 0) {
                <div class="empty-state border-0 py-16">
                  <svg lucideActivity [size]="20"></svg>
                  <p>No runs in the last 14 days.</p>
                  <a class="btn btn-outline btn-sm mt-1" routerLink="/workflows">Run a workflow</a>
                </div>
              } @else if (showTable()) {
                <!-- Table twin: every plotted value is readable without color -->
                <div class="table-shell max-h-[220px]">
                  <table>
                    <thead>
                      <tr><th>Day</th><th class="text-right">Succeeded</th><th class="text-right">Failed</th><th class="text-right">Total</th></tr>
                    </thead>
                    <tbody>
                      @for (d of s.activity; track d.date) {
                        <tr>
                          <td>{{ d.date | date: 'EEE d MMM' }}</td>
                          <td class="text-right tabular-nums">{{ d.success }}</td>
                          <td class="text-right tabular-nums">{{ d.failed }}</td>
                          <td class="text-right font-medium tabular-nums">{{ d.success + d.failed }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="flex gap-3">
                  <!-- y axis -->
                  <div class="flex w-7 shrink-0 flex-col justify-between text-right" [style.height.px]="plotH">
                    @for (t of ticks(); track t) {
                      <span class="chart-tick -translate-y-1.5 text-[10px] leading-none text-muted-foreground">{{ t }}</span>
                    }
                  </div>

                  <div class="relative min-w-0 flex-1">
                    <!-- gridlines, hairline and solid -->
                    <div class="pointer-events-none absolute inset-x-0 top-0" [style.height.px]="plotH">
                      @for (t of ticks(); track t; let i = $index) {
                        <div
                          class="absolute inset-x-0 border-t"
                          [style.borderColor]="'hsl(var(--chart-grid))'"
                          [style.top.px]="(i / (ticks().length - 1)) * plotH"
                        ></div>
                      }
                    </div>

                    <!-- columns -->
                    <div class="relative flex items-end gap-[3px]" [style.height.px]="plotH">
                      @for (d of s.activity; track d.date; let i = $index) {
                        <div
                          class="group relative flex h-full flex-1 cursor-default flex-col justify-end rounded-t-md transition-colors"
                          [class.bg-accent]="hover() === i"
                          (mouseenter)="hover.set(i)"
                          (mouseleave)="hover.set(null)"
                        >
                          <div class="mx-auto flex w-full max-w-6 flex-col justify-end">
                            @if (d.failed > 0) {
                              <div
                                class="w-full shrink-0 rounded-t"
                                style="background: var(--chart-failed)"
                                [style.height.px]="barPx(d.failed)"
                              ></div>
                            }
                            @if (d.failed > 0 && d.success > 0) {
                              <!-- 2px surface gap does the separating, not a stroke -->
                              <div class="h-[2px] w-full shrink-0 bg-card"></div>
                            }
                            @if (d.success > 0) {
                              <div
                                class="w-full shrink-0"
                                [class.rounded-t]="d.failed === 0"
                                style="background: var(--chart-runs)"
                                [style.height.px]="barPx(d.success)"
                              ></div>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    <!-- x axis: labels ride the column centres (not the narrow
                         bands) so they never wrap, and thin out on small screens -->
                    <div class="relative mt-2 h-3.5">
                      @for (d of s.activity; track d.date; let i = $index) {
                        @if (i % 2 === 1) {
                          <span
                            class="absolute -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                            [class]="i % 4 === 1 ? 'inline' : 'hidden sm:inline'"
                            [style.left]="labelLeft(i, s.activity.length)"
                          >
                            {{ d.date | date: 'd MMM' }}
                          </span>
                        }
                      }
                    </div>

                    <!-- hover tooltip; values are also in the table view, never gated -->
                    @if (hovered(); as h) {
                      <div
                        class="pointer-events-none absolute top-1 z-10 w-40 -translate-x-1/2 rounded-lg border border-border bg-card p-2.5 shadow-lg"
                        [style.left]="tooltipLeft(hover()!, s.activity.length)"
                      >
                        <p class="mb-1.5 text-2xs font-medium text-muted-foreground">{{ h.date | date: 'EEE d MMM' }}</p>
                        <p class="flex items-center justify-between text-xs">
                          <span class="flex items-center gap-1.5 text-muted-foreground">
                            <span class="legend-swatch" style="background: var(--chart-runs)"></span> Succeeded
                          </span>
                          <span class="font-semibold tabular-nums">{{ h.success }}</span>
                        </p>
                        <p class="mt-1 flex items-center justify-between text-xs">
                          <span class="flex items-center gap-1.5 text-muted-foreground">
                            <span class="legend-swatch" style="background: var(--chart-failed)"></span> Failed
                          </span>
                          <span class="font-semibold tabular-nums">{{ h.failed }}</span>
                        </p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Reliability: the one hero figure on this view -->
          <section class="card flex flex-col p-5">
            <p class="stat-label">Success rate</p>
            <p class="mt-3 text-[48px] font-semibold leading-none tracking-tight">{{ successRate() }}%</p>
            <div class="meter section-dashboard mt-4">
              <div class="meter-fill" [style.width.%]="successRate()"></div>
            </div>

            <dl class="mt-5 space-y-3 border-t border-border pt-4">
              <div class="flex items-center justify-between">
                <dt class="flex items-center gap-2 text-xs text-muted-foreground">
                  <svg lucideCircleCheck [size]="14" class="text-ok"></svg> Succeeded
                </dt>
                <dd class="text-sm font-semibold tabular-nums">{{ s.succeeded | number }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="flex items-center gap-2 text-xs text-muted-foreground">
                  <svg lucideCircleX [size]="14" class="text-err"></svg> Failed
                </dt>
                <dd class="text-sm font-semibold tabular-nums">{{ s.failed | number }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="flex items-center gap-2 text-xs text-muted-foreground">
                  <svg lucideTimer [size]="14"></svg> Avg duration
                </dt>
                <dd class="text-sm font-semibold tabular-nums">{{ duration(s.avgDurationMs) }}</dd>
              </div>
            </dl>

            <a routerLink="/executions" class="btn btn-outline btn-sm mt-auto w-full !justify-center">
              View execution history <svg lucideArrowRight [size]="13"></svg>
            </a>
          </section>
        </div>

        <!-- Activity lists -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section class="card">
            <div class="card-head">
              <h2 class="card-title">Recent executions</h2>
              <a routerLink="/executions" class="btn btn-ghost btn-sm text-muted-foreground">
                View all <svg lucideArrowRight [size]="13"></svg>
              </a>
            </div>
            <div class="p-2">
              @if (s.recentExecutions.length === 0) {
                <p class="px-3 py-8 text-center text-sm text-muted-foreground">
                  No executions yet — run a workflow to see it here.
                </p>
              }
              @for (e of s.recentExecutions; track e.id) {
                <a
                  class="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50"
                  [routerLink]="['/executions', e.id]"
                >
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    [class]="e.status === 'failed'
                      ? 'bg-red-500/10 text-err'
                      : e.status === 'running'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/10 text-ok'"
                  >
                    @if (e.status === 'failed') { <svg lucideCircleX [size]="14"></svg> }
                    @else if (e.status === 'running') { <svg lucideLoaderCircle [size]="14" class="animate-spin"></svg> }
                    @else { <svg lucideCircleCheck [size]="14"></svg> }
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13px] font-medium">{{ e.workflowName }}</span>
                    <span class="block truncate text-xs text-muted-foreground">
                      {{ e.triggerSource }} · {{ runLength(e.startedAt, e.finishedAt) }}
                    </span>
                  </span>
                  <span class="shrink-0 text-xs text-muted-foreground">{{ ago(e.startedAt) }}</span>
                </a>
              }
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <h2 class="card-title">Recent datasets</h2>
              <a routerLink="/datasets" class="btn btn-ghost btn-sm text-muted-foreground">
                View all <svg lucideArrowRight [size]="13"></svg>
              </a>
            </div>
            <div class="p-2">
              @if (s.recentDatasets.length === 0) {
                <p class="px-3 py-8 text-center text-sm text-muted-foreground">
                  No datasets yet — upload an Excel or CSV file.
                </p>
              }
              @for (d of s.recentDatasets; track d.id) {
                <a
                  class="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50"
                  [routerLink]="['/datasets', d.id]"
                >
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-excel/10 text-excel">
                    <svg lucideDatabase [size]="13"></svg>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13px] font-medium">{{ d.name }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{ d.originalFilename }}</span>
                  </span>
                  <span class="shrink-0 text-right text-xs text-muted-foreground">
                    <span class="block tabular-nums">{{ d.rowCount | number }} rows</span>
                    <span class="block">{{ ago(d.createdAt) }}</span>
                  </span>
                </a>
              }
            </div>
          </section>
        </div>
      } @else {
        <div class="flex items-center justify-center py-24 text-muted-foreground">
          <svg lucideLoaderCircle class="animate-spin" [size]="20"></svg>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);

  stats = signal<DashboardStats | null>(null);
  hover = signal<number | null>(null);
  showTable = signal(false);

  today = new Date();
  plotH = PLOT_H;

  ngOnInit(): void {
    this.api.dashboardStats().subscribe((s) => this.stats.set(s));
  }

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  hovered = computed<ActivityDay | null>(() => {
    const i = this.hover();
    const a = this.stats()?.activity ?? [];
    return i === null ? null : (a[i] ?? null);
  });

  windowTotal = computed(() =>
    (this.stats()?.activity ?? []).reduce((n, d) => n + d.success + d.failed, 0),
  );

  finishedRuns = computed(() => {
    const s = this.stats();
    return s ? s.succeeded + s.failed : 0;
  });

  successRate = computed(() => {
    const s = this.stats();
    const done = s ? s.succeeded + s.failed : 0;
    return done === 0 ? 0 : Math.round((s!.succeeded / done) * 100);
  });

  /** Percentage change in run volume, last 7 days vs the 7 before. */
  delta = computed(() => {
    const s = this.stats();
    if (!s || s.runsPrev7 === 0) return s && s.runsLast7 > 0 ? 100 : 0;
    return Math.round(((s.runsLast7 - s.runsPrev7) / s.runsPrev7) * 100);
  });

  deltaClass = computed(() => {
    const d = this.delta();
    if (d > 0) return 'stat-delta-up';
    if (d < 0) return 'stat-delta-down';
    return 'stat-delta-flat';
  });

  /** Axis ceiling rounded to a clean number, and the ticks down from it. */
  private axisMax = computed(() => {
    const peak = Math.max(...(this.stats()?.activity ?? []).map((d) => d.success + d.failed), 0);
    if (peak <= 4) return 4;
    const pow = Math.pow(10, Math.floor(Math.log10(peak)));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
      if (m * pow >= peak) return m * pow;
    }
    return 10 * pow;
  });

  ticks = computed(() => {
    const max = this.axisMax();
    return [max, max / 2, 0].map((v) => (Number.isInteger(v) ? v : v.toFixed(1)));
  });

  barPx(value: number): number {
    return Math.round((value / this.axisMax()) * PLOT_H);
  }

  /**
   * Centre the tooltip on its column, but clamp it inside the plot so the
   * first and last day don't push it out past the card edge (tooltip is 160px).
   */
  tooltipLeft(index: number, days: number): string {
    const pct = ((index + 0.5) / days) * 100;
    return `clamp(84px, ${pct.toFixed(2)}%, calc(100% - 84px))`;
  }

  labelLeft(index: number, days: number): string {
    const pct = ((index + 0.5) / days) * 100;
    return `clamp(20px, ${pct.toFixed(2)}%, calc(100% - 20px))`;
  }

  compact(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  duration(ms: number): string {
    if (!ms) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    const m = Math.floor(ms / 60_000);
    return `${m}m ${Math.round((ms % 60_000) / 1000)}s`;
  }

  runLength(startedAt: string, finishedAt: string | null): string {
    if (!finishedAt) return 'running';
    return this.duration(new Date(finishedAt).getTime() - new Date(startedAt).getTime());
  }

  ago(iso: string): string {
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86_400)}d ago`;
  }
}
