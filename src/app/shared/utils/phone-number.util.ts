import { AbstractControl } from '@angular/forms';
import { ChangeData } from 'ngx-intl-tel-input';

export function getE164PhoneNumber(value: ChangeData | string | null | undefined): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.replace(/\s/g, '');
  }

  return (value.e164Number ?? value.internationalNumber ?? value.number ?? '').replace(/\s/g, '');
}

export function getPhoneFieldError(
  control: AbstractControl | null,
  labels: { required: string; invalid: string }
): string | null {
  if (!control?.touched || !control.errors) {
    return null;
  }

  if (control.errors['server']) {
    return control.errors['server'];
  }

  if (control.errors['validatePhoneNumber']) {
    return labels.invalid;
  }

  if (control.errors['required']) {
    return labels.required;
  }

  return null;
}
