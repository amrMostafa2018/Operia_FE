import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { OnboardingService } from '@core/services/onboarding.service';
import {
  onboardingRouteForStep,
  OnboardingStep,
} from '@app/features/onboarding/models/onboarding.model';

/**
 * Redirects authenticated users who have not completed onboarding away from the main app.
 */
export const onboardingCompleteGuard: CanActivateFn = () => {
  const onboardingService = inject(OnboardingService);
  const router = inject(Router);

  return onboardingService.getFreshStatus().pipe(
    map(status => {
      if (status.step === OnboardingStep.Active) {
        return true;
      }

      return router.createUrlTree([onboardingRouteForStep(status.step)]);
    }),
    catchError(() => of(router.createUrlTree(['/onboarding/setup'])))
  );
};
