import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Redirects authenticated users who have not selected an activity to onboarding.
 */
export const onboardingCompleteGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.needsOnboarding()) {
    return true;
  }

  return router.createUrlTree(['/onboarding/setup']);
};
