import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideCheck,
  LucideClock,
  LucideDatabase,
  LucideFileSpreadsheet,
  LucideHistory,
  LucideMoon,
  LucideShieldCheck,
  LucideSun,
  LucideUpload,
  LucideWebhook,
  LucideWorkflow,
  LucideZap,
} from '@lucide/angular';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-landing',
  imports: [
    RouterLink,
    LucideZap,
    LucideArrowRight,
    LucideCheck,
    LucideFileSpreadsheet,
    LucideWorkflow,
    LucideClock,
    LucideWebhook,
    LucideHistory,
    LucideShieldCheck,
    LucideDatabase,
    LucideUpload,
    LucideSun,
    LucideMoon,
  ],
  template: `
    <div class="min-h-screen bg-background">
      <!-- ============ NAV ============ -->
      <header class="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div class="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
          <div class="flex items-center gap-8">
            <a routerLink="/" class="flex items-center gap-2.5">
              <span class="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <svg lucideZap [size]="16"></svg>
              </span>
              <span class="text-[15px] font-semibold tracking-tight">AutomationHub</span>
            </a>
            <nav class="hidden items-center gap-1 md:flex">
              <a href="#features" class="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">Features</a>
              <a href="#how-it-works" class="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">How it works</a>
              <a href="#testimonials" class="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">Customers</a>
              <a href="#pricing" class="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            </nav>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <button class="btn btn-ghost btn-icon" (click)="theme.toggle()"
                    [title]="theme.theme() === 'dark' ? 'Light mode' : 'Dark mode'">
              @if (theme.theme() === 'dark') {
                <svg lucideSun [size]="16"></svg>
              } @else {
                <svg lucideMoon [size]="16"></svg>
              }
            </button>
            @if (auth.isLoggedIn()) {
              <a class="btn btn-primary btn-sm" routerLink="/dashboard">Open dashboard <svg lucideArrowRight></svg></a>
            } @else {
              <a class="btn btn-ghost btn-sm hidden sm:inline-flex" routerLink="/login">Sign in</a>
              <a class="btn btn-primary btn-sm" routerLink="/register">Get started</a>
            }
          </div>
        </div>
      </header>

      <!-- ============ HERO ============ -->
      <section class="hero-bg relative overflow-hidden">
        <div class="mx-auto w-full max-w-6xl px-4 pt-16 text-center sm:px-8 sm:pt-24">
          <a routerLink="/register"
             class="group mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1.5 pr-3 text-xs font-medium text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground">
            <span class="rounded-full bg-excel/15 px-2 py-0.5 text-2xs font-semibold text-excel">NEW</span>
            Webhook triggers & cron scheduling are live
            <svg lucideArrowRight class="h-3 w-3 transition-transform group-hover:translate-x-0.5"></svg>
          </a>
          <h1 class="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            The automation platform<br class="hidden sm:block" />
            for <span class="hero-accent">spreadsheet data</span>
          </h1>
          <p class="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Upload Excel or CSV and get structured, typed datasets instantly. Then clean, transform,
            schedule, export and alert — with workflows your whole team can read.
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a class="btn btn-primary h-11 px-6 text-[14px]" routerLink="/register">
              Start for free <svg lucideArrowRight></svg>
            </a>
            <a class="btn btn-outline h-11 bg-background/60 px-6 text-[14px]" routerLink="/login">Sign in</a>
          </div>
          <p class="mt-4 text-xs text-muted-foreground">Free forever for individuals · No credit card required</p>

          <!-- Product mockup -->
          <div class="relative mx-auto mt-14 max-w-4xl sm:mt-16">
            <div class="mockup-glow absolute inset-0"></div>
            <div class="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <!-- browser chrome -->
              <div class="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                <span class="flex gap-1.5">
                  <span class="h-2.5 w-2.5 rounded-full bg-red-400/80"></span>
                  <span class="h-2.5 w-2.5 rounded-full bg-amber-400/80"></span>
                  <span class="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></span>
                </span>
                <span class="mx-auto flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1 font-mono text-2xs text-muted-foreground">
                  <svg lucideShieldCheck class="h-3 w-3 text-excel"></svg> app.automationhub.io
                </span>
                <span class="w-12"></span>
              </div>
              <!-- app body -->
              <div class="flex text-left">
                <!-- mini sidebar -->
                <div class="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-background/50 p-3 sm:flex">
                  <div class="mb-3 flex items-center gap-2 px-2">
                    <span class="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground">
                      <svg lucideZap class="h-2.5 w-2.5"></svg>
                    </span>
                    <span class="text-xs font-semibold">AutomationHub</span>
                  </div>
                  <span class="flex items-center gap-2 rounded-md bg-violet-500/10 px-2 py-1.5 text-xs font-medium">
                    <span class="h-1.5 w-1.5 rounded-full bg-violet-500"></span> Dashboard
                  </span>
                  <span class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                    <span class="h-1.5 w-1.5 rounded-full bg-excel"></span> Datasets
                  </span>
                  <span class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                    <span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span> Workflows
                  </span>
                  <span class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                    <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Executions
                  </span>
                </div>
                <!-- mini main -->
                <div class="min-w-0 flex-1 p-4 sm:p-5">
                  <p class="text-sm font-semibold">Dashboard</p>
                  <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div class="rounded-lg border border-border p-2.5">
                      <p class="text-2xs text-muted-foreground">Datasets</p>
                      <p class="mt-0.5 text-lg font-bold">24</p>
                    </div>
                    <div class="rounded-lg border border-border p-2.5">
                      <p class="text-2xs text-muted-foreground">Rows stored</p>
                      <p class="mt-0.5 text-lg font-bold">1.2M</p>
                    </div>
                    <div class="rounded-lg border border-border p-2.5">
                      <p class="text-2xs text-muted-foreground">Workflows</p>
                      <p class="mt-0.5 text-lg font-bold">18</p>
                    </div>
                    <div class="rounded-lg border border-border p-2.5">
                      <p class="text-2xs text-muted-foreground">Success rate</p>
                      <p class="mt-0.5 text-lg font-bold text-ok">99.4%</p>
                    </div>
                  </div>
                  <div class="mt-3 overflow-hidden rounded-lg border border-border">
                    <div class="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
                      <span class="text-xs font-medium">Recent executions</span>
                    </div>
                    <div class="divide-y divide-border">
                      <div class="flex items-center gap-2.5 px-3 py-2">
                        <span class="badge badge-success !py-0 text-2xs"><span class="dot"></span>success</span>
                        <span class="truncate text-xs font-medium">Clean incoming orders</span>
                        <span class="ml-auto shrink-0 font-mono text-2xs text-muted-foreground">1.2 s</span>
                      </div>
                      <div class="flex items-center gap-2.5 px-3 py-2">
                        <span class="badge badge-success !py-0 text-2xs"><span class="dot"></span>success</span>
                        <span class="truncate text-xs font-medium">Nightly inventory sync</span>
                        <span class="ml-auto shrink-0 font-mono text-2xs text-muted-foreground">0.8 s</span>
                      </div>
                      <div class="flex items-center gap-2.5 px-3 py-2">
                        <span class="badge badge-running !py-0 text-2xs"><span class="dot"></span>running</span>
                        <span class="truncate text-xs font-medium">Weekly revenue export</span>
                        <span class="ml-auto shrink-0 font-mono text-2xs text-muted-foreground">…</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Social proof -->
        <div class="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:px-8">
          <p class="text-center text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Powering data operations at
          </p>
          <div class="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-60">
            <span class="text-sm font-bold tracking-widest">NORTHWIND</span>
            <span class="font-serif text-sm font-semibold italic tracking-wide">Globex&nbsp;Corp</span>
            <span class="text-sm font-extrabold tracking-tight">initech</span>
            <span class="text-sm font-semibold tracking-[0.25em]">ACME</span>
            <span class="font-mono text-sm font-bold">stark.io</span>
            <span class="text-sm font-black uppercase italic">Wayne&nbsp;Co</span>
          </div>
        </div>
      </section>

      <!-- ============ FEATURES (bento) ============ -->
      <section id="features" class="border-t border-border bg-card/30">
        <div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <div class="mb-12 max-w-2xl">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-excel">Platform</p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Everything between raw spreadsheet<br class="hidden sm:block" /> and finished automation
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
              One tool replaces the copy-paste, the one-off scripts and the "final_v3_REAL.xlsx" emails.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <!-- Ingestion — wide -->
            <div class="card p-6 md:col-span-2">
              <div class="flex flex-wrap items-start justify-between gap-6">
                <div class="max-w-xs">
                  <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-excel/15 text-excel">
                    <svg lucideFileSpreadsheet [size]="17"></svg>
                  </span>
                  <h3 class="text-[15px] font-semibold">Instant Excel & CSV ingestion</h3>
                  <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    Drop a file and get a searchable, sortable dataset. Column types — number, boolean,
                    date — are inferred automatically from your data.
                  </p>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="overflow-hidden rounded-lg border border-border text-2xs">
                    <div class="grid grid-cols-3 border-b border-border bg-muted/40 font-medium text-muted-foreground">
                      <span class="px-2.5 py-1.5">CUSTOMER <span class="type-chip">string</span></span>
                      <span class="px-2.5 py-1.5">AMOUNT <span class="type-chip">number</span></span>
                      <span class="px-2.5 py-1.5">PAID <span class="type-chip">boolean</span></span>
                    </div>
                    <div class="grid grid-cols-3 border-b border-border">
                      <span class="px-2.5 py-1.5">Acme Corp</span><span class="px-2.5 py-1.5 font-mono">2,499.50</span><span class="px-2.5 py-1.5 text-ok">true</span>
                    </div>
                    <div class="grid grid-cols-3">
                      <span class="px-2.5 py-1.5">Globex</span><span class="px-2.5 py-1.5 font-mono">1,150.00</span><span class="px-2.5 py-1.5 text-muted-foreground">false</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Scheduling -->
            <div class="card p-6">
              <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <svg lucideClock [size]="17"></svg>
              </span>
              <h3 class="text-[15px] font-semibold">Cron scheduling</h3>
              <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Nightly cleanups, hourly syncs, monthly reports — the scheduler stays in sync with your workflows in real time.
              </p>
              <code class="mt-4 block w-fit rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-xs">0 9 * * mon-fri</code>
            </div>

            <!-- Workflow builder -->
            <div class="card p-6">
              <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <svg lucideWorkflow [size]="17"></svg>
              </span>
              <h3 class="text-[15px] font-semibold">Readable workflows</h3>
              <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Color-coded steps anyone on the team can follow — dedupe, filter, rename, export, notify.
              </p>
              <div class="mt-4 flex flex-wrap items-center gap-1.5 text-2xs font-medium">
                <span class="step-chip"><span class="h-1.5 w-1.5 rounded-full bg-violet-500"></span> Dedupe</span>
                <span class="text-muted-foreground">→</span>
                <span class="step-chip"><span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span> Filter</span>
                <span class="text-muted-foreground">→</span>
                <span class="step-chip"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Export</span>
              </div>
            </div>

            <!-- Webhooks -->
            <div class="card p-6">
              <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <svg lucideWebhook [size]="17"></svg>
              </span>
              <h3 class="text-[15px] font-semibold">Webhook triggers</h3>
              <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Every workflow can expose a secret URL. Fire it from CI, Zapier, or any system that can POST.
              </p>
              <code class="mt-4 block w-full overflow-x-auto whitespace-nowrap rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-2xs text-muted-foreground">curl -X POST /api/hooks/f3a9…</code>
            </div>

            <!-- History -->
            <div class="card p-6">
              <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <svg lucideHistory [size]="17"></svg>
              </span>
              <h3 class="text-[15px] font-semibold">Full audit trail</h3>
              <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Per-step logs, durations and errors for every run — with alerts the moment something fails.
              </p>
              <div class="mt-4 space-y-1 font-mono text-2xs text-muted-foreground">
                <p><span class="text-ok">✓</span> step 1 (dedupe) — 50 → 45 rows</p>
                <p><span class="text-ok">✓</span> step 2 (export) — orders.xlsx</p>
              </div>
            </div>

            <!-- Roles -->
            <div class="card p-6">
              <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <svg lucideShieldCheck [size]="17"></svg>
              </span>
              <h3 class="text-[15px] font-semibold">Built for teams</h3>
              <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                JWT auth with admin and member roles. Members see their own work; admins govern the whole workspace.
              </p>
              <div class="mt-4 flex -space-x-2">
                <span class="avatar bg-violet-500">AS</span>
                <span class="avatar bg-excel">DP</span>
                <span class="avatar bg-blue-500">MK</span>
                <span class="avatar bg-amber-500">+5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ HOW IT WORKS ============ -->
      <section id="how-it-works" class="border-t border-border">
        <div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <div class="mb-12 text-center">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-excel">How it works</p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">From file to automation in minutes</h2>
          </div>
          <div class="relative grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            <div class="steps-line absolute left-0 right-0 top-6 hidden sm:block"></div>
            <div class="relative text-center">
              <span class="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-excel/30 bg-background text-excel shadow-sm">
                <svg lucideUpload [size]="18"></svg>
              </span>
              <h3 class="text-sm font-semibold">1 · Upload</h3>
              <p class="mx-auto mt-2 max-w-64 text-[13px] leading-relaxed text-muted-foreground">
                Drag in any .xlsx or .csv — it becomes a typed, queryable dataset in seconds.
              </p>
            </div>
            <div class="relative text-center">
              <span class="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/30 bg-background text-blue-600 shadow-sm dark:text-blue-400">
                <svg lucideWorkflow [size]="18"></svg>
              </span>
              <h3 class="text-sm font-semibold">2 · Automate</h3>
              <p class="mx-auto mt-2 max-w-64 text-[13px] leading-relaxed text-muted-foreground">
                Compose a workflow: pick a trigger, stack transform steps, add exports and alerts.
              </p>
            </div>
            <div class="relative text-center">
              <span class="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-violet-500/30 bg-background text-violet-600 shadow-sm dark:text-violet-400">
                <svg lucideDatabase [size]="18"></svg>
              </span>
              <h3 class="text-sm font-semibold">3 · Relax</h3>
              <p class="mx-auto mt-2 max-w-64 text-[13px] leading-relaxed text-muted-foreground">
                Runs fire on schedule, on upload or on demand — with full logs and instant alerts.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ TESTIMONIALS ============ -->
      <section id="testimonials" class="border-t border-border bg-card/30">
        <div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <div class="mb-12 text-center">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-excel">Customers</p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Loved by the people who own the data</h2>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <figure class="card p-6">
              <blockquote class="text-[13.5px] leading-relaxed">
                "We replaced a folder of fragile Python scripts with three workflows. The ops team
                edits them without ever pinging engineering."
              </blockquote>
              <figcaption class="mt-5 flex items-center gap-3">
                <span class="avatar bg-violet-500">PS</span>
                <span>
                  <span class="block text-[13px] font-semibold">Priya Sharma</span>
                  <span class="block text-xs text-muted-foreground">Operations Lead, Northwind</span>
                </span>
              </figcaption>
            </figure>
            <figure class="card p-6">
              <blockquote class="text-[13.5px] leading-relaxed">
                "The type inference alone saves us hours — booleans, dates, numbers all land correctly.
                Exports round-trip cleanly back to Excel for finance."
              </blockquote>
              <figcaption class="mt-5 flex items-center gap-3">
                <span class="avatar bg-excel">DP</span>
                <span>
                  <span class="block text-[13px] font-semibold">Daniel Park</span>
                  <span class="block text-xs text-muted-foreground">Data Engineer, Globex Corp</span>
                </span>
              </figcaption>
            </figure>
            <figure class="card p-6">
              <blockquote class="text-[13.5px] leading-relaxed">
                "Webhook triggers plugged straight into our CI. Every deploy pushes fresh data through
                a cleanup pipeline before it ever reaches a dashboard."
              </blockquote>
              <figcaption class="mt-5 flex items-center gap-3">
                <span class="avatar bg-blue-500">MK</span>
                <span>
                  <span class="block text-[13px] font-semibold">Maya Krishnan</span>
                  <span class="block text-xs text-muted-foreground">Platform Engineer, initech</span>
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <!-- ============ PRICING ============ -->
      <section id="pricing" class="border-t border-border">
        <div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
          <div class="mb-12 text-center">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-excel">Pricing</p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Start free, scale when you do</h2>
          </div>
          <div class="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
            <div class="card flex flex-col p-6">
              <h3 class="text-sm font-semibold">Free</h3>
              <p class="mt-3 text-3xl font-bold">$0<span class="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p class="mt-1 text-xs text-muted-foreground">For individuals and side projects</p>
              <ul class="mt-5 flex-1 space-y-2.5 text-[13px]">
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Unlimited datasets</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> 5 workflows</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> All trigger types</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> 7-day run history</li>
              </ul>
              <a class="btn btn-outline mt-6 w-full" routerLink="/register">Get started</a>
            </div>
            <div class="card relative flex flex-col border-excel/40 p-6 shadow-lg">
              <span class="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-excel px-2.5 py-0.5 text-2xs font-semibold text-white">MOST POPULAR</span>
              <h3 class="text-sm font-semibold">Pro</h3>
              <p class="mt-3 text-3xl font-bold">$29<span class="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p class="mt-1 text-xs text-muted-foreground">For teams automating for real</p>
              <ul class="mt-5 flex-1 space-y-2.5 text-[13px]">
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Everything in Free</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Unlimited workflows</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Email notifications</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Unlimited run history</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Priority execution</li>
              </ul>
              <a class="btn btn-primary mt-6 w-full" routerLink="/register">Start 14-day trial</a>
            </div>
            <div class="card flex flex-col p-6">
              <h3 class="text-sm font-semibold">Enterprise</h3>
              <p class="mt-3 text-3xl font-bold">Custom</p>
              <p class="mt-1 text-xs text-muted-foreground">For compliance-heavy orgs</p>
              <ul class="mt-5 flex-1 space-y-2.5 text-[13px]">
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Everything in Pro</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Self-hosted deployment</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> SSO & audit exports</li>
                <li class="flex items-center gap-2"><svg lucideCheck class="h-3.5 w-3.5 text-excel"></svg> Dedicated support</li>
              </ul>
              <a class="btn btn-outline mt-6 w-full" routerLink="/register">Contact sales</a>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ CTA ============ -->
      <section class="border-t border-border">
        <div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8">
          <div class="cta-panel relative overflow-hidden rounded-2xl border border-border px-6 py-12 text-center sm:py-16">
            <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">Your spreadsheets are ready to work for you</h2>
            <p class="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Create a workspace in under a minute. The first account becomes the admin.
            </p>
            <a class="btn btn-primary mt-7 h-11 px-7" routerLink="/register">
              Create your workspace <svg lucideArrowRight></svg>
            </a>
          </div>
        </div>
      </section>

      <!-- ============ FOOTER ============ -->
      <footer class="border-t border-border">
        <div class="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
          <div class="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
            <div class="col-span-2 sm:col-span-4 lg:col-span-2">
              <span class="flex items-center gap-2.5">
                <span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <svg lucideZap [size]="14"></svg>
                </span>
                <span class="text-sm font-semibold">AutomationHub</span>
              </span>
              <p class="mt-3 max-w-60 text-xs leading-relaxed text-muted-foreground">
                The end-to-end automation platform for spreadsheet data. Built with Angular, Go and PostgreSQL.
              </p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</p>
              <ul class="mt-3 space-y-2 text-[13px]">
                <li><a href="#features" class="text-muted-foreground transition-colors hover:text-foreground">Features</a></li>
                <li><a href="#pricing" class="text-muted-foreground transition-colors hover:text-foreground">Pricing</a></li>
                <li><a href="#how-it-works" class="text-muted-foreground transition-colors hover:text-foreground">How it works</a></li>
                <li><a routerLink="/register" class="text-muted-foreground transition-colors hover:text-foreground">Sign up</a></li>
              </ul>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resources</p>
              <ul class="mt-3 space-y-2 text-[13px]">
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">Documentation</a></li>
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">API reference</a></li>
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">Changelog</a></li>
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">Status</a></li>
              </ul>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</p>
              <ul class="mt-3 space-y-2 text-[13px]">
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">About</a></li>
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">Careers</a></li>
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">Privacy</a></li>
                <li><a href="#" class="text-muted-foreground transition-colors hover:text-foreground">Terms</a></li>
              </ul>
            </div>
          </div>
          <div class="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <span>© 2026 AutomationHub, Inc. All rights reserved.</span>
            <span class="flex items-center gap-1.5">
              <span class="h-1.5 w-1.5 rounded-full bg-excel"></span> All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      .hero-bg {
        background-image:
          radial-gradient(800px 400px at 50% -10%, hsl(var(--excel) / 0.13), transparent),
          linear-gradient(hsl(var(--border) / 0.35) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--border) / 0.35) 1px, transparent 1px);
        background-size:
          auto,
          56px 56px,
          56px 56px;
        -webkit-mask-image: linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
        mask-image: linear-gradient(to bottom, black 0%, black 75%, transparent 100%);
      }
      .hero-accent {
        background: linear-gradient(120deg, hsl(var(--excel)), hsl(152 60% 55%));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .mockup-glow {
        background: radial-gradient(60% 60% at 50% 40%, hsl(var(--excel) / 0.18), transparent 70%);
        filter: blur(40px);
      }
      .type-chip {
        display: inline-block;
        margin-left: 4px;
        border-radius: 4px;
        border: 1px solid hsl(var(--border));
        padding: 0 4px;
        font-size: 9px;
        text-transform: lowercase;
        color: hsl(var(--muted-foreground));
      }
      .step-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 6px;
        border: 1px solid hsl(var(--border));
        background: hsl(var(--secondary) / 0.5);
        padding: 3px 8px;
      }
      .avatar {
        display: inline-flex;
        height: 28px;
        width: 28px;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        border: 2px solid hsl(var(--card));
        font-size: 10px;
        font-weight: 700;
        color: #fff;
      }
      .steps-line {
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent,
          hsl(var(--border)) 15%,
          hsl(var(--border)) 85%,
          transparent
        );
      }
      .cta-panel {
        background:
          radial-gradient(400px 200px at 50% 0%, hsl(var(--excel) / 0.12), transparent),
          hsl(var(--card) / 0.5);
      }
      html {
        scroll-behavior: smooth;
      }
    `,
  ],
})
export class LandingComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
}
