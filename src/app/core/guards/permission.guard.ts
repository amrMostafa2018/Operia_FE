import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { PermissionService } from '@core/services/permission.service';

/**
 * Restricts routes to users who have at least one permission from route data.
 *
 * Usage:
 * ```ts
 * {
 *   path: 'admins',
 *   canActivate: [authGuard, permissionGuard],
 *   data: { permissions: [Permissions.Admin.DashboardRead] },
 * }
 * ```
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const rawRequirements = route.data['permissions'] ?? route.data['policies'];
  if (!rawRequirements) {
    return true;
  }

  const requirements = Array.isArray(rawRequirements) ? rawRequirements : [rawRequirements];
  if (requirements.length === 0) {
    return true;
  }

  if (permissionService.hasAnyPermission(...requirements)) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
