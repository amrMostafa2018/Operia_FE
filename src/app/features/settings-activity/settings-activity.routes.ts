import { Routes } from '@angular/router';

import { SettingsActivityLayoutComponent } from './settings-activity-layout/settings-activity-layout.component';

export const settingsActivityRoutes: Routes = [
  {
    path: '',
    component: SettingsActivityLayoutComponent,
    children: [
      {
        path: 'identity',
        loadComponent: () =>
          import('./identity-content/identity-content.component').then(
            m => m.IdentityContentComponent
          ),
        title: 'Activity Identity - Operia',
        data: { featureKey: 'SETTINGS_ACTIVITY.PAGES.IDENTITY.TITLE' },
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./payment-methods/payment-methods.component').then(
            m => m.PaymentMethodsComponent
          ),
        title: 'Payment Methods - Operia',
        data: { featureKey: 'SETTINGS_ACTIVITY.PAGES.PAYMENTS.TITLE' },
      },
      {
        path: 'working-days',
        loadComponent: () =>
          import('./working-days/working-days.component').then(m => m.WorkingDaysComponent),
        title: 'Working Days - Operia',
        data: { featureKey: 'SETTINGS_ACTIVITY.PAGES.WORKING_DAYS.TITLE' },
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./account-security/account-security.component').then(
            m => m.AccountSecurityComponent
          ),
        title: 'Account & Security - Operia',
        data: { featureKey: 'SETTINGS_ACTIVITY.PAGES.SECURITY.TITLE' },
      },
      {
        path: '',
        redirectTo: 'identity',
        pathMatch: 'full',
      },
    ],
  },
];
