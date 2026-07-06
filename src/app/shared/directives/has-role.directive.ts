import {
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

import { UserRole } from '@core/models/user.model';
import { AuthStore } from '@core/store/auth.store';

@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authStore = inject(AuthStore);

  readonly appHasRole = input.required<UserRole | UserRole[]>();

  constructor() {
    effect(() => {
      const required = this.appHasRole();
      const roles = Array.isArray(required) ? required : [required];
      const userRole = this.authStore.userRole();
      const allowed = !!userRole && roles.includes(userRole);

      this.viewContainer.clear();
      if (allowed) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }
}
