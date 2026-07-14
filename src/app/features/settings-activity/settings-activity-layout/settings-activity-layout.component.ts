import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';

import { ACTIVITY_SETTINGS_TABS } from '../models/settings-activity.model';

@Component({
  selector: 'app-settings-activity-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './settings-activity-layout.component.html',
  styleUrl: './settings-activity-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsActivityLayoutComponent {
  private readonly router = inject(Router);

  readonly tabs = ACTIVITY_SETTINGS_TABS;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly activeTab = computed(() => {
    const url = this.currentUrl();
    return this.tabs.find(tab => url.includes(`/settings/activity/${tab.route}`)) ?? this.tabs[0];
  });
}
