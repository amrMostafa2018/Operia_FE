import { TagSeverity } from '@app/shared/utils/status-tag.util';

/** Screenshot-facing status values for the register UI mock. */
export type BookingRegisterStatus = 'waiting' | 'confirm' | 'completed' | 'cancelled';

export type BookingRegisterServiceType = 'package' | 'session' | 'unlisted';

export type BookingRegisterHistoryType =
  | 'created'
  | 'employee_changed'
  | 'time_changed'
  | 'status_confirmed';

export interface BookingRegisterEmployeeOption {
  id: string;
  fullName: string;
}

export interface BookingRegisterRow {
  id: string;
  rowNumber: number;
  bookingCode: string;
  customerPhone: string;
  customerName: string;
  serviceName: string;
  serviceType: BookingRegisterServiceType;
  employeeId: string;
  employeeName: string;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: BookingRegisterStatus;
  paymentMethodKey: string;
  paidAmount: number;
  discountAmount: number;
  totalAmount: number;
  notesCount: number;
}

export interface BookingRegisterSummary {
  total: number;
  cancelled: number;
  completed: number;
  waiting: number;
}

export interface BookingRegisterHistoryEvent {
  id: string;
  type: BookingRegisterHistoryType;
  actorName: string;
  actorRoleKey: string;
  timestamp: Date;
  descriptionKey: string;
  descriptionParams?: Record<string, string>;
  markerClass: string;
}

export interface BookingRegisterFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  mobile: string;
  customerName: string;
  employeeId: string | null;
  status: BookingRegisterStatus | null;
}

export const BOOKING_REGISTER_PAGE_SIZES = [5, 10, 20, 50];

export const BOOKING_REGISTER_STATUS_OPTIONS: {
  label: string;
  value: BookingRegisterStatus | null;
}[] = [
  { label: 'BOOKING_REGISTER.FILTER.ALL_STATUS', value: null },
  { label: 'BOOKING_REGISTER.STATUS.WAITING', value: 'waiting' },
  { label: 'BOOKING_REGISTER.STATUS.CONFIRM', value: 'confirm' },
  { label: 'BOOKING_REGISTER.STATUS.COMPLETED', value: 'completed' },
  { label: 'BOOKING_REGISTER.STATUS.CANCELLED', value: 'cancelled' },
];

const STATUS_SEVERITY: Record<BookingRegisterStatus, TagSeverity> = {
  waiting: 'warning',
  confirm: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_KEYS: Record<BookingRegisterStatus, string> = {
  waiting: 'BOOKING_REGISTER.STATUS.WAITING',
  confirm: 'BOOKING_REGISTER.STATUS.CONFIRM',
  completed: 'BOOKING_REGISTER.STATUS.COMPLETED',
  cancelled: 'BOOKING_REGISTER.STATUS.CANCELLED',
};

const SERVICE_TYPE_KEYS: Record<BookingRegisterServiceType, string> = {
  package: 'BOOKING_REGISTER.SERVICE_TYPE.PACKAGE',
  session: 'BOOKING_REGISTER.SERVICE_TYPE.SESSION',
  unlisted: 'BOOKING_REGISTER.SERVICE_TYPE.UNLISTED',
};

export function registerStatusSeverity(status: BookingRegisterStatus): TagSeverity {
  return STATUS_SEVERITY[status];
}

export function registerStatusKey(status: BookingRegisterStatus): string {
  return STATUS_KEYS[status];
}

export function registerServiceTypeKey(type: BookingRegisterServiceType): string {
  return SERVICE_TYPE_KEYS[type];
}

export function computeRegisterSummary(rows: BookingRegisterRow[]): BookingRegisterSummary {
  return {
    total: rows.length,
    cancelled: rows.filter(row => row.status === 'cancelled').length,
    completed: rows.filter(row => row.status === 'completed').length,
    waiting: rows.filter(row => row.status === 'waiting').length,
  };
}

export function filterRegisterRows(
  rows: BookingRegisterRow[],
  filters: BookingRegisterFilters
): BookingRegisterRow[] {
  const mobile = filters.mobile.trim().toLowerCase();
  const customer = filters.customerName.trim().toLowerCase();

  return rows.filter(row => {
    if (filters.dateFrom) {
      const from = startOfDay(filters.dateFrom);
      if (row.scheduledDate < from) {
        return false;
      }
    }

    if (filters.dateTo) {
      const to = endOfDay(filters.dateTo);
      if (row.scheduledDate > to) {
        return false;
      }
    }

    if (mobile) {
      const haystack = `${row.bookingCode} ${row.customerPhone}`.toLowerCase();
      if (!haystack.includes(mobile)) {
        return false;
      }
    }

    if (customer && !row.customerName.toLowerCase().includes(customer)) {
      return false;
    }

    if (filters.employeeId && row.employeeId !== filters.employeeId) {
      return false;
    }

    if (filters.status && row.status !== filters.status) {
      return false;
    }

    return true;
  });
}

export function buildRegisterHistory(booking: BookingRegisterRow): BookingRegisterHistoryEvent[] {
  return [
    {
      id: `${booking.id}-created`,
      type: 'created',
      actorName: 'أحمد محمد',
      actorRoleKey: 'BOOKING_REGISTER.HISTORY.ROLE_RECEPTION',
      timestamp: new Date('2025-06-10T09:00:00'),
      descriptionKey: 'BOOKING_REGISTER.HISTORY.CREATED_DESC',
      markerClass: 'history-marker--created',
    },
    {
      id: `${booking.id}-employee`,
      type: 'employee_changed',
      actorName: 'أحمد محمد',
      actorRoleKey: 'BOOKING_REGISTER.HISTORY.ROLE_RECEPTION',
      timestamp: new Date('2025-06-10T09:10:00'),
      descriptionKey: 'BOOKING_REGISTER.HISTORY.EMPLOYEE_CHANGED_DESC',
      descriptionParams: {
        from: 'منة الله',
        to: 'سارة محمود',
      },
      markerClass: 'history-marker--employee',
    },
    {
      id: `${booking.id}-time`,
      type: 'time_changed',
      actorName: 'هدى علي',
      actorRoleKey: 'BOOKING_REGISTER.HISTORY.ROLE_ADMIN',
      timestamp: new Date('2025-06-10T09:40:00'),
      descriptionKey: 'BOOKING_REGISTER.HISTORY.TIME_CHANGED_DESC',
      descriptionParams: {
        from: '10:00 ص',
        to: '09:45 ص',
      },
      markerClass: 'history-marker--time',
    },
    {
      id: `${booking.id}-status`,
      type: 'status_confirmed',
      actorName: 'أحمد محمد',
      actorRoleKey: 'BOOKING_REGISTER.HISTORY.ROLE_RECEPTION',
      timestamp: new Date('2025-06-10T10:15:00'),
      descriptionKey: 'BOOKING_REGISTER.HISTORY.STATUS_CONFIRMED_DESC',
      markerClass: 'history-marker--status',
    },
  ];
}

export const MOCK_BOOKING_REGISTER_EMPLOYEES: BookingRegisterEmployeeOption[] = [
  { id: 'emp-1', fullName: 'د. منى حسن' },
  { id: 'emp-2', fullName: 'د. سارة محمود' },
  { id: 'emp-3', fullName: 'أ. يasmine فتحي' },
  { id: 'emp-4', fullName: 'د. أحمد رشاد' },
];

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

export const MOCK_BOOKING_REGISTER_ROWS: BookingRegisterRow[] = [
  row(1, 'BK-1024', '+201012345678', 'نورا أحمد', 'إزالة الشعر بالليزر', 'package', 'emp-1', 'د. منى حسن', d(2025, 6, 2), '09:00', '09:45', 45, 'confirm', 200, 0, 500, 1),
  row(2, 'BK-1025', '+201098765432', 'مريم خالد', 'تنظيف البشرة', 'session', 'emp-2', 'د. سارة محمود', d(2025, 6, 2), '10:00', '10:30', 30, 'waiting', 150, 0, 350, 0),
  row(3, 'BK-1026', '+201055566677', 'هبة سامي', 'تقشير كيميائي', 'session', 'emp-3', 'أ. يasmine فتحي', d(2025, 6, 3), '11:30', '12:15', 45, 'completed', 400, 50, 400, 2),
  row(4, 'BK-1027', '+201044433322', 'سلمى عادل', 'جلسة ليزر كامل', 'package', 'emp-4', 'د. أحمد رشاد', d(2025, 6, 3), '13:00', '14:00', 60, 'cancelled', 0, 0, 600, 0),
  row(5, 'BK-1028', '+201033221100', 'دينا محمد', 'ترطيب البشرة', 'unlisted', 'emp-1', 'د. منى حسن', d(2025, 6, 4), '14:30', '15:00', 30, 'waiting', 100, 0, 250, 1),
  row(6, 'BK-1029', '+201022110099', 'رنا حسين', 'إزالة الشعر بالليزر', 'package', 'emp-2', 'د. سارة محمود', d(2025, 6, 4), '16:00', '16:45', 45, 'confirm', 300, 0, 700, 0),
  row(7, 'BK-1030', '+201011223344', 'فاطمة يوسف', 'تفتيح البشرة', 'session', 'emp-3', 'أ. يasmine فتحي', d(2025, 6, 5), '09:30', '10:15', 45, 'completed', 350, 0, 350, 1),
  row(8, 'BK-1031', '+201066778899', 'منى عبد الله', 'علاج حب الشباب', 'session', 'emp-4', 'د. أحمد رشاد', d(2025, 6, 5), '11:00', '11:45', 45, 'waiting', 120, 0, 420, 0),
  row(9, 'BK-1032', '+201077889900', 'إيمان سعد', 'باقة ليزر 6 جلسات', 'package', 'emp-1', 'د. منى حسن', d(2025, 6, 6), '12:00', '12:30', 30, 'confirm', 500, 100, 1200, 3),
  row(10, 'BK-1033', '+201088990011', 'آية محمود', 'تنظيف عميق', 'session', 'emp-2', 'د. سارة محمود', d(2025, 6, 6), '15:00', '15:45', 45, 'cancelled', 0, 0, 380, 0),
  row(11, 'BK-1034', '+201099001122', 'شيماء فاروق', 'جلسة ليزر وجه', 'session', 'emp-3', 'أ. يasmine فتحي', d(2025, 6, 7), '10:30', '11:00', 30, 'completed', 280, 0, 280, 1),
  row(12, 'BK-1035', '+201010203040', 'يasmine كريم', 'تقشير + ترطيب', 'unlisted', 'emp-4', 'د. أحمد رشاد', d(2025, 6, 7), '17:00', '17:50', 50, 'waiting', 180, 20, 450, 2),
];

function row(
  rowNumber: number,
  bookingCode: string,
  customerPhone: string,
  customerName: string,
  serviceName: string,
  serviceType: BookingRegisterServiceType,
  employeeId: string,
  employeeName: string,
  scheduledDate: Date,
  startTime: string,
  endTime: string,
  durationMinutes: number,
  status: BookingRegisterStatus,
  paidAmount: number,
  discountAmount: number,
  totalAmount: number,
  notesCount: number
): BookingRegisterRow {
  return {
    id: `register-${rowNumber}`,
    rowNumber,
    bookingCode,
    customerPhone,
    customerName,
    serviceName,
    serviceType,
    employeeId,
    employeeName,
    scheduledDate,
    startTime,
    endTime,
    durationMinutes,
    status,
    paymentMethodKey: 'BOOKINGS.PAYMENT.CASH',
    paidAmount,
    discountAmount,
    totalAmount,
    notesCount,
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
