import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideLoaderCircle, LucideZap } from '@lucide/angular';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, LucideZap, LucideLoaderCircle],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-background px-6 auth-bg">
      <div class="w-full max-w-sm">
        <div class="mb-6 flex flex-col items-center gap-3">
          <a routerLink="/" class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg" title="Back to home">
            <svg lucideZap [size]="20"></svg>
          </a>
          <div class="text-center">
            <h1 class="text-lg font-semibold tracking-tight">Create your account</h1>
            <p class="mt-1 text-sm text-muted-foreground">The first user of a workspace becomes its admin</p>
          </div>
        </div>

        <form class="card p-6" (ngSubmit)="submit()">
          <div class="mb-4">
            <label class="label" for="name">Full name</label>
            <input class="input" id="name" name="name" placeholder="Ada Lovelace"
                   [(ngModel)]="name" required autocomplete="name" />
          </div>
          <div class="mb-4">
            <label class="label" for="email">Email</label>
            <input class="input" id="email" name="email" type="email" placeholder="you@company.com"
                   [(ngModel)]="email" required autocomplete="email" />
          </div>
          <div class="mb-5">
            <label class="label" for="password">Password <span class="text-muted-foreground/60">(min 8 characters)</span></label>
            <input class="input" id="password" name="password" type="password" placeholder="••••••••"
                   [(ngModel)]="password" required minlength="8" autocomplete="new-password" />
          </div>

          <button class="btn btn-primary w-full" type="submit" [disabled]="loading()">
            @if (loading()) {
              <svg lucideLoaderCircle class="animate-spin" [size]="15"></svg> Creating account…
            } @else {
              Create account
            }
          </button>
          @if (error()) {
            <p class="mt-3 text-xs text-err">{{ error() }}</p>
          }
        </form>

        <p class="mt-4 text-center text-sm text-muted-foreground">
          Already registered?
          <a routerLink="/login" class="font-medium text-foreground underline-offset-4 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit(): void {
    if (!this.name || !this.email || this.password.length < 8) {
      this.error.set('Fill in all fields; password needs at least 8 characters.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.name, this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? 'Registration failed.');
      },
    });
  }
}
