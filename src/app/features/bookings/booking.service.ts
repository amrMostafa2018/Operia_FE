import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AvailabilitySlot,
  Booking,
  BookingFilters,
  BookingListResult,
  BookingStatus,
  BookingSummary,
  CreateBookingPayload,
  UpdateBookingPayload,
} from './models/booking.model';
import {
  MOCK_BRANCHES,
  MOCK_CUSTOMERS,
  MOCK_EMPLOYEES,
  MOCK_PACKAGES,
  MockCustomer,
  MockPackage,
} from './models/mock-directory.model';
import { parseTimeToMinutes } from './bookings-calendar/bookings-calendar.utils';
import { WorkingHoursService } from './working-hours.service';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTime(time: string): number {
  return parseTimeToMinutes(time);
}

function generateBookingNumber(mobile: string): string {
  const suffix = mobile.slice(-8);
  return `1${suffix}${Date.now().toString().slice(-4)}`;
}

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'bk-1',
    bookingNumber: '10001001234567',
    customerId: 'cust-1',
    customerName: 'محمد علي',
    customerPhone: '01001234567',
    packageId: 'pkg-1',
    packageName: 'إزالة الشعر بالليزر - الجسم الكامل',
    branchId: 'br-1',
    branchName: 'الفرع الرئيسي',
    employeeId: 'emp-1',
    employeeName: 'د. سارة محمود',
    service: 'إزالة الشعر بالليزر\nمنطقة الجسم الكامل',
    date: todayIso(),
    startTime: '09:00',
    endTime: '09:45',
    status: 'pending',
  },
  {
    id: 'bk-2',
    bookingNumber: '10009876543',
    customerId: 'cust-2',
    customerName: 'نهيان علي',
    customerPhone: '01009876543',
    packageId: 'pkg-2',
    packageName: 'تنظيف البشرة',
    branchId: 'br-1',
    branchName: 'الفرع الرئيسي',
    employeeId: 'emp-1',
    employeeName: 'د. سارة محمود',
    service: 'تنظيف البشرة',
    date: todayIso(),
    startTime: '10:00',
    endTime: '10:45',
    status: 'completed',
  },
  {
    id: 'bk-3',
    bookingNumber: '10005557890',
    customerId: 'cust-3',
    customerName: 'جيهان علي',
    customerPhone: '01005557890',
    packageId: 'pkg-3',
    packageName: 'شد الجسم',
    branchId: 'br-2',
    branchName: 'فرع المعادي',
    employeeId: 'emp-3',
    employeeName: 'ليلى اللوز',
    service: 'شد الجسم',
    date: todayIso(),
    startTime: '11:00',
    endTime: '11:45',
    status: 'pending',
  },
  {
    id: 'bk-4',
    bookingNumber: '10002223333',
    customerId: 'cust-4',
    customerName: 'أسماء محمود',
    customerPhone: '01002223333',
    packageId: 'pkg-4',
    packageName: 'جلسة ليزر نور',
    branchId: 'br-1',
    branchName: 'الفرع الرئيسي',
    employeeId: 'emp-2',
    employeeName: 'جهاد محمد',
    service: 'جلسة ليزر نور',
    date: todayIso(),
    startTime: '12:30',
    endTime: '13:00',
    status: 'cancelled',
  },
  {
    id: 'bk-5',
    bookingNumber: '10004446666',
    customerId: 'cust-5',
    customerName: 'محمد فاضل',
    customerPhone: '01004446666',
    packageId: 'pkg-5',
    packageName: 'إزالة الشعر بالليزر - الجسم الكامل',
    branchId: 'br-1',
    branchName: 'الفرع الرئيسي',
    employeeId: 'emp-1',
    employeeName: 'د. سارة محمود',
    service: 'إزالة الشعر بالليزر\nمنطقة الجسم الكامل',
    date: todayIso(),
    startTime: '13:00',
    endTime: '13:45',
    status: 'pending',
  },
];

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly workingHours = inject(WorkingHoursService);
  private readonly bookings$ = new BehaviorSubject<Booking[]>([...INITIAL_BOOKINGS]);
  private packages = [...MOCK_PACKAGES];

  get bookings(): Observable<Booking[]> {
    return this.bookings$.asObservable();
  }

  list(
    filters: BookingFilters,
    pageNumber: number,
    pageSize: number
  ): Observable<BookingListResult> {
    return this.bookings$.pipe(
      map(all => {
        let result = this.applyFilters(all, filters);
        const totalCount = result.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const start = (pageNumber - 1) * pageSize;
        result = result.slice(start, start + pageSize);
        return { items: result, totalCount, pageNumber, pageSize, totalPages };
      })
    );
  }

  listAll(filters: BookingFilters): Observable<Booking[]> {
    return this.bookings$.pipe(map(all => this.applyFilters(all, filters)));
  }

  summary(filters: BookingFilters): Observable<BookingSummary> {
    return this.bookings$.pipe(
      map(all => {
        const filtered = this.applyFilters(all, filters);
        return {
          total: filtered.length,
          completed: filtered.filter(b => b.status === 'completed').length,
          pending: filtered.filter(b => b.status === 'pending').length,
          cancelled: filtered.filter(b => b.status === 'cancelled').length,
        };
      })
    );
  }

  getTodayBookings(): Observable<Booking[]> {
    const today = todayIso();
    return this.bookings$.pipe(map(all => all.filter(b => b.date === today)));
  }

  searchCustomerByMobile(mobile: string): Observable<{
    customer: MockCustomer;
    packages: MockPackage[];
  } | null> {
    const normalized = mobile.replace(/\D/g, '');
    const customer = MOCK_CUSTOMERS.find(c => c.mobile.replace(/\D/g, '') === normalized);
    if (!customer) return of(null);
    const packages = this.packages.filter(p => p.customerId === customer.id);
    return of({ customer, packages });
  }

  getBranches(): Observable<typeof MOCK_BRANCHES> {
    return of([...MOCK_BRANCHES]);
  }

  getBookableEmployees(branchId: string): Observable<typeof MOCK_EMPLOYEES> {
    return of(MOCK_EMPLOYEES.filter(e => e.branchIds.includes(branchId)));
  }

  getAvailability(
    branchId: string,
    employeeId: string,
    date: string,
    sessionDurationMinutes = 45
  ): Observable<AvailabilitySlot[]> {
    const booked = this.bookings$
      .getValue()
      .filter(
        b =>
          b.employeeId === employeeId &&
          b.branchId === branchId &&
          b.date === date &&
          b.status !== 'cancelled'
      )
      .map(b => ({ startTime: b.startTime, endTime: b.endTime }));

    return of(
      this.workingHours.generateAvailabilitySlots(date, sessionDurationMinutes, booked)
    );
  }

  createBooking(payload: CreateBookingPayload): Observable<Booking> {
    const customer = MOCK_CUSTOMERS.find(c => c.id === payload.customerId);
    const pkg = this.packages.find(p => p.id === payload.packageId);
    const branch = MOCK_BRANCHES.find(b => b.id === payload.branchId);
    const employee = MOCK_EMPLOYEES.find(e => e.id === payload.employeeId);

    if (!customer || !pkg || !branch || !employee) {
      throw new Error('BOOKINGS.ERRORS.INVALID_SELECTION');
    }
    if (pkg.status !== 'active' || pkg.remainingSessions <= 0) {
      throw new Error('BOOKINGS.ERRORS.NO_ACTIVE_PACKAGE');
    }

    const bookingDate = new Date(payload.date + 'T12:00:00');
    if (!this.workingHours.isWithinWorkingHours(bookingDate, payload.startTime, payload.endTime)) {
      throw new Error('BOOKINGS.ERRORS.OUTSIDE_WORKING_HOURS');
    }

    const collision = this.bookings$
      .getValue()
      .some(
        b =>
          b.employeeId === payload.employeeId &&
          b.date === payload.date &&
          b.status !== 'cancelled' &&
          parseTime(payload.startTime) < parseTime(b.endTime) &&
          parseTime(payload.endTime) > parseTime(b.startTime)
      );
    if (collision) {
      throw new Error('BOOKINGS.ERRORS.SLOT_TAKEN');
    }

    const booking: Booking = {
      id: `bk-${Date.now()}`,
      bookingNumber: generateBookingNumber(customer.mobile),
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.mobile,
      packageId: pkg.id,
      packageName: pkg.name,
      branchId: branch.id,
      branchName: branch.name,
      employeeId: employee.id,
      employeeName: employee.fullName,
      service: pkg.name,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: 'pending',
    };

    pkg.usedSessions += 1;
    pkg.remainingSessions -= 1;
    this.bookings$.next([...this.bookings$.getValue(), booking]);
    return of(booking);
  }

  updateBooking(id: string, payload: UpdateBookingPayload): Observable<Booking> {
    const all = this.bookings$.getValue();
    const idx = all.findIndex(b => b.id === id);
    if (idx < 0) throw new Error('BOOKINGS.ERRORS.NOT_FOUND');

    const current = all[idx];
    const branch = payload.branchId
      ? MOCK_BRANCHES.find(b => b.id === payload.branchId)
      : null;
    const employee = payload.employeeId
      ? MOCK_EMPLOYEES.find(e => e.id === payload.employeeId)
      : null;

    const updated: Booking = {
      ...current,
      branchId: branch?.id ?? current.branchId,
      branchName: branch?.name ?? current.branchName,
      employeeId: employee?.id ?? current.employeeId,
      employeeName: employee?.fullName ?? current.employeeName,
      date: payload.date ?? current.date,
      startTime: payload.startTime ?? current.startTime,
      endTime: payload.endTime ?? current.endTime,
    };

    const next = [...all];
    next[idx] = updated;
    this.bookings$.next(next);
    return of(updated);
  }

  changeStatus(id: string, status: BookingStatus): Observable<Booking> {
    const all = this.bookings$.getValue();
    const idx = all.findIndex(b => b.id === id);
    if (idx < 0) throw new Error('BOOKINGS.ERRORS.NOT_FOUND');
    const next = [...all];
    next[idx] = { ...next[idx], status };
    this.bookings$.next(next);
    return of(next[idx]);
  }

  cancelBooking(id: string): Observable<Booking> {
    return this.changeStatus(id, 'cancelled');
  }

  reassignEmployee(id: string, employeeId: string): Observable<Booking> {
    const employee = MOCK_EMPLOYEES.find(e => e.id === employeeId);
    if (!employee) throw new Error('BOOKINGS.ERRORS.INVALID_SELECTION');
    return this.updateBooking(id, { employeeId });
  }

  getById(id: string): Observable<Booking | undefined> {
    return this.bookings$.pipe(map(all => all.find(b => b.id === id)));
  }

  getEmployees(): Observable<typeof MOCK_EMPLOYEES> {
    return of([...MOCK_EMPLOYEES]);
  }

  exportBookings(_filters: BookingFilters): void {
    // placeholder — real export wired when API is ready
  }

  private applyFilters(all: Booking[], filters: BookingFilters): Booking[] {
    let result = [...all];
    if (filters.dateFrom) {
      const from = filters.dateFrom.toISOString().slice(0, 10);
      result = result.filter(b => b.date >= from);
    }
    if (filters.dateTo) {
      const to = filters.dateTo.toISOString().slice(0, 10);
      result = result.filter(b => b.date <= to);
    }
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        b =>
          b.customerName.toLowerCase().includes(q) ||
          b.customerPhone.includes(q) ||
          b.bookingNumber.includes(q)
      );
    }
    if (filters.employeeId) {
      result = result.filter(b => b.employeeId === filters.employeeId);
    }
    if (filters.status) {
      result = result.filter(b => b.status === filters.status);
    }
    return result;
  }
}
