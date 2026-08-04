import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('@app/features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadChildren: () =>
      import('@app/features/onboarding/onboarding.routes').then(m => m.onboardingRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('@app/layout/main.routes').then(m => m.mainRoutes),
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('@app/features/unauthorized/unauthorized.component').then(
        m => m.UnauthorizedComponent
      ),
    title: 'Unauthorized - Operia',
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
