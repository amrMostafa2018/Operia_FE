import { AbstractControl } from '@angular/forms';

export function isFieldInvalid(form: AbstractControl, field: string): boolean {
  const ctrl = form.get(field);
  return !!(ctrl?.invalid && ctrl?.touched);
}

export function getFieldServerError(form: AbstractControl, field: string): string | null {
  const ctrl = form.get(field);
  if (!ctrl?.touched || !ctrl.errors) {
    return null;
  }
  return ctrl.errors['server'] ?? null;
}
