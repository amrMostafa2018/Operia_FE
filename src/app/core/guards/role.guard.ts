import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { UserRole } from '../models/user.model';
import { AuthStore } from '../store/auth.store';

/**
 * Restricts routes to users whose role is listed in route data `roles`.
 *
 * Usage in routes:
 * ```ts
 * {
 *   path: 'admin',
 *   canActivate: [authGuard, roleGuard],
 *   data: { roles: ['super_admin', 'admin'] satisfies UserRole[] },
 *   ...
 * }
 * ```
 *
 * If `data.roles` is absent or empty the guard allows all authenticated users.
 * Unauthorised users are redirected to /unauthorized.
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const requiredRoles = route.data['roles'] as UserRole[] | undefined;

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  const userRole = authStore.userRole();
  if (userRole && requiredRoles.includes(userRole)) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
