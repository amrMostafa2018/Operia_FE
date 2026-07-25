import { inject, Injectable } from '@angular/core';

import { AuthStore } from '@core/store/auth.store';
import { FRONTEND_POLICY_MATRIX, Policies } from '@core/models/permissions.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authStore = inject(AuthStore);

  permissions(): string[] {
    return this.authStore.permissions();
  }

  hasPermission(permission: string): boolean {
    const user = this.authStore.currentUser();
    if (!user) {
      return false;
    }

    if (permission === Policies.PlatformManage) {
      return user.role === 'platform_admin';
    }

    if (user.role === 'platform_admin') {
      return false;
    }

    if (user.role === 'super_admin') {
      return true;
    }

    const rule = FRONTEND_POLICY_MATRIX.find(r => r.policy === permission);
    if (!rule) {
      return false;
    }

    if (user.role === 'admin') {
      return rule.allowAdminWithPermission && user.permissions.includes(permission);
    }

    if (user.role === 'reception') {
      return rule.allowReception;
    }

    if (user.role === 'staff') {
      return rule.allowStaff;
    }

    return false;
  }

  hasAnyPermission(...permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }
}
