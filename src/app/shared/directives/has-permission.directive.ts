import {
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

import { PermissionService } from '@core/services/permission.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissionService = inject(PermissionService);

  readonly appHasPermission = input.required<string | string[]>();

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const permissions = Array.isArray(required) ? required : [required];
      const allowed = this.permissionService.hasAnyPermission(...permissions);

      this.viewContainer.clear();
      if (allowed) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }
}
