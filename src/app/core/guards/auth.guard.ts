import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/services/auth.service';

/**
 * Protects routes that require an authenticated user.
 * Redirects unauthenticated visitors to /auth/login.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasActiveSession()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
