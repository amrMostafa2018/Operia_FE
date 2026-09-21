import { TagSeverity } from '@app/shared/utils/status-tag.util';

/** Describes booking register status used by booking screens. */
export type BookingRegisterStatus = 'booked' | 'completed' | 'cancelled';

/** Describes booking register service type used by booking screens. */
export type BookingRegisterServiceType = 'package' | 'session' | 'unlisted';

/** Describes booking register history type used by booking screens. */
export type BookingRegisterHistoryType =
  'created' | 'employee_changed' | 'time_changed' | 'updated' | 'cancelled';

/** Describes booking register row used by booking screens. */
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
  branchId: string;
  branchName: string;
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
  version: string;
}

/** Describes booking register summary used by booking screens. */
export interface BookingRegisterSummary {
  total: number;
  cancelled: number;
  completed: number;
  booked: number;
}

/** Describes booking register history event used by booking screens. */
export interface BookingRegisterHistoryEvent {
  id: string;
  type: BookingRegisterHistoryType;
  actorName: string;
  actorRoleKey?: string;
  timestamp: Date;
  descriptionKey: string;
  descriptionParams?: Record<string, string>;
  markerClass: string;
}

/** Describes booking register filters used by the booking UI. */
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
  { label: 'BOOKING_REGISTER.STATUS.BOOKED', value: 'booked' },
  { label: 'BOOKING_REGISTER.STATUS.COMPLETED', value: 'completed' },
  { label: 'BOOKING_REGISTER.STATUS.CANCELLED', value: 'cancelled' },
];

const STATUS_SEVERITY: Record<BookingRegisterStatus, TagSeverity> = {
  booked: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_KEYS: Record<BookingRegisterStatus, string> = {
  booked: 'BOOKING_REGISTER.STATUS.BOOKED',
  completed: 'BOOKING_REGISTER.STATUS.COMPLETED',
  cancelled: 'BOOKING_REGISTER.STATUS.CANCELLED',
};

const SERVICE_TYPE_KEYS: Record<BookingRegisterServiceType, string> = {
  package: 'BOOKING_REGISTER.SERVICE_TYPE.PACKAGE',
  session: 'BOOKING_REGISTER.SERVICE_TYPE.SESSION',
  unlisted: 'BOOKING_REGISTER.SERVICE_TYPE.UNLISTED',
};

/** Maps a register status to its tag color. */
export function registerStatusSeverity(status: BookingRegisterStatus): TagSeverity {
  return STATUS_SEVERITY[status];
}

/** Returns the translation key for a register status. */
export function registerStatusKey(status: BookingRegisterStatus): string {
  return STATUS_KEYS[status];
}

/** Returns the translation key for a register service type. */
export function registerServiceTypeKey(type: BookingRegisterServiceType): string {
  return SERVICE_TYPE_KEYS[type];
}
