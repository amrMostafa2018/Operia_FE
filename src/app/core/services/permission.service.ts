import { inject, Injectable } from '@angular/core';

import { AuthStore } from '@core/store/auth.store';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authStore = inject(AuthStore);

  permissions(): string[] {
    return this.authStore.permissions();
  }

  hasPermission(permission: string): boolean {
    return this.authStore.permissions().includes(permission);
  }

  hasAnyPermission(...permissions: string[]): boolean {
    const userPermissions = this.authStore.permissions();
    return permissions.some((permission) => userPermissions.includes(permission));
  }
}
