export type BookingStatus = 'pending' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  packageId: string;
  packageName: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  service: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

export interface BookingSummary {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
}

export interface BookingFilters {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  search?: string;
  employeeId?: string | null;
  status?: BookingStatus | null;
}

export interface BookingListResult {
  items: Booking[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateBookingPayload {
  customerId: string;
  packageId: string;
  branchId: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface UpdateBookingPayload {
  branchId?: string;
  employeeId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  isAvailable: boolean;
}

export const BOOKING_PAGE_SIZES = [5, 10, 25, 50, 100, 200, 500, 1000, 2000] as const;

export const BOOKING_STATUS_OPTIONS: { label: string; value: BookingStatus | null }[] = [
  { label: 'BOOKINGS.ALL_STATUS', value: null },
  { label: 'BOOKING_STATUS.PENDING', value: 'pending' },
  { label: 'BOOKING_STATUS.COMPLETED', value: 'completed' },
  { label: 'BOOKING_STATUS.CANCELLED', value: 'cancelled' },
];
