import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBell,
  LucideCheckCheck,
  LucideCircleAlert,
  LucideDatabase,
  LucideHistory,
  LucideInbox,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideMenu,
  LucideMoon,
  LucideSun,
  LucideUsers,
  LucideWorkflow,
  LucideZap,
} from '@lucide/angular';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { AppNotification } from '../core/models';

@Component({
  selector: 'app-shell',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideZap,
    LucideLayoutDashboard,
    LucideDatabase,
    LucideWorkflow,
    LucideHistory,
    LucideUsers,
    LucideBell,
    LucideLogOut,
    LucideCheckCheck,
    LucideCircleAlert,
    LucideInbox,
    LucideSun,
    LucideMoon,
    LucideMenu,
  ],
  template: `
    <div class="flex min-h-screen">
      <!-- Mobile backdrop -->
      @if (sidebarOpen()) {
        <div class="fixed inset-0 z-30 bg-black/50 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Sidebar: fixed drawer on mobile, sticky column on desktop -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-4 transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 lg:bg-card/50"
        [class]="sidebarOpen() ? 'translate-x-0' : '-translate-x-full'"
      >
        <a routerLink="/dashboard" class="mb-6 flex items-center gap-2.5 px-2">
          <span class="brand-mark flex h-8 w-8 items-center justify-center rounded-lg text-white">
            <svg lucideZap [size]="16"></svg>
          </span>
          <span class="min-w-0">
            <span class="block text-[15px] font-semibold leading-tight tracking-tight">AutomationHub</span>
            <span class="block text-2xs text-muted-foreground">Data automation</span>
          </span>
        </a>

        <nav class="flex flex-1 flex-col gap-0.5">
          <p class="nav-group">Overview</p>
          <a routerLink="/dashboard" routerLinkActive="nav-active" (click)="sidebarOpen.set(false)" class="nav-item section-dashboard">
            <svg lucideLayoutDashboard [size]="16"></svg> Dashboard
          </a>

          <p class="nav-group">Workspace</p>
          <a routerLink="/datasets" routerLinkActive="nav-active" (click)="sidebarOpen.set(false)" class="nav-item section-datasets">
            <svg lucideDatabase [size]="16"></svg> Datasets
          </a>
          <a routerLink="/workflows" routerLinkActive="nav-active" (click)="sidebarOpen.set(false)" class="nav-item section-workflows">
            <svg lucideWorkflow [size]="16"></svg> Workflows
          </a>
          <a routerLink="/executions" routerLinkActive="nav-active" (click)="sidebarOpen.set(false)" class="nav-item section-executions">
            <svg lucideHistory [size]="16"></svg> Executions
          </a>

          @if (auth.isAdmin()) {
            <p class="nav-group">Administration</p>
            <a routerLink="/users" routerLinkActive="nav-active" (click)="sidebarOpen.set(false)" class="nav-item section-users">
              <svg lucideUsers [size]="16"></svg> Users
            </a>
          }
        </nav>

        <div class="mt-3 border-t border-border pt-3">
          <div class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50">
            <div class="brand-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xs font-bold text-white">
              {{ initials() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-medium leading-tight">{{ auth.user()?.name }}</p>
              <p class="truncate text-2xs text-muted-foreground">{{ auth.user()?.email }}</p>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm text-muted-foreground" title="Sign out" (click)="auth.logout()">
              <svg lucideLogOut [size]="14"></svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <div class="relative flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-10 flex h-13 items-center justify-between gap-1 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur sm:px-6">
          <button class="btn btn-ghost btn-icon lg:hidden" (click)="sidebarOpen.set(true)" title="Open menu">
            <svg lucideMenu [size]="17"></svg>
          </button>
          <span class="hidden lg:block"></span>
          <span class="flex items-center gap-1">
          <button class="btn btn-ghost btn-icon" (click)="theme.toggle()"
                  [title]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
            @if (theme.theme() === 'dark') {
              <svg lucideSun [size]="16"></svg>
            } @else {
              <svg lucideMoon [size]="16"></svg>
            }
          </button>
          <button class="btn btn-ghost btn-icon relative" (click)="togglePanel()" title="Notifications">
            <svg lucideBell [size]="16"></svg>
            @if (unread() > 0) {
              <span
                class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
              >
                {{ unread() > 9 ? '9+' : unread() }}
              </span>
            }
          </button>
          </span>
        </header>

        @if (panelOpen()) {
          <div class="absolute right-2 top-14 z-20 max-h-[480px] w-[calc(100vw-1rem)] max-w-96 overflow-y-auto card p-3 shadow-xl sm:right-4">
            <div class="mb-2 flex items-center justify-between px-1">
              <h3 class="text-sm font-semibold">Notifications</h3>
              <button class="btn btn-ghost btn-sm" (click)="markAllRead()">
                <svg lucideCheckCheck [size]="14"></svg> Mark all read
              </button>
            </div>
            @if (notifications().length === 0) {
              <div class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <svg lucideInbox [size]="20"></svg>
                <p class="text-xs">You're all caught up.</p>
              </div>
            }
            @for (n of notifications(); track n.id) {
              <button
                class="mb-1 flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                [class]="n.isRead ? '' : 'bg-accent/50'"
                (click)="markRead(n)"
              >
                <span
                  class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  [class]="n.kind === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-secondary text-muted-foreground'"
                >
                  @if (n.kind === 'error') {
                    <svg lucideCircleAlert [size]="13"></svg>
                  } @else {
                    <svg lucideBell [size]="13"></svg>
                  }
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2">
                    <span class="truncate text-[13px] font-medium">{{ n.title }}</span>
                    @if (!n.isRead) {
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                    }
                  </span>
                  @if (n.message) {
                    <span class="mt-0.5 block truncate text-xs text-muted-foreground">{{ n.message }}</span>
                  }
                  <span class="mt-0.5 block text-2xs text-muted-foreground/70">{{ n.createdAt | date: 'MMM d, HH:mm' }}</span>
                </span>
              </button>
            }
          </div>
        }

        <main class="flex-1">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .nav-group {
        margin: 0.875rem 0 0.25rem;
        padding: 0 0.625rem;
        font-size: 0.625rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: hsl(var(--muted-foreground) / 0.7);
      }
      .nav-group:first-child {
        margin-top: 0;
      }
      .nav-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.625rem;
        border-radius: 0.5rem;
        padding: 0.5rem 0.625rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: hsl(var(--muted-foreground));
        transition: background-color 0.15s, color 0.15s;
      }
      .nav-item:hover {
        background: hsl(var(--accent) / 0.6);
        color: hsl(var(--foreground));
      }
      .nav-item.nav-active {
        color: hsl(var(--foreground));
        font-weight: 600;
      }
      /* Active item carries a short bar in its own section colour */
      .nav-item.nav-active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        height: 1rem;
        width: 2px;
        transform: translateY(-50%);
        border-radius: 0 2px 2px 0;
        background: hsl(var(--section, var(--foreground)));
      }
      .brand-mark {
        background: linear-gradient(135deg, hsl(var(--excel)), hsl(221 83% 53%));
        box-shadow: 0 1px 2px hsl(240 10% 3.9% / 0.2);
      }
      .h-13 {
        height: 3.25rem;
      }
    `,
  ],
})
export class ShellComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  private api = inject(ApiService);

  notifications = signal<AppNotification[]>([]);
  unread = signal(0);
  panelOpen = signal(false);
  sidebarOpen = signal(false);
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), 15000);
  }

  ngOnDestroy(): void {
    clearInterval(this.pollTimer);
  }

  initials(): string {
    const name = this.auth.user()?.name ?? '';
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
    if (this.panelOpen()) this.refresh();
  }

  refresh(): void {
    this.api.listNotifications().subscribe({
      next: (res) => {
        this.notifications.set(res.notifications);
        this.unread.set(res.unread);
      },
      error: () => {},
    });
  }

  markRead(n: AppNotification): void {
    if (n.isRead) return;
    this.api.markNotificationRead(n.id).subscribe(() => this.refresh());
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe(() => this.refresh());
  }
}
