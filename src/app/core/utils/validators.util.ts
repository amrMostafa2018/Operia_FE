import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';

import { clearServerFieldError } from './api-error.util';

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const PASSWORD_VALIDATORS = [
  Validators.required,
  Validators.minLength(8),
  Validators.pattern(PASSWORD_PATTERN),
];

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const password = parent.get('password')?.value;
  return control.value && control.value !== password ? { mismatch: true } : null;
}

export function setupPasswordConfirmSync(
  form: FormGroup,
  destroyRef: DestroyRef,
  passwordField = 'password',
  confirmField = 'confirmPassword'
): void {
  form
    .get(passwordField)
    ?.valueChanges.pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => {
      form.get(confirmField)?.updateValueAndValidity();
    });
}

export function setupServerErrorClearing(
  form: FormGroup,
  destroyRef: DestroyRef,
  fields: string[]
): void {
  for (const field of fields) {
    form
      .get(field)
      ?.valueChanges.pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        clearServerFieldError(form, field);
      });
  }
}
