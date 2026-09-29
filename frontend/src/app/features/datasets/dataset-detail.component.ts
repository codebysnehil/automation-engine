import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronsLeft,
  LucideChevronsRight,
  LucideDownload,
  LucideFileSpreadsheet,
  LucideHistory,
  LucideLoaderCircle,
  LucideRotateCcw,
  LucideSearch,
  LucideUndo2,
  LucideWorkflow,
} from '@lucide/angular';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Dataset, DatasetColumn, DatasetRowsPage, DatasetSnapshot } from '../../core/models';

@Component({
  selector: 'app-dataset-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideSearch,
    LucideDownload,
    LucideFileSpreadsheet,
    LucideArrowUp,
    LucideArrowDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronsLeft,
    LucideChevronsRight,
    LucideWorkflow,
    LucideHistory,
    LucideUndo2,
    LucideRotateCcw,
    LucideLoaderCircle,
  ],
  template: `
    <div class="page !max-w-none !pt-0">
      <!-- Excel-green identity strip -->
      <div class="section-hero section-datasets">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3.5">
            <span class="section-tile mt-0.5">
              <svg lucideFileSpreadsheet [size]="20"></svg>
            </span>
            <div>
              <nav class="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <a routerLink="/datasets" class="hover:text-foreground">Datasets</a>
                <span>/</span>
                <span class="text-foreground">{{ dataset()?.name }}</span>
              </nav>
              <h1 class="page-title">{{ dataset()?.name }}</h1>
              <p class="mt-0.5 text-sm text-muted-foreground">
                <span class="font-mono text-xs">{{ dataset()?.originalFilename }}</span>
                · sheet "{{ dataset()?.sheetName }}" · {{ total() | number }} rows
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <a class="btn btn-primary btn-sm" [routerLink]="['/workflows/new']" [queryParams]="{ datasetId: id }">
              <svg lucideWorkflow></svg> Automate this dataset
            </a>
            <button class="btn btn-sm border-0 bg-excel text-white shadow-sm hover:bg-excel/90" (click)="download('xlsx')">
              <svg lucideDownload></svg> Excel
            </button>
            <button class="btn btn-outline btn-sm" (click)="download('csv')"><svg lucideDownload></svg> CSV</button>
            <button class="btn btn-outline btn-sm" (click)="download('json')"><svg lucideDownload></svg> JSON</button>
          </div>
        </div>
      </div>

      <!-- Restore points. Transforms rewrite a dataset in place, so the most
           recent pre-change state is always one click away. -->
      @if (latestSnapshot(); as snap) {
        <div class="card mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
          <div class="flex items-start gap-3">
            <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <svg lucideHistory [size]="14"></svg>
            </span>
            <div>
              @if (isRedo()) {
                <p class="text-[13px] font-medium">You restored this dataset</p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  It's back to {{ total() | number }} rows. The previous state
                  ({{ snap.rowCount | number }} rows, {{ snap.createdAt | date: 'MMM d, HH:mm' }})
                  is still available.
                </p>
              } @else {
                <p class="text-[13px] font-medium">This dataset was changed by "{{ snap.reason }}"</p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  It held {{ snap.rowCount | number }} rows before that run
                  ({{ snap.createdAt | date: 'MMM d, HH:mm' }}) · now {{ total() | number }}.
                </p>
              }
            </div>
          </div>
          <button class="btn btn-outline btn-sm" (click)="undo(snap)" [disabled]="restoring()">
            @if (restoring()) {
              <svg lucideLoaderCircle class="animate-spin"></svg> Restoring…
            } @else if (isRedo()) {
              <svg lucideRotateCcw></svg> Redo — back to {{ snap.rowCount | number }} rows
            } @else {
              <svg lucideUndo2></svg> Undo — restore {{ snap.rowCount | number }} rows
            }
          </button>
        </div>
      }
      @if (restoreMessage()) {
        <p class="mb-4 text-xs text-ok">{{ restoreMessage() }}</p>
      }

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="relative w-full max-w-xs">
          <svg lucideSearch class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" [size]="14"></svg>
          <input
            type="search"
            class="input pl-8"
            placeholder="Search all columns…"
            [ngModel]="search()"
            (ngModelChange)="onSearch($event)"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          Page {{ page() }} of {{ totalPages() }} · {{ total() | number }} rows
        </p>
      </div>

      <div class="table-shell max-h-[62vh]">
        <table>
          <thead>
            <tr>
              <th class="w-12 font-mono">#</th>
              @for (col of columns(); track col.id) {
                <th class="cursor-pointer select-none hover:text-foreground" (click)="toggleSort(col.name)">
                  <span class="inline-flex items-center gap-1.5">
                    {{ col.name }}
                    <span class="rounded border border-border bg-secondary/60 px-1 py-px text-[9px] font-semibold normal-case text-muted-foreground">
                      {{ col.dataType }}
                    </span>
                    @if (sortCol() === col.name) {
                      @if (sortOrder() === 'asc') {
                        <svg lucideArrowUp [size]="12"></svg>
                      } @else {
                        <svg lucideArrowDown [size]="12"></svg>
                      }
                    }
                  </span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.rowIndex) {
              <tr>
                <td class="font-mono text-xs text-muted-foreground">{{ row.rowIndex + 1 }}</td>
                @for (col of columns(); track col.id) {
                  <td [class.font-mono]="col.dataType === 'number'" [class.text-xs]="col.dataType === 'number'">
                    @if (row.data[col.name] === null || row.data[col.name] === undefined) {
                      <span class="text-muted-foreground/50">—</span>
                    } @else if (col.dataType === 'boolean') {
                      <span class="badge" [class]="row.data[col.name] ? 'badge badge-success' : 'badge badge-neutral'">
                        {{ row.data[col.name] }}
                      </span>
                    } @else {
                      {{ row.data[col.name] }}
                    }
                  </td>
                }
              </tr>
            }
            @if (rows().length === 0 && !loading()) {
              <tr>
                <td [attr.colspan]="columns().length + 1" class="py-10 text-center text-muted-foreground">
                  No rows match your search.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button class="btn btn-outline btn-icon btn-sm" [disabled]="page() <= 1" (click)="goTo(1)" title="First page">
          <svg lucideChevronsLeft></svg>
        </button>
        <button class="btn btn-outline btn-icon btn-sm" [disabled]="page() <= 1" (click)="goTo(page() - 1)" title="Previous page">
          <svg lucideChevronLeft></svg>
        </button>
        <span class="px-2 text-xs text-muted-foreground">Page {{ page() }} / {{ totalPages() }}</span>
        <button class="btn btn-outline btn-icon btn-sm" [disabled]="page() >= totalPages()" (click)="goTo(page() + 1)" title="Next page">
          <svg lucideChevronRight></svg>
        </button>
        <button class="btn btn-outline btn-icon btn-sm" [disabled]="page() >= totalPages()" (click)="goTo(totalPages())" title="Last page">
          <svg lucideChevronsRight></svg>
        </button>
        <select class="select ml-2 h-8 w-auto text-xs" [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)">
          <option [ngValue]="25">25 per page</option>
          <option [ngValue]="50">50 per page</option>
          <option [ngValue]="100">100 per page</option>
        </select>
      </div>
    </div>
  `,
})
export class DatasetDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  id = '';
  private search$ = new Subject<string>();

  snapshots = signal<DatasetSnapshot[]>([]);
  restoring = signal(false);
  restoreMessage = signal('');

  /** The most recent restore point — what "Undo" would roll back to. */
  latestSnapshot = computed(() => this.snapshots()[0] ?? null);

  /**
   * An undo itself snapshots the state it replaced, so when that is the newest
   * restore point the button is really a redo, not an undo.
   */
  isRedo = computed(() => this.latestSnapshot()?.reason === 'before undo');

  dataset = signal<Dataset | null>(null);
  columns = signal<DatasetColumn[]>([]);
  rows = signal<DatasetRowsPage['rows']>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(25);
  search = signal('');
  sortCol = signal('');
  sortOrder = signal<'asc' | 'desc'>('asc');
  loading = signal(true);

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getDataset(this.id).subscribe((res) => {
      this.dataset.set(res.dataset);
      this.columns.set(res.columns);
    });
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((q) => {
      this.search.set(q);
      this.page.set(1);
      this.load();
    });
    this.load();
    this.loadSnapshots();
  }

  loadSnapshots(): void {
    this.api.listSnapshots(this.id).subscribe({
      next: (s) => this.snapshots.set(s),
      error: () => this.snapshots.set([]),
    });
  }

  undo(snap: DatasetSnapshot): void {
    const question = this.isRedo()
      ? `Go back to ${snap.rowCount.toLocaleString()} rows, undoing your restore?`
      : `Restore this dataset to ${snap.rowCount.toLocaleString()} rows, as it was before "${snap.reason}" ran?`;
    if (!confirm(question)) return;
    this.restoring.set(true);
    this.restoreMessage.set('');
    this.api.restoreSnapshot(this.id, snap.id).subscribe({
      next: (res) => {
        this.restoring.set(false);
        this.restoreMessage.set(`Restored — the dataset is back to ${res.rowCount.toLocaleString()} rows.`);
        this.page.set(1);
        this.load();
        this.loadSnapshots();
        this.api.getDataset(this.id).subscribe((r) => this.dataset.set(r.dataset));
      },
      error: (err) => {
        this.restoring.set(false);
        this.restoreMessage.set(err?.error?.error ?? 'Restore failed.');
      },
    });
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getDatasetRows(this.id, {
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        sort: this.sortCol() || undefined,
        order: this.sortOrder(),
      })
      .subscribe((res) => {
        this.rows.set(res.rows);
        this.total.set(res.total);
        if (res.columns.length) this.columns.set(res.columns);
        this.loading.set(false);
      });
  }

  onSearch(q: string): void {
    this.search$.next(q);
  }

  toggleSort(col: string): void {
    if (this.sortCol() === col) {
      this.sortOrder.update((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortCol.set(col);
      this.sortOrder.set('asc');
    }
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  download(format: string): void {
    this.api.downloadDataset(this.id, format).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.dataset()?.name ?? 'dataset'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
