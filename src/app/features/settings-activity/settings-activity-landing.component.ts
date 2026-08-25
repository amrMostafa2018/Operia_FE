import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { PermissionService } from '@core/services/permission.service';
import { ACTIVITY_SETTINGS_TABS } from './models/settings-activity.model';

@Component({
  selector: 'app-settings-activity-landing',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsActivityLandingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  ngOnInit(): void {
    const firstPermittedTab = ACTIVITY_SETTINGS_TABS.find(tab =>
      this.permissionService.hasAnyPermission(...tab.permissions)
    );

    if (!firstPermittedTab) {
      this.router.navigateByUrl('/unauthorized', { replaceUrl: true });
      return;
    }

    this.router.navigate(['/settings/activity', firstPermittedTab.route], { replaceUrl: true });
  }
}
