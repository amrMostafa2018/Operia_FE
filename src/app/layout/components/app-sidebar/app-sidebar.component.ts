import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Permissions } from '../../../core/models/permissions.model';
import { AuthStore } from '../../../core/store/auth.store';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  badge?: number;
  permissions?: string[];
}

interface NavGroup {
  titleKey?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.scss',
})
export class AppSidebarComponent {
  private readonly authStore = inject(AuthStore);

  collapsed = input(false);
  closeSidebar = output<void>();

  settingsOpen = false;

  private readonly mainNavItems: NavItem[] = [
    {
      labelKey: 'NAV.DASHBOARD',
      icon: 'pi pi-home',
      route: '/dashboard',
      permissions: [Permissions.Admin.DashboardRead],
    },
    {
      labelKey: 'NAV.BOOKINGS',
      icon: 'pi pi-calendar',
      route: '/bookings',
      permissions: [Permissions.Admin.BookingRead],
    },
    {
      labelKey: 'NAV.CUSTOMERS',
      icon: 'pi pi-users',
      route: '/customers',
      permissions: [Permissions.Admin.CustomersRead],
    },
    {
      labelKey: 'NAV.EMPLOYEES',
      icon: 'pi pi-id-card',
      route: '/employees',
      permissions: [Permissions.Admin.EmployeesRead],
    },
    {
      labelKey: 'NAV.PACKAGES',
      icon: 'pi pi-tag',
      route: '/packages',
      permissions: [Permissions.Admin.PackagesRead],
    },
    {
      labelKey: 'NAV.BRANCHES',
      icon: 'pi pi-building',
      route: '/branches',
      permissions: [Permissions.Admin.BranchesRead],
    },
    /*
    {
      labelKey: 'NAV.PAYMENTS',
      icon: 'pi pi-credit-card',
      route: '/payments',
      badge: 2,
      permissions: [Permissions.Admin.Read],
    },
    {
      labelKey: 'NAV.REPORTS',
      icon: 'pi pi-chart-bar',
      route: '/reports',
      permissions: [Permissions.Admin.Read, Permissions.Staff.Read],
    },*/
  ];

  private readonly settingsNavItems: NavItem[] = [
    {
      labelKey: 'NAV.SETTINGS_SECTION.BUSINESS_IDENTITY',
      icon: 'pi pi-briefcase',
      route: '/settings/identity',
      permissions: [Permissions.Admin.SettingsRead],
    },
    {
      labelKey: 'NAV.SETTINGS_SECTION.PAYMENT_METHODS',
      icon: 'pi pi-wallet',
      route: '/settings/payments',
      permissions: [Permissions.Admin.SettingsRead],
    },
    {
      labelKey: 'NAV.SETTINGS_SECTION.NOTIFICATIONS',
      icon: 'pi pi-bell',
      route: '/settings/notifications',
      permissions: [Permissions.Admin.SettingsRead],
    },
    {
      labelKey: 'NAV.SETTINGS_SECTION.LANGUAGE',
      icon: 'pi pi-globe',
      route: '/settings/language',
      permissions: [Permissions.Admin.SettingsRead],
    },
  ];

  readonly visibleMainNavItems = computed(() =>
    this.filterByPermission(this.mainNavItems)
  );

  readonly visibleSettingsNavItems = computed(() =>
    this.filterByPermission(this.settingsNavItems)
  );

  readonly showSettingsSection = computed(() =>
    this.visibleSettingsNavItems().length > 0
  );

  toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen;
  }

  onLinkClick(): void {
    this.closeSidebar.emit();
  }

  private filterByPermission(items: NavItem[]): NavItem[] {
    const userPermissions = this.authStore.permissions();

    return items.filter((item) => {
      if (!item.permissions?.length) {
        return true;
      }

      return item.permissions.some((permission) => userPermissions.includes(permission));
    });
  }
}
