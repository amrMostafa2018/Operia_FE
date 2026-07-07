import { Routes } from '@angular/router';
import { onboardingRouterGuard } from '@core/guards/onboarding-router.guard';
import { OnboardingLayoutComponent } from './onboarding-layout/onboarding-layout.component';

export const onboardingRoutes: Routes = [
  {
    path: '',
    component: OnboardingLayoutComponent,
    canActivateChild: [onboardingRouterGuard],
    children: [
      {
        path: 'setup',
        loadComponent: () =>
          import('./business-setup/business-setup.component').then(m => m.BusinessSetupComponent),
        title: 'Business Setup - Operia',
      },
      {
        path: 'plan',
        loadComponent: () =>
          import('./plan-selection/plan-selection.component').then(m => m.PlanSelectionComponent),
        title: 'Plan Selection - Operia',
      },
      {
        path: 'pending',
        redirectTo: 'plan',
        pathMatch: 'full',
      },
      {
        path: '',
        redirectTo: 'setup',
        pathMatch: 'full',
      },
    ],
  },
];
