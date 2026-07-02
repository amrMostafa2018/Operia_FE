import { CountryISO } from 'ngx-intl-tel-input';

export interface CountryCodeOption {
  name: string;
  code: string;
  flag: string;
  iso: CountryISO;
  flagAsset: string;
}

export const AUTH_COUNTRY_CODES: CountryCodeOption[] = [
  { name: 'مصر', code: '+20', flag: '🇪🇬', iso: CountryISO.Egypt, flagAsset: '/assets/flags/eg.svg' },
  { name: 'السعودية', code: '+966', flag: '🇸🇦', iso: CountryISO.SaudiArabia, flagAsset: '/assets/flags/sa.svg' },
  { name: 'الإمارات', code: '+971', flag: '🇦🇪', iso: CountryISO.UnitedArabEmirates, flagAsset: '/assets/flags/ae.svg' },
  { name: 'الكويت', code: '+965', flag: '🇰🇼', iso: CountryISO.Kuwait, flagAsset: '/assets/flags/kw.svg' },
];

export const PHONE_COUNTRY_FLAG_ASSETS: Record<string, string> = Object.fromEntries(
  AUTH_COUNTRY_CODES.map(country => [country.iso, country.flagAsset])
);

export const DEFAULT_COUNTRY_CODE = '+20';

export const PHONE_INPUT_ONLY_COUNTRIES = [
  CountryISO.Egypt,
  CountryISO.SaudiArabia,
  CountryISO.UnitedArabEmirates,
  CountryISO.Kuwait,
];

export const PHONE_INPUT_DEFAULT_COUNTRY = CountryISO.Egypt;

export const PHONE_INPUT_CSS_CLASS = 'operia-tel-input';
