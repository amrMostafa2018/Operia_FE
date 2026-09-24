export type InquiryRecordStatus = 'active' | 'expired' | 'completed' | 'cancelled';
export type InquiryServiceType = 'package' | 'session';

export interface InquirySessionRow {
  number: number;
  date: string;
  time: string;
  employee: string;
  notes: string;
}

export interface InquiryCustomerRecord {
  id: string;
  index: number;
  name: string;
  serviceType: InquiryServiceType;
  status: InquiryRecordStatus;
  purchaseDate: string;
  startDate: string;
  endDate: string;
  validDaysRemaining: number | null;
  totalSessions: number | null;
  usedSessions: number | null;
  remainingSessions: number | null;
  totalPoints: number | null;
  usedPoints: number | null;
  remainingPoints: number | null;
  previousSessions: InquirySessionRow[];
}

export interface CustomerInquiryResult {
  customerId: string;
  customerName: string;
  mobile: string;
  recordCount: number;
  records: InquiryCustomerRecord[];
}

const MOCK_INQUIRY_BY_MOBILE: Record<string, CustomerInquiryResult> = {
  '01012345678': {
    customerId: 'cust-inquiry-1',
    customerName: 'أسماء محمود',
    mobile: '01012345678',
    recordCount: 4,
    records: [
      {
        id: 'rec-1',
        index: 1,
        name: 'باقة ليزر جسم كامل',
        serviceType: 'package',
        status: 'active',
        purchaseDate: '2025-05-10',
        startDate: '2025-05-10',
        endDate: '2026-05-10',
        validDaysRemaining: 365,
        totalSessions: 8,
        usedSessions: 3,
        remainingSessions: 5,
        totalPoints: 4000,
        usedPoints: 1500,
        remainingPoints: 2500,
        previousSessions: [
          {
            number: 1,
            date: '2025-05-10',
            time: '10:00',
            employee: 'د. سارة محمود',
            notes: '—',
          },
          {
            number: 2,
            date: '2025-05-24',
            time: '11:30',
            employee: 'د. سارة محمود',
            notes: '—',
          },
          {
            number: 3,
            date: '2025-06-07',
            time: '09:15',
            employee: 'آية الله يوحنا',
            notes: '—',
          },
        ],
      },
      {
        id: 'rec-2',
        index: 2,
        name: 'باقة بشره تحت الإبط',
        serviceType: 'package',
        status: 'expired',
        purchaseDate: '2024-12-01',
        startDate: '2024-12-01',
        endDate: '2025-06-01',
        validDaysRemaining: 0,
        totalSessions: 6,
        usedSessions: 6,
        remainingSessions: 0,
        totalPoints: null,
        usedPoints: null,
        remainingPoints: null,
        previousSessions: [],
      },
      {
        id: 'rec-3',
        index: 3,
        name: 'جلسة واحدة - تنظيف بشرة',
        serviceType: 'session',
        status: 'completed',
        purchaseDate: '2025-04-15',
        startDate: '2025-04-15',
        endDate: '2025-04-15',
        validDaysRemaining: null,
        totalSessions: 1,
        usedSessions: 1,
        remainingSessions: 0,
        totalPoints: null,
        usedPoints: null,
        remainingPoints: null,
        previousSessions: [],
      },
      {
        id: 'rec-4',
        index: 4,
        name: 'جلسة واحدة - إزالة شعر وجه',
        serviceType: 'session',
        status: 'cancelled',
        purchaseDate: '2025-03-20',
        startDate: '2025-03-20',
        endDate: '2025-03-20',
        validDaysRemaining: null,
        totalSessions: 1,
        usedSessions: 0,
        remainingSessions: 1,
        totalPoints: null,
        usedPoints: null,
        remainingPoints: null,
        previousSessions: [],
      },
    ],
  },
  '01001234567': {
    customerId: 'cust-1',
    customerName: 'محمد علي',
    mobile: '01001234567',
    recordCount: 2,
    records: [
      {
        id: 'rec-m1',
        index: 1,
        name: 'إزالة الشعر بالليزر - الجسم الكامل',
        serviceType: 'package',
        status: 'active',
        purchaseDate: '2026-01-15',
        startDate: '2026-01-15',
        endDate: '2026-12-31',
        validDaysRemaining: 180,
        totalSessions: 10,
        usedSessions: 3,
        remainingSessions: 7,
        totalPoints: null,
        usedPoints: null,
        remainingPoints: null,
        previousSessions: [
          {
            number: 1,
            date: '2026-02-01',
            time: '09:00',
            employee: 'د. سارة محمود',
            notes: '—',
          },
        ],
      },
      {
        id: 'rec-m2',
        index: 2,
        name: 'تنظيف البشرة المتقدم',
        serviceType: 'package',
        status: 'active',
        purchaseDate: '2026-03-01',
        startDate: '2026-03-01',
        endDate: '2027-06-30',
        validDaysRemaining: 420,
        totalSessions: 4,
        usedSessions: 0,
        remainingSessions: 4,
        totalPoints: null,
        usedPoints: null,
        remainingPoints: null,
        previousSessions: [],
      },
    ],
  },
};

export function normalizeInquiryMobile(mobile: string): string {
  return mobile.replace(/\D/g, '');
}

export function lookupCustomerInquiry(mobile: string): CustomerInquiryResult | null {
  const normalized = normalizeInquiryMobile(mobile);
  if (!normalized) {
    return null;
  }
  return MOCK_INQUIRY_BY_MOBILE[normalized] ?? null;
}

export function inquiryStatusKey(status: InquiryRecordStatus): string {
  return `CUSTOMER_INQUIRY.STATUS.${status.toUpperCase()}`;
}

export function inquiryServiceTypeKey(type: InquiryServiceType): string {
  return type === 'package'
    ? 'CUSTOMER_INQUIRY.TYPE.PACKAGE'
    : 'CUSTOMER_INQUIRY.TYPE.SESSION';
}
