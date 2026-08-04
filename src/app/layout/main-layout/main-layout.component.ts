import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';

import { AppSidebarComponent } from '@app/layout/components/app-sidebar/app-sidebar.component';
import { AppHeaderComponent } from '@app/layout/components/app-header/app-header.component';
import { OnboardingService } from '@core/services/onboarding.service';
import {
  onboardingRouteForStep,
  OnboardingStep,
} from '@app/features/onboarding/models/onboarding.model';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AppSidebarComponent, AppHeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnDestroy {
  private readonly onboardingService = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private pollHandle?: ReturnType<typeof setInterval>;

  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (!this.getIsMobileView()) {
          this.mobileOpen.set(false);
        }
      });
    }

    this.pollHandle = setInterval(() => this.checkSubscriptionExpiry(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
  }

  toggleSidebar(): void {
    if (this.getIsMobileView()) {
      this.mobileOpen.update(v => !v);
      return;
    }

    this.sidebarCollapsed.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.mobileOpen.set(false);
  }

  private checkSubscriptionExpiry(): void {
    this.onboardingService
      .getFreshStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(status => {
        if (status.step !== OnboardingStep.Active) {
          void this.router.navigateByUrl(onboardingRouteForStep(status.step));
        }
      });
  }

  private getIsMobileView(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 992;
  }
}
