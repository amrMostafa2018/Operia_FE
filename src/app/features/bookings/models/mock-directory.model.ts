// TODO(API): replace once Customer/Package/Booking backend exists.

export type PackageStatus = 'active' | 'ready_for_activation' | 'expired' | 'cancelled';

export interface MockCustomer {
  id: string;
  fullName: string;
  mobile: string;
  countryCode: string;
}

export interface MockPackage {
  id: string;
  customerId: string;
  name: string;
  status: PackageStatus;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  sessionDurationMinutes: number;
  activationDate: string | null;
  expiryDate: string | null;
}

export interface MockBranch {
  id: string;
  name: string;
}

export interface MockEmployee {
  id: string;
  code: string;
  fullName: string;
  specialty: string | null;
  jobTitle: string | null;
  branchIds: string[];
}

export interface WorkingDayDto {
  day: string;
  enabled: boolean;
  fromTime: string;
  toTime: string;
}

export const MOCK_WORKING_DAYS: WorkingDayDto[] = [
  { day: 'fri', enabled: false, fromTime: '09:00', toTime: '21:00' },
  { day: 'sat', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'sun', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'mon', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'tue', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'wed', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'thu', enabled: true, fromTime: '09:00', toTime: '21:00' },
];

export const MOCK_BRANCHES: MockBranch[] = [
  { id: 'br-1', name: 'الفرع الرئيسي' },
  { id: 'br-2', name: 'فرع المعادي' },
];

export const MOCK_EMPLOYEES: MockEmployee[] = [
  {
    id: 'emp-1',
    code: 'E001',
    fullName: 'د. سارة محمود',
    specialty: 'ليزر',
    jobTitle: 'أخصائية',
    branchIds: ['br-1', 'br-2'],
  },
  {
    id: 'emp-2',
    code: 'E002',
    fullName: 'آية الله يوحنا',
    specialty: 'بشرة',
    jobTitle: 'أخصائية',
    branchIds: ['br-1'],
  },
  {
    id: 'emp-3',
    code: 'E003',
    fullName: 'ليلى اللوز',
    specialty: 'جسم',
    jobTitle: 'أخصائية',
    branchIds: ['br-2'],
  },
];

export const MOCK_CUSTOMERS: MockCustomer[] = [
  { id: 'cust-1', fullName: 'محمد علي', mobile: '01001234567', countryCode: '+20' },
  { id: 'cust-2', fullName: 'نهيان علي', mobile: '01009876543', countryCode: '+20' },
  { id: 'cust-3', fullName: 'جيهان علي', mobile: '01005557890', countryCode: '+20' },
  { id: 'cust-4', fullName: 'أسماء محمود', mobile: '01002223333', countryCode: '+20' },
  { id: 'cust-5', fullName: 'محمد فاضل', mobile: '01004446666', countryCode: '+20' },
];

export const MOCK_PACKAGES: MockPackage[] = [
  {
    id: 'pkg-1',
    customerId: 'cust-1',
    name: 'إزالة الشعر بالليزر - الجسم الكامل',
    status: 'active',
    totalSessions: 10,
    usedSessions: 3,
    remainingSessions: 7,
    sessionDurationMinutes: 45,
    activationDate: '2026-01-15',
    expiryDate: '2026-12-31',
  },
  {
    id: 'pkg-2',
    customerId: 'cust-2',
    name: 'تنظيف البشرة',
    status: 'active',
    totalSessions: 6,
    usedSessions: 1,
    remainingSessions: 5,
    sessionDurationMinutes: 45,
    activationDate: '2026-02-01',
    expiryDate: '2026-11-30',
  },
  {
    id: 'pkg-3',
    customerId: 'cust-3',
    name: 'شد الجسم',
    status: 'active',
    totalSessions: 8,
    usedSessions: 7,
    remainingSessions: 1,
    sessionDurationMinutes: 45,
    activationDate: '2025-10-01',
    expiryDate: '2026-09-30',
  },
  {
    id: 'pkg-4',
    customerId: 'cust-4',
    name: 'جلسة ليزر نور',
    status: 'expired',
    totalSessions: 5,
    usedSessions: 5,
    remainingSessions: 0,
    sessionDurationMinutes: 30,
    activationDate: '2025-06-01',
    expiryDate: '2025-12-31',
  },
  {
    id: 'pkg-5',
    customerId: 'cust-5',
    name: 'إزالة الشعر بالليزر - الجسم الكامل',
    status: 'active',
    totalSessions: 10,
    usedSessions: 0,
    remainingSessions: 10,
    sessionDurationMinutes: 45,
    activationDate: '2026-03-01',
    expiryDate: '2027-02-28',
  },
  {
    id: 'pkg-6',
    customerId: 'cust-1',
    name: 'تنظيف البشرة المتقدم',
    status: 'ready_for_activation',
    totalSessions: 4,
    usedSessions: 0,
    remainingSessions: 4,
    sessionDurationMinutes: 45,
    activationDate: null,
    expiryDate: '2027-06-30',
  },
];
