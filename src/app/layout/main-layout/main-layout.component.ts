import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppSidebarComponent } from '@app/layout/components/app-sidebar/app-sidebar.component';
import { AppHeaderComponent } from '@app/layout/components/app-header/app-header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AppSidebarComponent, AppHeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);

  toggleSidebar(): void {
    if (window.innerWidth <= 992) {
      this.mobileOpen.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }

  closeMobileSidebar(): void {
    this.mobileOpen.set(false);
  }
}
