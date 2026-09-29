import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideCircleCheck,
  LucideCloudUpload,
  LucideDatabase,
  LucideFileSpreadsheet,
  LucideLoaderCircle,
  LucideTrash2,
  LucideWorkflow,
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { Dataset } from '../../core/models';

@Component({
  selector: 'app-dataset-list',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideCloudUpload,
    LucideFileSpreadsheet,
    LucideDatabase,
    LucideTrash2,
    LucideLoaderCircle,
    LucideCircleCheck,
    LucideWorkflow,
  ],
  template: `
    <div class="page !pt-0">
      <div class="section-hero section-datasets flex items-start gap-3.5">
        <span class="section-tile mt-0.5">
          <svg lucideDatabase [size]="20"></svg>
        </span>
        <div>
          <h1 class="page-title">Datasets</h1>
          <p class="page-sub">Upload Excel or CSV files — they're parsed into structured, typed tables</p>
        </div>
      </div>

      <button
        class="group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center transition-colors hover:border-muted-foreground/50 hover:bg-accent/30"
        [class]="dragging() ? 'border-muted-foreground/60 bg-accent/40' : ''"
        (dragover)="$event.preventDefault(); dragging.set(true)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()"
        type="button"
      >
        <input #fileInput type="file" accept=".xlsx,.xlsm,.csv,.tsv" hidden (change)="onFilePicked($event)" />
        @if (uploading()) {
          <svg lucideLoaderCircle class="animate-spin text-muted-foreground" [size]="22"></svg>
          <p class="text-sm text-muted-foreground">Parsing and importing…</p>
        } @else {
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors group-hover:text-foreground">
            <svg lucideCloudUpload [size]="18"></svg>
          </span>
          <p class="text-sm font-medium">Drop a file here or <span class="underline underline-offset-4">browse</span></p>
          <p class="text-xs text-muted-foreground">.xlsx · .xlsm · .csv · .tsv — up to 50 MB</p>
        }
      </button>
      @if (uploadError()) {
        <p class="mt-3 text-xs text-err">{{ uploadError() }}</p>
      }

      <!-- Landing moment after an upload: the file is in, now offer the next
           step rather than dropping the user back on a list. -->
      @if (justUploaded(); as up) {
        <div class="card mt-4 border-excel/40 bg-excel/[0.04] p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-excel/15 text-excel">
                <svg lucideCircleCheck [size]="18"></svg>
              </span>
              <div>
                <p class="text-sm font-semibold">{{ up.name }} is ready</p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {{ up.rowCount | number }} rows imported and typed from
                  <span class="font-mono">{{ up.originalFilename }}</span>.
                  What should happen to it?
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <a class="btn btn-primary btn-sm" [routerLink]="['/workflows/new']" [queryParams]="{ datasetId: up.id }">
                <svg lucideWorkflow></svg> Automate this dataset
              </a>
              <a class="btn btn-outline btn-sm" [routerLink]="['/datasets', up.id]">View data</a>
              <button class="btn btn-ghost btn-sm text-muted-foreground" (click)="justUploaded.set(null)">
                Later
              </button>
            </div>
          </div>
        </div>
      }

      <div class="mt-8">
        @if (datasets().length === 0 && !loading()) {
          <div class="empty-state">
            <svg lucideDatabase [size]="20"></svg>
            <p>No datasets yet. Upload your first file above.</p>
          </div>
        } @else if (datasets().length > 0) {
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Source file</th>
                  <th>Sheet</th>
                  <th class="text-right">Rows</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (d of datasets(); track d.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/datasets', d.id]" class="flex items-center gap-2.5 font-medium hover:underline underline-offset-4">
                        <span class="flex h-7 w-7 items-center justify-center rounded-md bg-excel/15 text-excel">
                          <svg lucideFileSpreadsheet [size]="13"></svg>
                        </span>
                        {{ d.name }}
                      </a>
                    </td>
                    <td class="font-mono text-xs text-muted-foreground">{{ d.originalFilename }}</td>
                    <td class="text-muted-foreground">{{ d.sheetName }}</td>
                    <td class="text-right font-mono text-xs">{{ d.rowCount | number }}</td>
                    <td class="text-muted-foreground">{{ d.createdAt | date: 'MMM d, y HH:mm' }}</td>
                    <td class="text-right">
                      <button class="btn btn-ghost btn-icon btn-sm text-muted-foreground hover:text-red-500 dark:hover:text-red-400" title="Delete dataset" (click)="remove(d)">
                        <svg lucideTrash2 [size]="14"></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class DatasetListComponent implements OnInit {
  private api = inject(ApiService);

  datasets = signal<Dataset[]>([]);
  loading = signal(true);
  uploading = signal(false);
  uploadError = signal('');
  dragging = signal(false);
  /** Set right after a successful upload so we can offer the next step. */
  justUploaded = signal<Dataset | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.api.listDatasets().subscribe({
      next: (ds) => {
        this.datasets.set(ds);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.upload(file);
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload(file);
    input.value = '';
  }

  private upload(file: File): void {
    this.uploading.set(true);
    this.uploadError.set('');
    this.justUploaded.set(null);
    this.api.uploadDataset(file).subscribe({
      next: (ds) => {
        this.uploading.set(false);
        this.justUploaded.set(ds);
        this.refresh();
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err?.error?.error ?? 'Upload failed.');
      },
    });
  }

  remove(d: Dataset): void {
    if (!confirm(`Delete dataset "${d.name}" and all its rows?`)) return;
    this.api.deleteDataset(d.id).subscribe(() => this.refresh());
  }
}
