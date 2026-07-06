import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

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

  /** Step 1 is complete once the user is authenticated (after login or register). */
  readonly currentStep = computed(() => (this.authService.hasActiveSession() ? 2 : 1));
}
