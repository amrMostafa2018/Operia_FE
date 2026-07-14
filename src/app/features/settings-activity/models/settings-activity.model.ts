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
  { id: 'photo-1', isPrimary: false, previewUrl: CLINIC_MOCK_IMAGES[1], file: null, displayIndex: 2 },
  { id: 'photo-2', isPrimary: false, previewUrl: CLINIC_MOCK_IMAGES[2], file: null, displayIndex: 3 },
  { id: 'photo-3', isPrimary: false, previewUrl: CLINIC_MOCK_IMAGES[3], file: null, displayIndex: 4 },
  { id: 'photo-4', isPrimary: false, previewUrl: CLINIC_MOCK_IMAGES[4], file: null, displayIndex: 5 },
  { id: 'photo-5', isPrimary: false, previewUrl: CLINIC_MOCK_IMAGES[5], file: null, displayIndex: 6 },
];

export interface PaymentMethodState {
  id: PaymentMethodId;
  enabled: boolean;
  icon: string;
  labelKey: string;
}

export interface WorkingDay {
  id: string;
  dayKey: string;
  enabled: boolean;
  selected: boolean;
  fromTime: Date;
  toTime: Date;
}

export interface AccessUser {
  id: string;
  name: string;
  email: string;
  lastLogin: string;
  device: 'windows' | 'chrome' | 'android' | 'safari' | 'mac';
}

export const ACTIVITY_SETTINGS_TABS = [
  {
    route: 'identity',
    labelKey: 'SETTINGS_ACTIVITY.TABS.IDENTITY',
    icon: 'pi pi-desktop',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.IDENTITY.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.IDENTITY.SUBTITLE',
  },
  {
    route: 'payments',
    labelKey: 'SETTINGS_ACTIVITY.TABS.PAYMENTS',
    icon: 'pi pi-credit-card',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.PAYMENTS.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.PAYMENTS.SUBTITLE',
  },
  {
    route: 'working-days',
    labelKey: 'SETTINGS_ACTIVITY.TABS.WORKING_DAYS',
    icon: 'pi pi-calendar',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.WORKING_DAYS.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.WORKING_DAYS.SUBTITLE',
  },
  {
    route: 'security',
    labelKey: 'SETTINGS_ACTIVITY.TABS.SECURITY',
    icon: 'pi pi-shield',
    titleKey: 'SETTINGS_ACTIVITY.PAGES.SECURITY.TITLE',
    subtitleKey: 'SETTINGS_ACTIVITY.PAGES.SECURITY.SUBTITLE',
  },
] as const;

export const MOCK_PAYMENT_METHODS: PaymentMethodState[] = [
  { id: 'fawry', enabled: true, icon: 'pi pi-building', labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.FAWRY' },
  { id: 'e_wallet', enabled: true, icon: 'pi pi-wallet', labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.E_WALLET' },
  { id: 'instapay', enabled: true, icon: 'pi pi-send', labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.INSTAPAY' },
  { id: 'bank_transfer', enabled: true, icon: 'pi pi-building-columns', labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.BANK_TRANSFER' },
  { id: 'cash', enabled: true, icon: 'pi pi-money-bill', labelKey: 'SETTINGS_ACTIVITY.PAYMENTS.METHODS.CASH' },
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
  { id: 'fri', dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.FRI', enabled: false, selected: false, fromTime: createTime(9, 0), toTime: createTime(21, 0) },
  { id: 'sat', dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.SAT', enabled: true, selected: false, fromTime: createTime(9, 0), toTime: createTime(21, 0) },
  { id: 'sun', dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.SUN', enabled: true, selected: false, fromTime: createTime(9, 0), toTime: createTime(21, 0) },
  { id: 'mon', dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.MON', enabled: true, selected: false, fromTime: createTime(9, 0), toTime: createTime(21, 0) },
  { id: 'tue', dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.TUE', enabled: true, selected: false, fromTime: createTime(9, 0), toTime: createTime(21, 0) },
  { id: 'wed', dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.WED', enabled: true, selected: false, fromTime: createTime(9, 0), toTime: createTime(21, 0) },
  { id: 'thu', dayKey: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.THU', enabled: true, selected: false, fromTime: createTime(9, 0), toTime: createTime(21, 0) },
];

export const MOCK_ACCESS_USERS: AccessUser[] = [
  { id: '1', name: 'أحمد محمد', email: 'ahmed@clinic.com', lastLogin: '2026-07-14 10:30', device: 'windows' },
  { id: '2', name: 'سارة علي', email: 'sara@clinic.com', lastLogin: '2026-07-13 16:45', device: 'chrome' },
  { id: '3', name: 'محمد حسن', email: 'mohamed@clinic.com', lastLogin: '2026-07-12 09:15', device: 'android' },
  { id: '4', name: 'نور إبراهيم', email: 'nour@clinic.com', lastLogin: '2026-07-11 14:20', device: 'safari' },
  { id: '5', name: 'كريم يوسف', email: 'karim@clinic.com', lastLogin: '2026-07-10 11:00', device: 'mac' },
  { id: '6', name: 'ليلى أحمد', email: 'layla@clinic.com', lastLogin: '2026-07-09 08:30', device: 'chrome' },
];

export const DEVICE_ICONS: Record<AccessUser['device'], string> = {
  windows: 'pi pi-microsoft',
  chrome: 'pi pi-google',
  android: 'pi pi-android',
  safari: 'pi pi-apple',
  mac: 'pi pi-apple',
};
