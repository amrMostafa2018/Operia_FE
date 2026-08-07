import { inject, Injectable } from '@angular/core';

import { AuthStore } from '@core/store/auth.store';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authStore = inject(AuthStore);

  permissions(): string[] {
    return this.authStore.permissions();
  }

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  hasAnyPermission(...permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }
}
