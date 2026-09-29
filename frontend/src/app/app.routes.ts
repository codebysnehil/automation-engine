import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'datasets',
        loadComponent: () =>
          import('./features/datasets/dataset-list.component').then((m) => m.DatasetListComponent),
      },
      {
        path: 'datasets/:id',
        loadComponent: () =>
          import('./features/datasets/dataset-detail.component').then((m) => m.DatasetDetailComponent),
      },
      {
        path: 'workflows',
        loadComponent: () =>
          import('./features/workflows/workflow-list.component').then((m) => m.WorkflowListComponent),
      },
      {
        path: 'workflows/new',
        loadComponent: () =>
          import('./features/workflows/workflow-editor.component').then((m) => m.WorkflowEditorComponent),
      },
      {
        path: 'workflows/:id/edit',
        loadComponent: () =>
          import('./features/workflows/workflow-editor.component').then((m) => m.WorkflowEditorComponent),
      },
      {
        path: 'executions',
        loadComponent: () =>
          import('./features/executions/execution-list.component').then((m) => m.ExecutionListComponent),
      },
      {
        path: 'executions/:id',
        loadComponent: () =>
          import('./features/executions/execution-detail.component').then((m) => m.ExecutionDetailComponent),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
