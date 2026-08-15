export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';

export interface BookingRow {
  id: number;
  customerName: string;
  customerPhone: string;
  bookingNumber: string;
  employee: string;
  service: string;
  fromTime: string;
  toTime: string;
  status: BookingStatus;
}

export interface StatCard {
  labelKey: string;
  value: string;
  change: number;
  changeType: 'vs_yesterday' | 'vs_last_month';
  icon: string;
  iconBg: string;
  sparkline: string;
}

export const MOCK_BOOKINGS: BookingRow[] = [
  {
    id: 1,
    customerName: 'محمد علي',
    customerPhone: '01001234567',
    bookingNumber: '10001001234567',
    employee: 'د. سارة محمود',
    service: 'إزالة الشعر بالليزر\nمنطقة الجسم الكامل',
    fromTime: '09:00 ص',
    toTime: '09:45 ص',
    status: 'confirmed',
  },
  {
    id: 2,
    customerName: 'نهيان علي',
    customerPhone: '01009876543',
    bookingNumber: '10009876543',
    employee: 'د. سارة محمود',
    service: 'تنظيف البشرة',
    fromTime: '10:00 ص',
    toTime: '10:45 ص',
    status: 'confirmed',
  },
  {
    id: 3,
    customerName: 'جيهان علي',
    customerPhone: '01005557890',
    bookingNumber: '10005557890',
    employee: 'د. سارة محمود',
    service: 'شد الجسم',
    fromTime: '11:00 ص',
    toTime: '11:45 ص',
    status: 'pending',
  },
  {
    id: 4,
    customerName: 'أسماء محمود',
    customerPhone: '01002223333',
    bookingNumber: '10002223333',
    employee: 'آية الله يوحنا\nليلى اللوز',
    service: 'جلسة لیزر نور\nالجسم اللوز',
    fromTime: '12:30 م',
    toTime: '01:00 م',
    status: 'cancelled',
  },
  {
    id: 5,
    customerName: 'محمد فاضل',
    customerPhone: '01004446666',
    bookingNumber: '10004446666',
    employee: 'د. سارة محمود',
    service: 'إزالة الشعر بالليزر\nمنطقة الجسم الكامل',
    fromTime: '01:00 م',
    toTime: '01:45 م',
    status: 'pending',
  },
];

export const MOCK_STATS: StatCard[] = [
  {
    labelKey: 'DASHBOARD.TODAY_BOOKINGS',
    value: '32',
    change: 14,
    changeType: 'vs_yesterday',
    icon: 'pi pi-calendar',
    iconBg: '#EAE9FF',
    sparkline: '0,22 12,18 24,20 36,14 48,16 60,10 72,12 80,8',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_BOOKINGS',
    value: '248',
    change: 16,
    changeType: 'vs_last_month',
    icon: 'pi pi-calendar-plus',
    iconBg: '#E8F8F0',
    sparkline: '0,26 12,22 24,24 36,16 48,18 60,10 72,12 80,6',
  },
  {
    labelKey: 'DASHBOARD.TOTAL_REVENUE',
    value: '5,680',
    change: 18,
    changeType: 'vs_yesterday',
    icon: 'pi pi-dollar',
    iconBg: '#FFF8E1',
    sparkline: '0,20 14,18 28,22 42,12 56,14 70,8 80,10',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_REVENUE',
    value: '78,450',
    change: 22,
    changeType: 'vs_last_month',
    icon: 'pi pi-chart-line',
    iconBg: '#FFE8EE',
    sparkline: '0,24 10,22 22,18 34,20 48,12 62,8 80,5',
  },
  {
    labelKey: 'DASHBOARD.NEW_CUSTOMERS',
    value: '54',
    change: 12,
    changeType: 'vs_last_month',
    icon: 'pi pi-users',
    iconBg: '#E8F4FF',
    sparkline: '0,20 16,14 32,18 48,10 64,12 80,7',
  },
];

export const EMPLOYEE_OPTIONS = [
  { label: 'DASHBOARD.ALL_EMPLOYEES', value: null },
  { label: 'د. سارة محمود', value: 'sara' },
  { label: 'آية الله يوحنا', value: 'aya' },
];

export const STATUS_OPTIONS: { label: string; value: BookingStatus | null }[] = [
  { label: 'DASHBOARD.ALL_STATUS', value: null },
  { label: 'BOOKING_STATUS.CONFIRMED', value: 'confirmed' },
  { label: 'BOOKING_STATUS.PENDING', value: 'pending' },
  { label: 'BOOKING_STATUS.CANCELLED', value: 'cancelled' },
  { label: 'BOOKING_STATUS.COMPLETED', value: 'completed' },
];
