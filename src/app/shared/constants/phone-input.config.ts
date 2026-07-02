import { CountryISO } from 'ngx-intl-tel-input';

export interface CountryCodeOption {
  name: string;
  code: string;
  flag: string;
}

export const AUTH_COUNTRY_CODES: CountryCodeOption[] = [
  { name: 'مصر', code: '+20', flag: '🇪🇬' },
  { name: 'السعودية', code: '+966', flag: '🇸🇦' },
  { name: 'الإمارات', code: '+971', flag: '🇦🇪' },
];

export const DEFAULT_COUNTRY_CODE = '+20';

export const PHONE_INPUT_ONLY_COUNTRIES = [
  CountryISO.Egypt,
  CountryISO.SaudiArabia,
  CountryISO.UnitedArabEmirates,
];

export const PHONE_INPUT_DEFAULT_COUNTRY = CountryISO.Egypt;

export const PHONE_INPUT_CSS_CLASS = 'operia-tel-input';
