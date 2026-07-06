import { Injectable, signal } from '@angular/core';

import { BusinessSetupState } from '@app/features/onboarding/models/onboarding.model';

@Injectable({ providedIn: 'root' })
export class OnboardingStateService {
  readonly businessSetup = signal<BusinessSetupState | null>(null);

  setBusinessSetup(state: BusinessSetupState): void {
    this.businessSetup.set(state);
  }

  clear(): void {
    this.businessSetup.set(null);
  }
}
