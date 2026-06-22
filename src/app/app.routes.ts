import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  // Dashboard and other protected routes will be added here
  // {
  //   path: 'dashboard',
  //   canActivate: [authGuard],
  //   loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.dashboardRoutes),
  // },
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
