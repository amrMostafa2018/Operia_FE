import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { onboardingCompleteGuard } from './core/guards/onboarding-complete.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/onboarding/onboarding.routes').then(m => m.onboardingRoutes),
  },
  {
    path: '',
    canActivate: [authGuard, onboardingCompleteGuard],
    loadChildren: () =>
      import('./layout/main.routes').then(m => m.mainRoutes),
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
