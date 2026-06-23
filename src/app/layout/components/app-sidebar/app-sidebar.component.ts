import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  badge?: number;
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
  collapsed = input(false);
  closeSidebar = output<void>();

  settingsOpen = false;

  readonly mainNav: NavGroup = {
    items: [
      { labelKey: 'NAV.DASHBOARD', icon: 'pi pi-home',        route: '/dashboard' },
      { labelKey: 'NAV.BOOKINGS',  icon: 'pi pi-calendar',    route: '/bookings' },
      { labelKey: 'NAV.CUSTOMERS', icon: 'pi pi-users',        route: '/customers' },
      { labelKey: 'NAV.EMPLOYEES', icon: 'pi pi-id-card',      route: '/employees' },
      { labelKey: 'NAV.PACKAGES',  icon: 'pi pi-tag',          route: '/packages' },
      { labelKey: 'NAV.BRANCHES',  icon: 'pi pi-building',     route: '/branches' },
      { labelKey: 'NAV.PAYMENTS',  icon: 'pi pi-credit-card',  route: '/payments', badge: 2 },
      { labelKey: 'NAV.REPORTS',   icon: 'pi pi-chart-bar',    route: '/reports' },
    ],
  };

  readonly settingsNav: NavGroup = {
    titleKey: 'NAV.SETTINGS',
    items: [
      { labelKey: 'NAV.SETTINGS_SECTION.BUSINESS_IDENTITY', icon: 'pi pi-briefcase',   route: '/settings/identity' },
      { labelKey: 'NAV.SETTINGS_SECTION.PAYMENT_METHODS',   icon: 'pi pi-wallet',       route: '/settings/payments' },
      { labelKey: 'NAV.SETTINGS_SECTION.NOTIFICATIONS',     icon: 'pi pi-bell',         route: '/settings/notifications' },
      { labelKey: 'NAV.SETTINGS_SECTION.LANGUAGE',          icon: 'pi pi-globe',        route: '/settings/language' },
    ],
  };

  toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen;
  }

  onLinkClick(): void {
    this.closeSidebar.emit();
  }
}
