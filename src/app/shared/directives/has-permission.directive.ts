import { Directive, inject, Input, TemplateRef, ViewContainerRef, effect } from '@angular/core';
import { PermissionService } from '@core/services/permission.service';

@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly permissionService = inject(PermissionService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  private permissions: string[] = [];

  constructor() {
    effect(() => {
      this.updateView();
    });
  }

  @Input()
  set hasPermission(value: string | string[] | undefined) {
    if (!value) {
      this.permissions = [];
    } else {
      this.permissions = Array.isArray(value) ? value : [value];
    }
    this.updateView();
  }

  private updateView(): void {
    this.viewContainer.clear();
    if (
      this.permissions.length === 0 ||
      this.permissionService.hasAnyPermission(...this.permissions)
    ) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
