import { Directive, inject, Input, TemplateRef, ViewContainerRef, effect } from '@angular/core';
import { AuthStore } from '@core/store/auth.store';

@Directive({
  selector: '[hasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private readonly authStore = inject(AuthStore);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  private roles: string[] = [];

  constructor() {
    effect(() => {
      this.updateView();
    });
  }

  @Input()
  set hasRole(value: string | string[] | undefined) {
    if (!value) {
      this.roles = [];
    } else {
      this.roles = (Array.isArray(value) ? value : [value]).map(r =>
        r.toString().toLowerCase().replace(/_/g, '')
      );
    }
    this.updateView();
  }

  private updateView(): void {
    this.viewContainer.clear();
    const userRole = this.authStore.userRole()?.toLowerCase().replace(/_/g, '');
    if (this.roles.length === 0 || (userRole && this.roles.includes(userRole))) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
