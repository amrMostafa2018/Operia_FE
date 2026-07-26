export type PaymentMethodId = 'cash' | 'bank_transfer' | 'instapay' | 'e_wallet' | 'fawry';

export interface PhotoSlot {
  id: string;
  isPrimary: boolean;
  previewUrl: string | null;
  file: File | null;
  displayIndex?: number;
}

const CLINIC_MOCK_IMAGES = [
  '/assets/images/settings-activity/photo-primary.svg',
  '/assets/images/settings-activity/photo-2.svg',
  '/assets/images/settings-activity/photo-3.svg',
  '/assets/images/settings-activity/photo-4.svg',
  '/assets/images/settings-activity/photo-5.svg',
  '/assets/images/settings-activity/photo-6.svg',
];

export const MOCK_IDENTITY_PHOTOS: PhotoSlot[] = [
  { id: 'primary', isPrimary: true, previewUrl: CLINIC_MOCK_IMAGES[0], file: null },
  {
    id: 'photo-1',
    isPrimary: false,
    previewUrl: CLINIC_MOCK_IMAGES[1],
    file: null,
    displayIndex: 2,
  },
  {
    id: 'photo-2',
    isPrimary: false,
    previewUrl: CLINIC_MOCK_IMAGES[2],
    file: null,
    displayIndex: 3,
  },
  {
    id: 'photo-3',
    isPrimary: false,
    previewUrl: CLINIC_MOCK_IMAGES[3],
    file: null,
    displayIndex: 4,
  },
  {
    id: 'photo-4',
    isPrimary: false,
    previewUrl: CLINIC_MOCK_IMAGES[4],
    file: null,
    displayIndex: 5,
  },
  {
    id: 'photo-5',
    isPrimary: false,
    previewUrl: CLINIC_MOCK_IMAGES[5],
    file: null,
    displayIndex: 6,
  },
];

export interface PaymentMethodState {
  id: PaymentMethodId;
  enabled: boolean;
  icon: string;
  labelKey: string;
  iconClass?: string;
  logoSrc?: string;
  brandText?: string;
  brandTextClass?: string;
  brandLines?: string[];
  hideLabel?: boolean;
}

export interface WorkingDay {
  id: string;
  dayKey: string;
  enabled: boolean;
  fromTime: Date;
  toTime: Date;
}

export interface AccessUser {
  id: string;
  name: string;
  email: string;
  lastLogin: string;
  device: 'windows' | 'chrome' | 'android' | 'safari' | 'mac';
  isBanned?: boolean;
}

export const ACTIVITY_SETTINGS_TABS = [
  {
    route: 'identity',
    labelKey: 'SETTINGS_ACTIVITY.TABS.IDENTITY',
    breadcrumbKey: 'NAV.SETTINGS_SECTION.ACTIVITY_IDENTITY',
    icon: 'pi pi-desktop',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.IDENTITY.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.IDENTITY.SUBTITLE',
  },
  {
    route: 'payments',
    labelKey: 'SETTINGS_ACTIVITY.TABS.PAYMENTS',
    breadcrumbKey: 'NAV.SETTINGS_SECTION.ACTIVITY_PAYMENTS',
    icon: 'pi pi-credit-card',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.PAYMENTS.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.PAYMENTS.SUBTITLE',
  },
  {
    route: 'working-days',
    labelKey: 'SETTINGS_ACTIVITY.TABS.WORKING_DAYS',
    breadcrumbKey: 'NAV.SETTINGS_SECTION.ACTIVITY_WORKING_DAYS',
    icon: 'pi pi-calendar',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.WORKING_DAYS.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.WORKING_DAYS.SUBTITLE',
  },
  {
    route: 'security',
    labelKey: 'SETTINGS_ACTIVITY.TABS.SECURITY',
    breadcrumbKey: 'NAV.SETTINGS_SECTION.ACTIVITY_SECURITY',
    icon: 'pi pi-shield',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.SECURITY.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.SECURITY.SUBTITLE',
  },
] as const;

export const MOCK_PAYMENT_METHODS: PaymentMethodState[] = [
  {
    id: 'cash',
    enabled: true,
    icon: 'pi pi-wallet',
    iconClass: 'method-icon--cash',
    labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.CASH',
  },
  {
    id: 'bank_transfer',
    enabled: true,
    icon: 'pi pi-building-columns',
    iconClass: 'method-icon--bank',
    labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.BANK_TRANSFER',
  },
  {
    id: 'instapay',
    enabled: true,
    icon: '',
    iconClass: 'method-icon--instapay',
    brandLines: ['INSTA', 'PAY'],
    brandTextClass: 'method-brand-lines--instapay',
    labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.INSTAPAY',
  },
  {
    id: 'e_wallet',
    enabled: true,
    icon: 'pi pi-wallet',
    iconClass: 'method-icon--wallet',
    labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.E_WALLET',
  },
  {
    id: 'fawry',
    enabled: true,
    icon: '',
    iconClass: 'method-icon--fawry',
    brandText: 'fawry',
    brandTextClass: 'method-brand-text--fawry',
    labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.FAWRY',
  },
];

export const MOCK_BANK_OPTIONS = [
  { label: 'البنك الأهلي المصري', value: 'nbe' },
  { label: 'بنك مصر', value: 'bm' },
  { label: 'بنك القاهرة', value: 'cib' },
];

export const MOCK_WALLET_OPTIONS = [
  { label: 'Vodafone Cash', value: 'vodafone' },
  { label: 'Etisalat Cash', value: 'etisalat' },
  { label: 'Orange Cash', value: 'orange' },
];

function createTime(hours: number, minutes: number): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export const MOCK_WORKING_DAYS: WorkingDay[] = [
  {
    id: 'fri',
    dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.FRI',
    enabled: false,
    fromTime: createTime(9, 0),
    toTime: createTime(21, 0),
  },
  {
    id: 'sat',
    dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.SAT',
    enabled: true,
    fromTime: createTime(9, 0),
    toTime: createTime(21, 0),
  },
  {
    id: 'sun',
    dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.SUN',
    enabled: true,
    fromTime: createTime(9, 0),
    toTime: createTime(21, 0),
  },
  {
    id: 'mon',
    dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.MON',
    enabled: true,
    fromTime: createTime(9, 0),
    toTime: createTime(21, 0),
  },
  {
    id: 'tue',
    dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.TUE',
    enabled: true,
    fromTime: createTime(9, 0),
    toTime: createTime(21, 0),
  },
  {
    id: 'wed',
    dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.WED',
    enabled: true,
    fromTime: createTime(9, 0),
    toTime: createTime(21, 0),
  },
  {
    id: 'thu',
    dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.THU',
    enabled: true,
    fromTime: createTime(9, 0),
    toTime: createTime(21, 0),
  },
];

export const MOCK_ACCESS_USERS: AccessUser[] = [
  {
    id: '1',
    name: 'أحمد محمد',
    email: 'ahmed@clinic.com',
    lastLogin: '10:30 2026-07-14',
    device: 'windows',
  },
  {
    id: '2',
    name: 'سارة علي',
    email: 'sara@clinic.com',
    lastLogin: '16:45 2026-07-13',
    device: 'chrome',
  },
  {
    id: '3',
    name: 'محمد حسن',
    email: 'mohamed@clinic.com',
    lastLogin: '09:15 2026-07-12',
    device: 'android',
  },
  {
    id: '4',
    name: 'نور إبراهيم',
    email: 'nour@clinic.com',
    lastLogin: '14:20 2026-07-11',
    device: 'safari',
  },
  {
    id: '5',
    name: 'كريم يوسف',
    email: 'karim@clinic.com',
    lastLogin: '11:00 2026-07-10',
    device: 'mac',
  },
  {
    id: '6',
    name: 'ليلى أحمد',
    email: 'layla@clinic.com',
    lastLogin: '08:30 2026-07-09',
    device: 'chrome',
  },
];

export const DEVICE_ICONS: Record<AccessUser['device'], string> = {
  windows: 'pi pi-microsoft',
  chrome: 'pi pi-google',
  android: 'pi pi-android',
  safari: 'pi pi-apple',
  mac: 'pi pi-apple',
};
