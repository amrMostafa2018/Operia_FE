import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { LanguageService } from '@core/services/language.service';
import { OnboardingService } from '@core/services/onboarding.service';
import { OnboardingStep } from '@app/features/onboarding/models/onboarding.model';

@Component({
  selector: 'app-onboarding-pending',
  standalone: true,
  imports: [ButtonModule, TranslatePipe],
  templateUrl: './onboarding-pending.component.html',
  styleUrl: './onboarding-pending.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPendingComponent {
  private readonly router = inject(Router);
  private readonly onboardingService = inject(OnboardingService);
  private readonly languageService = inject(LanguageService);

  readonly isArabic = computed(() => this.languageService.currentLang() === 'ar');

  checkStatus(): void {
    this.onboardingService.getStatus().subscribe(status => {
      if (status.step === OnboardingStep.Active) {
        void this.router.navigate(['/dashboard']);
        return;
      }

      if (status.step === OnboardingStep.Plan) {
        void this.router.navigate(['/onboarding/plan']);
      }
    });
  }
}
