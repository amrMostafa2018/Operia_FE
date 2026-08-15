import { AbstractControl } from '@angular/forms';
import { ChangeData, CountryISO } from 'ngx-intl-tel-input';
import {
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';

const SUPPORTED_DIAL_CODES: { iso: CountryISO; dial: string }[] = [
  { iso: CountryISO.SaudiArabia, dial: '966' },
  { iso: CountryISO.UnitedArabEmirates, dial: '971' },
  { iso: CountryISO.Egypt, dial: '20' },
  { iso: CountryISO.Kuwait, dial: '965' },
].sort((left, right) => right.dial.length - left.dial.length);

export function toPhoneChangeData(value: string | null | undefined): ChangeData | null {
  if (!value?.trim()) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  for (const country of SUPPORTED_DIAL_CODES) {
    if (digits.startsWith(country.dial) && digits.length > country.dial.length + 2) {
      const national = stripLeadingZero(digits.slice(country.dial.length));
      if (!national) {
        continue;
      }

      const e164Number = `+${country.dial}${national}`;
      return buildPhoneChangeData(national, e164Number, country.iso, country.dial);
    }
  }

  const national = stripLeadingZero(digits);
  if (!national) {
    return null;
  }

  return buildPhoneChangeData(national, `+20${national}`, CountryISO.Egypt, '20');
}

export function toPhoneCountryIso(value: string | null | undefined): CountryISO {
  const changeData = toPhoneChangeData(value);
  const countryCode = changeData?.countryCode as CountryISO | undefined;
  if (countryCode && PHONE_INPUT_ONLY_COUNTRIES.includes(countryCode)) {
    return countryCode;
  }

  return PHONE_INPUT_DEFAULT_COUNTRY;
}

/** National digits for ngx-intl-tel-input when separateDialCode is enabled (e.g. 1148958461). */
export function toNationalPhoneNumber(value: string | null | undefined): string | null {
  return toPhoneChangeData(value)?.number ?? null;
}

function buildPhoneChangeData(
  national: string,
  e164Number: string,
  countryCode: CountryISO,
  dial: string
): ChangeData {
  return {
    number: national,
    nationalNumber: national,
    internationalNumber: e164Number,
    e164Number,
    countryCode,
    dialCode: `+${dial}`,
  };
}

export function getE164PhoneNumber(value: ChangeData | string | null | undefined): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.replace(/\s/g, '');
    if (!trimmed || trimmed.includes('[object')) {
      return '';
    }

    return toPhoneChangeData(trimmed)?.e164Number ?? trimmed;
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
