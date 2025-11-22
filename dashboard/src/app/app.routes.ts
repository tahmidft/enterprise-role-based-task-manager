import { Routes } from '@angular/router';
import { authGuard } from '../../services/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
