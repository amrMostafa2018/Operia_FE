import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'onboarding',
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then(m => m.onboardingRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./layout/main.routes').then(m => m.mainRoutes),
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
