import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { PermissionService } from '../services/permission.service';

/**
 * Restricts routes to users who have at least one permission from route data.
 *
 * Usage:
 * ```ts
 * {
 *   path: 'admins',
 *   canActivate: [authGuard, permissionGuard],
 *   data: { permissions: [Permissions.Admin.Read] },
 * }
 * ```
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const requiredPermissions = route.data['permissions'] as string[] | undefined;

  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (permissionService.hasAnyPermission(...requiredPermissions)) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
