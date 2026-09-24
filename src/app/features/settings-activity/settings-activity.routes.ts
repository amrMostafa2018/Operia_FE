import { Routes } from '@angular/router';

import { Policies } from '@core/models/permissions.model';
import { permissionGuard } from '@core/guards/permission.guard';

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
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.SettingsIdentityRead, Policies.SettingsIdentityManage],
          featureKey: 'SETTINGS_ACTIVITY.PAGES.IDENTITY.TITLE',
        },
        title: 'Activity Identity - Operia',
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./payment-methods/payment-methods.component').then(
            m => m.PaymentMethodsComponent
          ),
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.SettingsPaymentsRead, Policies.SettingsPaymentsManage],
          featureKey: 'SETTINGS_ACTIVITY.PAGES.PAYMENTS.TITLE',
        },
        title: 'Payment Methods - Operia',
      },
      {
        path: 'working-days',
        loadComponent: () =>
          import('./working-days/working-days.component').then(m => m.WorkingDaysComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.SettingsWorkingDaysRead, Policies.SettingsWorkingDaysManage],
          featureKey: 'SETTINGS_ACTIVITY.PAGES.WORKING_DAYS.TITLE',
        },
        title: 'Working Days - Operia',
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./account-security/account-security.component').then(
            m => m.AccountSecurityComponent
          ),
        canActivate: [permissionGuard],
        data: {
          permissions: [
            Policies.SettingsSecurityRead,
            Policies.SettingsSecurityManage,
            Policies.SettingsPasswordChange,
            Policies.SettingsUsersBan,
            Policies.SettingsUsersDelete,
            Policies.SettingsAccountDeactivate,
          ],
          featureKey: 'SETTINGS_ACTIVITY.PAGES.SECURITY.TITLE',
        },
        title: 'Account & Security - Operia',
      },
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./settings-activity-landing.component').then(
            m => m.SettingsActivityLandingComponent
          ),
      },
    ],
  },
];
