import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';

import { Permissions, Policies } from '@core/models/permissions.model';
import { PermissionService } from '@core/services/permission.service';
import { LanguageService } from '@core/services/language.service';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  badge?: number;
  permissions?: string[];
  policies?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app-sidebar.component.html',
  styleUrl: './app-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebarComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  collapsed = input(false);
  closeSidebar = output<void>();
  toggleSidebar = output<void>();

  settingsOpen = signal(true);
  financeOpen = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly isFinanceSectionActive = computed(() => this.currentUrl().startsWith('/finance'));

  readonly isSettingsSectionActive = computed(() => {
    const url = this.currentUrl();
    return (
      url.startsWith('/settings') || url.startsWith('/employees') || url.startsWith('/packages')
    );
  });

  readonly toggleIcon = computed(() => {
    this.languageService.currentLang();
    if (this.collapsed()) {
      return this.languageService.currentLang() === 'ar'
        ? 'pi pi-angle-double-left'
        : 'pi pi-angle-double-right';
    }

    return this.languageService.currentLang() === 'ar'
      ? 'pi pi-angle-double-right'
      : 'pi pi-angle-double-left';
  });

  constructor() {
    effect(() => {
      if (this.isFinanceSectionActive()) {
        this.financeOpen.set(true);
      }
    });

    effect(() => {
      if (this.isSettingsSectionActive()) {
        this.settingsOpen.set(true);
      }
    });
  }

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
  ];

  private readonly reportsNavItem: NavItem = {
    labelKey: 'NAV.REPORTS',
    icon: 'pi pi-chart-bar',
    route: '/reports',
    permissions: [Policies.ReportsRead],
  };

  private readonly financeNavItems: NavItem[] = [
    {
      labelKey: 'NAV.ACTIVITY_REVENUE',
      icon: '',
      route: '/finance/activity-revenue',
      permissions: [Policies.RevenueRead],
    },
    {
      labelKey: 'NAV.SUBSCRIPTION',
      icon: '',
      route: '/finance/operia-subscriptions',
      permissions: [Policies.SubscriptionsManage],
    },
  ];

  private readonly settingsNavItems: NavItem[] = [
    {
      labelKey: 'NAV.SETTINGS_SECTION.ACTIVITY_IDENTITY',
      icon: '',
      route: '/settings/activity/identity',
      permissions: [Permissions.Admin.SettingsRead],
    },
    {
      labelKey: 'NAV.SETTINGS_SECTION.ACTIVITY_PAYMENTS',
      icon: '',
      route: '/settings/activity/payments',
      permissions: [Permissions.Admin.SettingsRead],
    },
    {
      labelKey: 'NAV.SETTINGS_SECTION.ACTIVITY_WORKING_DAYS',
      icon: '',
      route: '/settings/activity/working-days',
      permissions: [Permissions.Admin.SettingsRead],
    },
    {
      labelKey: 'NAV.SETTINGS_SECTION.ACTIVITY_SECURITY',
      icon: '',
      route: '/settings/activity/security',
      permissions: [Permissions.Admin.SettingsRead],
    },
    {
      labelKey: 'NAV.EMPLOYEES',
      icon: '',
      route: '/employees',
      permissions: [Permissions.Admin.EmployeesRead],
    },
    {
      labelKey: 'NAV.PACKAGES',
      icon: '',
      route: '/packages',
      permissions: [Permissions.Admin.PackagesRead],
    },
    {
      labelKey: 'NAV.BRANCHES',
      icon: '',
      route: '/branches',
      permissions: [Permissions.Admin.BranchesRead],
    },
    {
      labelKey: 'NAV.OFFERS',
      icon: '',
      route: '/settings/offers',
      permissions: [Permissions.Admin.PackagesRead],
    },
  ];

  readonly visibleMainNavItems = computed(() => this.filterByPermission(this.mainNavItems));

  readonly visibleReportsNavItem = computed(
    () => this.filterByPermission([this.reportsNavItem])[0] ?? null
  );

  readonly visibleFinanceNavItems = computed(() => this.filterByPermission(this.financeNavItems));

  readonly visibleSettingsNavItems = computed(() => this.filterByPermission(this.settingsNavItems));

  readonly showFinanceSection = computed(() => this.visibleFinanceNavItems().length > 0);

  readonly showSettingsSection = computed(() => this.visibleSettingsNavItems().length > 0);

  toggleFinance(): void {
    this.financeOpen.update(v => !v);
  }

  toggleSettings(): void {
    this.settingsOpen.update(v => !v);
  }

  onLinkClick(): void {
    this.closeSidebar.emit();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  private filterByPermission(items: NavItem[]): NavItem[] {
    return items.filter(item => {
      const requirements = item.permissions ?? item.policies;
      if (!requirements?.length) {
        return true;
      }

      return this.permissionService.hasAnyPermission(...requirements);
    });
  }
}
