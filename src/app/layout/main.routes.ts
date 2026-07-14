import { Routes } from '@angular/router';

import { Permissions } from '@core/models/permissions.model';
import { permissionGuard } from '@core/guards/permission.guard';
import { MainLayoutComponent } from './main-layout/main-layout.component';

const placeholder = () =>
  import('@app/shared/components/feature-placeholder/feature-placeholder.component').then(
    m => m.FeaturePlaceholderComponent
  );

export const mainRoutes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('@app/features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.DashboardRead],
          featureKey: 'NAV.DASHBOARD',
        },
        title: 'Dashboard - Operia',
      },
      {
        path: 'bookings',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.BookingRead],
          featureKey: 'NAV.BOOKINGS',
        },
        title: 'Bookings - Operia',
      },
      {
        path: 'customers',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.CustomersRead],
          featureKey: 'NAV.CUSTOMERS',
        },
        title: 'Customers - Operia',
      },
      {
        path: 'employees',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.EmployeesRead],
          featureKey: 'NAV.EMPLOYEES',
        },
        title: 'Employees - Operia',
      },
      {
        path: 'packages',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.PackagesRead],
          featureKey: 'NAV.PACKAGES',
        },
        title: 'Packages - Operia',
      },
      {
        path: 'branches',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.BranchesRead],
          featureKey: 'NAV.BRANCHES',
        },
        title: 'Branches - Operia',
      },
      {
        path: 'finance/operia-subscriptions',
        loadComponent: () =>
          import('@app/features/operia-subscriptions/operia-subscriptions.component').then(
            m => m.OperiaSubscriptionsComponent
          ),
        data: {
          featureKey: 'NAV.SUBSCRIPTION',
        },
        title: 'Operia Subscriptions - Operia',
      },
      {
        path: 'finance/activity-revenue',
        loadComponent: placeholder,
        data: {
          featureKey: 'NAV.ACTIVITY_REVENUE',
        },
        title: 'Activity Revenue - Operia',
      },
      {
        path: 'reports',
        loadComponent: placeholder,
        data: {
          featureKey: 'NAV.REPORTS',
        },
        title: 'Reports - Operia',
      },
      {
        path: 'settings/activity',
        loadChildren: () =>
          import('@app/features/settings-activity/settings-activity.routes').then(
            m => m.settingsActivityRoutes
          ),
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.SettingsRead],
        },
      },
      {
        path: 'settings/offers',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.PackagesRead],
          featureKey: 'NAV.OFFERS',
        },
        title: 'Offers - Operia',
      },
      {
        path: 'settings/notifications',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.SettingsRead],
          featureKey: 'NAV.SETTINGS_SECTION.NOTIFICATIONS',
        },
        title: 'Notifications - Operia',
      },
      {
        path: 'settings/language',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Permissions.Admin.SettingsRead],
          featureKey: 'NAV.SETTINGS_SECTION.LANGUAGE',
        },
        title: 'Language & Region - Operia',
      },
      {
        path: 'support',
        loadComponent: placeholder,
        data: {
          featureKey: 'NAV.SUPPORT',
        },
        title: 'Support - Operia',
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
