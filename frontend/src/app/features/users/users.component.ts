import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideShieldCheck, LucideTrash2, LucideUsers } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, LucideShieldCheck, LucideTrash2, LucideUsers],
  template: `
    <div class="page !pt-0">
      <div class="section-hero section-users flex items-start gap-3.5">
        <span class="section-tile mt-0.5">
          <svg lucideUsers [size]="20"></svg>
        </span>
        <div>
          <h1 class="page-title">Users</h1>
          <p class="page-sub">Manage accounts and roles — admin only</p>
        </div>
      </div>

      <div class="table-shell">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td>
                  <span class="flex items-center gap-2.5">
                    <span class="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-2xs font-semibold">
                      {{ initials(u.name) }}
                    </span>
                    <span class="font-medium">{{ u.name }}</span>
                    @if (u.id === auth.user()?.id) {
                      <span class="text-xs text-muted-foreground">(you)</span>
                    }
                  </span>
                </td>
                <td class="text-muted-foreground">{{ u.email }}</td>
                <td>
                  @if (u.id === auth.user()?.id) {
                    <span class="badge badge-info"><svg lucideShieldCheck [size]="11"></svg>{{ u.role }}</span>
                  } @else {
                    <select class="select h-8 w-28 text-xs" [ngModel]="u.role" (ngModelChange)="changeRole(u, $event)">
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  }
                </td>
                <td class="text-muted-foreground">{{ u.createdAt | date: 'MMM d, y' }}</td>
                <td class="text-right">
                  @if (u.id !== auth.user()?.id) {
                    <button class="btn btn-ghost btn-icon btn-sm text-muted-foreground hover:text-red-500 dark:hover:text-red-400" (click)="remove(u)" title="Delete user">
                      <svg lucideTrash2 [size]="14"></svg>
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (error()) {
        <p class="mt-3 text-xs text-err">{{ error() }}</p>
      }
    </div>
  `,
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  users = signal<User[]>([]);
  error = signal('');

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.api.listUsers().subscribe((us) => this.users.set(us));
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  changeRole(u: User, role: string): void {
    this.api.updateUserRole(u.id, role).subscribe({
      next: () => this.refresh(),
      error: (err) => this.error.set(err?.error?.error ?? 'Role update failed'),
    });
  }

  remove(u: User): void {
    if (!confirm(`Delete user ${u.email}? Their datasets and workflows will be removed too.`)) return;
    this.api.deleteUser(u.id).subscribe({
      next: () => this.refresh(),
      error: (err) => this.error.set(err?.error?.error ?? 'Delete failed'),
    });
  }
}
