import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';

import { AuthService } from '@core/services/auth.service';
import { LanguageSwitcherComponent } from '@app/shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-onboarding-layout',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './onboarding-layout.component.html',
  styleUrl: './onboarding-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly currentStep = computed(() => {
    if (!this.authService.hasActiveSession()) {
      return 1;
    }

    const url = this.currentUrl();
    if (url.includes('/onboarding/plan') || url.includes('/onboarding/pending')) {
      return 3;
    }

    return 2;
  });
}
