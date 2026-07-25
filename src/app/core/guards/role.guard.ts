import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { AuthStore } from '@core/store/auth.store';

/**
 * Restricts routes to users who have at least one role from route data.
 *
 * Usage:
 * ```ts
 * {
 *   path: 'admin-only',
 *   canActivate: [authGuard, roleGuard],
 *   data: { roles: ['admin', 'super_admin'] }, // or roles: ['Admin', 'SuperAdmin']
 * }
 * ```
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const user = authStore.currentUser();
  if (!user) {
    return router.createUrlTree(['/auth/login']);
  }

  const rawRoles = route.data['roles'] ?? route.data['role'];
  if (!rawRoles) {
    return true;
  }

  const requiredRoles = (Array.isArray(rawRoles) ? rawRoles : [rawRoles]).map(r =>
    r.toString().toLowerCase()
  );
  if (requiredRoles.length === 0) {
    return true;
  }

  const userRole = user.role.toLowerCase();
  if (requiredRoles.includes(userRole)) {
    return true;
  }

  const normalizedUserRole = userRole.replace(/_/g, '');
  const normalizedRequiredRoles = requiredRoles.map(r => r.replace(/_/g, ''));
  if (normalizedRequiredRoles.includes(normalizedUserRole)) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
