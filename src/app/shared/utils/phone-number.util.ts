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

/** National digits for password managers (e.g. 1148908188, without +20). */
export function getCredentialPhoneUsername(
  value: ChangeData | string | null | undefined
): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return stripCountryCodeFromDigits(value.replace(/\D/g, ''));
  }

  const nationalDigits = (value.nationalNumber ?? value.number ?? '').replace(/\D/g, '');
  if (nationalDigits) {
    return stripLeadingZero(nationalDigits);
  }

  const e164Digits = (value.e164Number ?? '').replace(/\D/g, '');
  const dialCodeDigits = (value.dialCode ?? '').replace(/\D/g, '');
  if (e164Digits && dialCodeDigits && e164Digits.startsWith(dialCodeDigits)) {
    return stripLeadingZero(e164Digits.slice(dialCodeDigits.length));
  }

  return stripCountryCodeFromDigits(e164Digits);
}

function stripLeadingZero(digits: string): string {
  return digits.replace(/^0+/, '');
}

function stripCountryCodeFromDigits(digits: string): string {
  if (digits.startsWith('20') && digits.length > 10) {
    return stripLeadingZero(digits.slice(2));
  }

  return stripLeadingZero(digits);
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
