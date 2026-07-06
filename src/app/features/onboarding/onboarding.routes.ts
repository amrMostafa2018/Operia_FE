import { Routes } from '@angular/router';
import { OnboardingLayoutComponent } from './onboarding-layout/onboarding-layout.component';

export const onboardingRoutes: Routes = [
  {
    path: '',
    component: OnboardingLayoutComponent,
    children: [
      {
        path: 'setup',
        loadComponent: () =>
          import('./business-setup/business-setup.component').then(m => m.BusinessSetupComponent),
        title: 'Business Setup - Operia',
      },
      {
        path: '',
        redirectTo: 'setup',
        pathMatch: 'full',
      },
    ],
  },
];
