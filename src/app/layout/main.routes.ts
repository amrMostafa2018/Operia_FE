import { Routes } from '@angular/router';

import { Policies } from '@core/models/permissions.model';
import { permissionGuard } from '@core/guards/permission.guard';
import { onboardingCompleteGuard } from '@core/guards/onboarding-complete.guard';
import { MainLayoutComponent } from './main-layout/main-layout.component';

const placeholder = () =>
  import('@app/shared/components/feature-placeholder/feature-placeholder.component').then(
    m => m.FeaturePlaceholderComponent
  );

export const mainRoutes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivateChild: [onboardingCompleteGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('@app/features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.DashboardRead],
          featureKey: 'NAV.DASHBOARD',
        },
        title: 'Dashboard - Operia',
      },
      {
        path: 'bookings',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.BookingsRead],
          featureKey: 'NAV.BOOKINGS',
        },
        title: 'Bookings - Operia',
      },
      {
        path: 'customers',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.CustomersRead],
          featureKey: 'NAV.CUSTOMERS',
        },
        title: 'Customers - Operia',
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('@app/features/employees/employees.component').then(m => m.EmployeesComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.EmployeesRead],
          featureKey: 'NAV.EMPLOYEES',
        },
        title: 'Employees - Operia',
      },
      {
        path: 'packages',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.PackagesRead],
          featureKey: 'NAV.PACKAGES',
        },
        title: 'Packages - Operia',
      },
      {
        path: 'branches',
        loadComponent: () =>
          import('@app/features/branches/branches.component').then(m => m.BranchesComponent),
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.BranchesRead],
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
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.SubscriptionsRead],
          featureKey: 'NAV.SUBSCRIPTION',
        },
        title: 'Operia Subscriptions - Operia',
      },
      {
        path: 'finance/activity-revenue',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.RevenueRead],
          featureKey: 'NAV.ACTIVITY_REVENUE',
        },
        title: 'Activity Revenue - Operia',
      },
      {
        path: 'reports',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.ReportsRead],
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
          permissions: [Policies.SettingsManage],
        },
      },
      {
        path: 'settings/offers',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.PackagesRead],
          featureKey: 'NAV.OFFERS',
        },
        title: 'Offers - Operia',
      },
      {
        path: 'settings/notifications',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.SettingsManage],
          featureKey: 'NAV.SETTINGS_SECTION.NOTIFICATIONS',
        },
        title: 'Notifications - Operia',
      },
      {
        path: 'settings/language',
        loadComponent: placeholder,
        canActivate: [permissionGuard],
        data: {
          permissions: [Policies.SettingsManage],
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
