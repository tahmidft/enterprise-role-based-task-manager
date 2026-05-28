import { Routes } from '@angular/router';
import { authGuard } from '../../services/auth.guard';

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register').then(m => m.RegisterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/app-shell').then(m => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard').then(m => m.DashboardComponent),
      },
      {
        path: 'analytics',
        loadComponent: () => import('./pages/analytics').then(m => m.AnalyticsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
