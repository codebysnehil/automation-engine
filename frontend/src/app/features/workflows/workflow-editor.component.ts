import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideClock,
  LucideLoaderCircle,
  LucideMousePointerClick,
  LucidePlus,
  LucideUpload,
  LucideWebhook,
  LucideWorkflow,
  LucideX,
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { actionColor, opColor } from '../../core/action-colors';
import { ActionType, Dataset, TriggerType } from '../../core/models';

interface TransformOpForm {
  type: string;
  column: string;
  from: string;
  to: string;
  op: string;
  value: string;
}

interface StepForm {
  name: string;
  actionType: ActionType;
  datasetId: string;
  operations: TransformOpForm[];
  url: string;
  method: string;
  body: string;
  title: string;
  message: string;
  format: string;
  seconds: number;
}

function emptyOp(): TransformOpForm {
  return { type: 'dedupe', column: '', from: '', to: '', op: 'equals', value: '' };
}

function emptyStep(): StepForm {
  return {
    name: '',
    actionType: 'transform',
    datasetId: '',
    operations: [emptyOp()],
    url: '',
    method: 'POST',
    body: '',
    title: '',
    message: '',
    format: 'xlsx',
    seconds: 5,
  };
}

@Component({
  selector: 'app-workflow-editor',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideMousePointerClick,
    LucideClock,
    LucideWebhook,
    LucideWorkflow,
    LucideUpload,
    LucidePlus,
    LucideX,
    LucideArrowUp,
    LucideArrowDown,
    LucideLoaderCircle,
  ],
  template: `
    <div class="page !pt-0">
      <div class="section-hero section-workflows flex items-start gap-3.5">
        <span class="section-tile mt-0.5">
          <svg lucideWorkflow [size]="20"></svg>
        </span>
        <div>
          <nav class="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <a routerLink="/workflows" class="hover:text-foreground">Workflows</a>
            <span>/</span>
            <span class="text-foreground">{{ isEdit ? 'Edit' : 'New' }}</span>
          </nav>
          <h1 class="page-title">{{ isEdit ? 'Edit workflow' : 'New workflow' }}</h1>
        </div>
      </div>

      <!-- Basics -->
      <section class="card mb-4 p-5">
        <h2 class="mb-4 text-sm font-semibold">Basics</h2>
        <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
          <div>
            <label class="label">Name</label>
            <input class="input" [(ngModel)]="name" placeholder="e.g. Clean incoming orders" />
          </div>
          <div>
            <label class="label">Status</label>
            <select class="select" [(ngModel)]="enabled">
              <option [ngValue]="true">Enabled</option>
              <option [ngValue]="false">Disabled</option>
            </select>
          </div>
        </div>
        <div>
          <label class="label">Description <span class="text-muted-foreground/60">(optional)</span></label>
          <input class="input" [(ngModel)]="description" placeholder="What does this workflow do?" />
        </div>
      </section>

      <!-- Trigger -->
      <section class="card mb-4 p-5">
        <h2 class="mb-4 text-sm font-semibold">Trigger</h2>
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          @for (t of triggerTypes; track t.value) {
            <button
              type="button"
              class="rounded-lg border p-3.5 text-left transition-colors"
              [class]="
                triggerType === t.value
                  ? 'border-foreground/40 bg-accent/60'
                  : 'border-border bg-transparent hover:border-muted-foreground/40 hover:bg-accent/30'
              "
              (click)="triggerType = t.value"
            >
              <span class="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                @switch (t.value) {
                  @case ('manual') { <svg lucideMousePointerClick [size]="14"></svg> }
                  @case ('schedule') { <svg lucideClock [size]="14"></svg> }
                  @case ('webhook') { <svg lucideWebhook [size]="14"></svg> }
                  @case ('dataset_upload') { <svg lucideUpload [size]="14"></svg> }
                }
              </span>
              <p class="text-[13px] font-medium">{{ t.label }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ t.hint }}</p>
            </button>
          }
        </div>

        @if (triggerType === 'schedule') {
          <div class="mt-4 max-w-sm">
            <label class="label">Cron expression <span class="text-muted-foreground/60">(min hour day month weekday)</span></label>
            <input class="input font-mono" [(ngModel)]="cron" placeholder="*/5 * * * *" />
            <p class="mt-1.5 text-xs text-muted-foreground">
              <code class="rounded bg-secondary px-1 py-0.5">0 9 * * *</code> daily at 09:00 ·
              <code class="rounded bg-secondary px-1 py-0.5">*/15 * * * *</code> every 15 min
            </p>
          </div>
        }
        @if (triggerType === 'webhook' && webhookToken) {
          <div class="mt-4">
            <label class="label">Webhook URL — POST to trigger</label>
            <code class="block select-all break-all rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-xs">
              {{ origin }}/api/hooks/{{ webhookToken }}
            </code>
          </div>
        }
        @if (triggerType === 'dataset_upload') {
          <p class="mt-4 text-xs text-muted-foreground">
            Runs automatically on every dataset upload. Steps whose dataset is set to
            "from trigger" operate on the newly uploaded data.
          </p>
        }
      </section>

      <!-- Steps -->
      <section class="card mb-4 p-5">
        <div class="mb-1 flex items-center justify-between">
          <h2 class="text-sm font-semibold">Steps</h2>
        </div>
        <p class="mb-4 text-xs text-muted-foreground">Steps run in order; if one fails the run stops and you're notified.</p>

        @for (step of steps; track $index; let i = $index) {
          <div class="mb-3 rounded-lg border border-l-2 border-border bg-background/40 p-4"
               [style.borderLeftColor]="actionColor(step.actionType)">
            <div class="mb-3.5 flex flex-wrap items-center gap-2">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    [style.background]="actionColor(step.actionType)">
                {{ i + 1 }}
              </span>
              <input class="input h-8 max-w-56 text-xs" [(ngModel)]="step.name" placeholder="Step name (optional)" />
              <span class="relative inline-flex items-center">
                <span class="pointer-events-none absolute left-2.5 z-[1] h-2 w-2 rounded-full"
                      [style.background]="actionColor(step.actionType)"></span>
                <select class="select h-8 w-48 pl-7 text-xs" [(ngModel)]="step.actionType">
                  <option value="transform" [style.color]="actionColor('transform')">Transform data</option>
                  <option value="http_request" [style.color]="actionColor('http_request')">HTTP request</option>
                  <option value="notify" [style.color]="actionColor('notify')">Send notification</option>
                  <option value="export" [style.color]="actionColor('export')">Export dataset</option>
                  <option value="delay" [style.color]="actionColor('delay')">Delay</option>
                </select>
              </span>
              <span class="ml-auto flex items-center gap-1">
                <button type="button" class="btn btn-ghost btn-icon btn-sm text-muted-foreground" (click)="move(i, -1)" [disabled]="i === 0" title="Move up">
                  <svg lucideArrowUp [size]="13"></svg>
                </button>
                <button type="button" class="btn btn-ghost btn-icon btn-sm text-muted-foreground" (click)="move(i, 1)" [disabled]="i === steps.length - 1" title="Move down">
                  <svg lucideArrowDown [size]="13"></svg>
                </button>
                <button type="button" class="btn btn-ghost btn-icon btn-sm text-muted-foreground hover:text-red-500 dark:hover:text-red-400" (click)="steps.splice(i, 1)" [disabled]="steps.length === 1" title="Remove step">
                  <svg lucideX [size]="13"></svg>
                </button>
              </span>
            </div>

            @switch (step.actionType) {
              @case ('transform') {
                <div class="mb-3">
                  <label class="label">Dataset</label>
                  <select class="select" [(ngModel)]="step.datasetId">
                    @if (triggerType === 'dataset_upload') {
                      <option value="">From trigger (uploaded dataset)</option>
                    } @else {
                      <option value="" disabled>Select a dataset…</option>
                    }
                    @for (d of datasets(); track d.id) {
                      <option [value]="d.id">{{ d.name }} ({{ d.rowCount }} rows)</option>
                    }
                  </select>
                </div>
                <label class="label">Operations</label>
                @for (op of step.operations; track $index; let j = $index) {
                  <div class="mb-2 flex flex-wrap items-center gap-2">
                    <span class="relative inline-flex items-center">
                      <span class="pointer-events-none absolute left-2.5 z-[1] h-2 w-2 rounded-full"
                            [style.background]="opColor(op.type)"></span>
                      <select class="select h-8 w-48 pl-7 text-xs" [(ngModel)]="op.type">
                        <option value="dedupe" [style.color]="opColor('dedupe')">Remove duplicates</option>
                        <option value="filter" [style.color]="opColor('filter')">Filter rows</option>
                        <option value="rename_column" [style.color]="opColor('rename_column')">Rename column</option>
                        <option value="drop_column" [style.color]="opColor('drop_column')">Drop column</option>
                        <option value="trim" [style.color]="opColor('trim')">Trim whitespace</option>
                        <option value="uppercase" [style.color]="opColor('uppercase')">Uppercase</option>
                        <option value="lowercase" [style.color]="opColor('lowercase')">Lowercase</option>
                        <option value="fill_empty" [style.color]="opColor('fill_empty')">Fill empty cells</option>
                      </select>
                    </span>
                    @if (op.type === 'filter') {
                      <input class="input h-8 w-36 text-xs" [(ngModel)]="op.column" placeholder="Column" />
                      <select class="select h-8 w-36 text-xs" [(ngModel)]="op.op">
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="contains">contains</option>
                        <option value="greater_than">greater than</option>
                        <option value="less_than">less than</option>
                        <option value="not_empty">is not empty</option>
                        <option value="is_empty">is empty</option>
                      </select>
                      @if (op.op !== 'not_empty' && op.op !== 'is_empty') {
                        <input class="input h-8 w-32 text-xs" [(ngModel)]="op.value" placeholder="Value" />
                      }
                    }
                    @if (op.type === 'rename_column') {
                      <input class="input h-8 w-36 text-xs" [(ngModel)]="op.from" placeholder="From" />
                      <input class="input h-8 w-36 text-xs" [(ngModel)]="op.to" placeholder="To" />
                    }
                    @if (['drop_column', 'trim', 'uppercase', 'lowercase'].includes(op.type)) {
                      <input class="input h-8 w-36 text-xs" [(ngModel)]="op.column" placeholder="Column" />
                    }
                    @if (op.type === 'fill_empty') {
                      <input class="input h-8 w-36 text-xs" [(ngModel)]="op.column" placeholder="Column" />
                      <input class="input h-8 w-32 text-xs" [(ngModel)]="op.value" placeholder="Fill value" />
                    }
                    <button type="button" class="btn btn-ghost btn-icon btn-sm text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                            (click)="step.operations.splice(j, 1)" [disabled]="step.operations.length === 1" title="Remove operation">
                      <svg lucideX [size]="13"></svg>
                    </button>
                  </div>
                }
                <button type="button" class="btn btn-outline btn-sm mt-1" (click)="step.operations.push(emptyOp())">
                  <svg lucidePlus></svg> Add operation
                </button>
              }
              @case ('http_request') {
                <div class="mb-3 grid grid-cols-[120px_1fr] gap-3">
                  <div>
                    <label class="label">Method</label>
                    <select class="select" [(ngModel)]="step.method">
                      <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
                    </select>
                  </div>
                  <div>
                    <label class="label">URL</label>
                    <input class="input font-mono text-xs" [(ngModel)]="step.url" placeholder="https://api.example.com/notify" />
                  </div>
                </div>
                <div>
                  <label class="label">JSON body <span class="text-muted-foreground/60">(optional)</span></label>
                  <textarea class="input font-mono text-xs" [(ngModel)]="step.body" rows="3" placeholder='{"text": "workflow done"}'></textarea>
                </div>
              }
              @case ('notify') {
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label class="label">Title</label>
                    <input class="input" [(ngModel)]="step.title" placeholder="Data processed" />
                  </div>
                  <div>
                    <label class="label">Message</label>
                    <input class="input" [(ngModel)]="step.message" placeholder="Your dataset is clean and ready." />
                  </div>
                </div>
              }
              @case ('export') {
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                  <div>
                    <label class="label">Dataset</label>
                    <select class="select" [(ngModel)]="step.datasetId">
                      @if (triggerType === 'dataset_upload') {
                        <option value="">From trigger (uploaded dataset)</option>
                      } @else {
                        <option value="" disabled>Select a dataset…</option>
                      }
                      @for (d of datasets(); track d.id) {
                        <option [value]="d.id">{{ d.name }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="label">Format</label>
                    <select class="select" [(ngModel)]="step.format">
                      <option value="xlsx">Excel</option>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>
              }
              @case ('delay') {
                <div class="max-w-40">
                  <label class="label">Seconds <span class="text-muted-foreground/60">(max 300)</span></label>
                  <input class="input" type="number" [(ngModel)]="step.seconds" min="1" max="300" />
                </div>
              }
            }
          </div>
        }
        <button type="button" class="btn btn-outline" (click)="steps.push(emptyStep())">
          <svg lucidePlus></svg> Add step
        </button>
      </section>

      <div class="flex items-center gap-2.5">
        <button class="btn btn-primary" (click)="save()" [disabled]="saving()">
          @if (saving()) {
            <svg lucideLoaderCircle class="animate-spin"></svg> Saving…
          } @else {
            {{ isEdit ? 'Save changes' : 'Create workflow' }}
          }
        </button>
        <a class="btn btn-ghost" routerLink="/workflows">Cancel</a>
        @if (error()) {
          <span class="text-xs text-err">{{ error() }}</span>
        }
      </div>
    </div>
  `,
})
export class WorkflowEditorComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  triggerTypes: { value: TriggerType; label: string; hint: string }[] = [
    { value: 'manual', label: 'Manual', hint: 'Run it from the UI or API' },
    { value: 'schedule', label: 'Schedule', hint: 'Cron-based recurring runs' },
    { value: 'webhook', label: 'Webhook', hint: 'External systems POST a URL' },
    { value: 'dataset_upload', label: 'On upload', hint: 'Runs when data is uploaded' },
  ];

  isEdit = false;
  workflowId = '';
  origin = location.origin;

  name = '';
  description = '';
  enabled = true;
  triggerType: TriggerType = 'manual';
  cron = '0 9 * * *';
  webhookToken: string | null = null;
  steps: StepForm[] = [emptyStep()];

  datasets = signal<Dataset[]>([]);
  saving = signal(false);
  error = signal('');

  emptyOp = emptyOp;
  emptyStep = emptyStep;

  opColor = opColor;
  actionColor = actionColor;

  ngOnInit(): void {
    // ?datasetId=… arrives from "Automate this dataset" — prefill the first
    // step so the user lands on a half-built workflow instead of a blank form.
    const preselected = this.route.snapshot.queryParamMap.get('datasetId');

    this.api.listDatasets().subscribe((ds) => {
      this.datasets.set(ds);
      if (preselected && !this.isEdit) {
        this.steps[0].datasetId = preselected;
        const match = ds.find((d) => d.id === preselected);
        if (match && !this.name.trim()) {
          this.name = `Clean ${match.name}`;
          this.steps[0].name = 'Clean the data';
        }
      }
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.workflowId = id;
      this.api.getWorkflow(id).subscribe((w) => {
        this.name = w.name;
        this.description = w.description;
        this.enabled = w.enabled;
        this.triggerType = w.triggerType;
        this.cron = (w.triggerConfig['cron'] as string) ?? '0 9 * * *';
        this.webhookToken = w.webhookToken ?? null;
        this.steps = w.steps.map((s) => {
          const step = emptyStep();
          step.name = s.name;
          step.actionType = s.actionType;
          const cfg = s.config ?? {};
          step.datasetId = (cfg['datasetId'] as string) ?? '';
          step.url = (cfg['url'] as string) ?? '';
          step.method = (cfg['method'] as string) ?? 'POST';
          step.body = (cfg['body'] as string) ?? '';
          step.title = (cfg['title'] as string) ?? '';
          step.message = (cfg['message'] as string) ?? '';
          step.format = (cfg['format'] as string) ?? 'xlsx';
          step.seconds = (cfg['seconds'] as number) ?? 5;
          const ops = cfg['operations'] as Partial<TransformOpForm>[] | undefined;
          if (ops?.length) {
            step.operations = ops.map((o) => ({ ...emptyOp(), ...o }));
          }
          return step;
        });
        if (this.steps.length === 0) this.steps = [emptyStep()];
      });
    }
  }

  move(i: number, dir: number): void {
    const j = i + dir;
    [this.steps[i], this.steps[j]] = [this.steps[j], this.steps[i]];
  }

  save(): void {
    if (!this.name.trim()) {
      this.error.set('Give the workflow a name.');
      return;
    }
    // Only "on upload" workflows have a dataset in the trigger payload; for every
    // other trigger a transform/export step without a dataset fails at run time.
    if (this.triggerType !== 'dataset_upload') {
      const i = this.steps.findIndex(
        (s) => (s.actionType === 'transform' || s.actionType === 'export') && !s.datasetId,
      );
      if (i >= 0) {
        const label = this.steps[i].name.trim();
        this.error.set(
          `Step ${i + 1}${label ? ` (${label})` : ''}: pick a dataset — only "On upload" workflows can take one from the trigger.`,
        );
        return;
      }
    }
    this.saving.set(true);
    this.error.set('');

    const payload = {
      name: this.name.trim(),
      description: this.description.trim(),
      enabled: this.enabled,
      triggerType: this.triggerType,
      triggerConfig: this.triggerType === 'schedule' ? { cron: this.cron.trim() } : {},
      steps: this.steps.map((s) => ({
        name: s.name.trim(),
        actionType: s.actionType,
        config: this.stepConfig(s),
      })),
    };

    const req = this.isEdit
      ? this.api.updateWorkflow(this.workflowId, payload)
      : this.api.createWorkflow(payload);

    req.subscribe({
      next: () => this.router.navigate(['/workflows']),
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Save failed.');
      },
    });
  }

  private stepConfig(s: StepForm): Record<string, unknown> {
    switch (s.actionType) {
      case 'transform':
        return {
          ...(s.datasetId ? { datasetId: s.datasetId } : {}),
          operations: s.operations.map((o) => {
            const out: Record<string, string> = { type: o.type };
            if (o.column) out['column'] = o.column;
            if (o.from) out['from'] = o.from;
            if (o.to) out['to'] = o.to;
            if (o.type === 'filter') out['op'] = o.op;
            if (o.value) out['value'] = o.value;
            return out;
          }),
        };
      case 'http_request':
        return { url: s.url.trim(), method: s.method, ...(s.body.trim() ? { body: s.body } : {}) };
      case 'notify':
        return { title: s.title.trim(), message: s.message.trim() };
      case 'export':
        return { ...(s.datasetId ? { datasetId: s.datasetId } : {}), format: s.format };
      case 'delay':
        return { seconds: Number(s.seconds) || 1 };
    }
  }
}
