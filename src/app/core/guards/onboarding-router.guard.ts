import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { OnboardingService } from '@core/services/onboarding.service';
import {
  onboardingRouteForStep,
  OnboardingStep,
} from '@app/features/onboarding/models/onboarding.model';

export const onboardingRouterGuard: CanActivateFn = (_route, state) => {
  const onboardingService = inject(OnboardingService);
  const router = inject(Router);

  return onboardingService.getFreshStatus().pipe(
    map(status => resolveOnboardingNavigation(status.step, state.url, router)),
    catchError(() => of(router.createUrlTree(['/onboarding/setup'])))
  );
};

export function resolveOnboardingNavigation(
  step: OnboardingStep,
  currentUrl: string,
  router: Router
): boolean | UrlTree {
  const target = onboardingRouteForStep(step);

  if (step === OnboardingStep.Active) {
    if (currentUrl.startsWith('/onboarding')) {
      return router.createUrlTree(['/dashboard']);
    }
    return true;
  }

  if (currentUrl.startsWith(target)) {
    return true;
  }

  return router.createUrlTree([target]);
}
