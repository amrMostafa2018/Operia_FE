import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PaymentMethodId } from './models/booking.model';

/** Describes booking customer package dto exchanged with the API. */
export interface BookingCustomerPackageDto {
  customerPackageId: string;
  packageId: string;
  packageName: string;
  sessionDurationMinutes: number;
  totalSessions: number;
  usedSessions: number;
  reservedSessions: number;
  availableSessions: number;
  expiresOn: string | null;
  offerType: 'package' | 'session';
  sessionCount: number | null;
  pulseCount: number | null;
}

/** Describes booking customer dto exchanged with the API. */
export interface BookingCustomerDto {
  id: string;
  fullName: string;
  mobileNumber: string;
  packages: BookingCustomerPackageDto[];
}

/** Describes calendar booking item dto exchanged with the API. */
export interface CalendarBookingItemDto {
  id: string;
  name: string;
  type: 'package' | 'session' | 'unlisted';
  quantity: number;
  durationMinutes: number;
  unitPrice: number;
  packageId: string | null;
  customerPackageId: string | null;
  packageRemainingSessions: number | null;
  packagePulseCount: number | null;
  packageSessionLinked: boolean;
}

/** Describes calendar booking dto exchanged with the API. */
export interface CalendarBookingDto {
  id: string;
  bookingNumber: string;
  status: 'Booked' | 'Completed' | 'Cancelled';
  customerId: string;
  customerName: string;
  customerMobile: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  scheduledDate: string;
  startMinutes: number;
  endMinutes: number;
  source: string;
  paymentMethod: string | null;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  createdAt: string;
  version: string;
  items: CalendarBookingItemDto[];
}

/** Describes calendar booking hold dto exchanged with the API. */
export interface CalendarBookingHoldDto {
  id: string;
  employeeId: string;
  scheduledDate: string;
  startMinutes: number;
  endMinutes: number;
  expiresAtUtc: string;
}

/** Describes calendar bookings result dto exchanged with the API. */
export interface CalendarBookingsResultDto {
  bookings: CalendarBookingDto[];
  holds: CalendarBookingHoldDto[];
  serverNowUtc: string;
}

/** Describes create booking request exchanged with the API. */
export interface CreateBookingRequest {
  idempotencyKey: string;
  customerId: string;
  branchId: string;
  employeeId: string;
  scheduledDate: string;
  startMinutes: number;
  endMinutes: number;
  items: { packageId: string; customerPackageId: string | null; quantity: number; type?: string }[];
  paymentMethod?: string | null;
}

/** Describes create booking result exchanged with the API. */
export interface CreateBookingResult {
  id: string;
  bookingNumber: string;
  status: string;
  version: string;
}

/** Describes booking list item dto exchanged with the API. */
export interface BookingListItemDto {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerMobile: string;
  service: string;
  serviceType: 'PackageSession' | 'Service' | 'UnlistedService';
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  scheduledDate: string;
  startMinutes: number;
  endMinutes: number;
  status: 'Booked' | 'Completed' | 'Cancelled';
  version: string;
  paymentMethod: string | null;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
}

/** Describes booking list result dto exchanged with the API. */
export interface BookingListResultDto {
  items: BookingListItemDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  summary: { total: number; booked: number; completed: number; cancelled: number };
}

/** Describes booking history dto exchanged with the API. */
export interface BookingHistoryDto {
  id: string;
  action: string;
  changedByUserId: string | null;
  changedByDisplayName: string | null;
  occurredAt: string;
  changesJson: string | null;
}

/** Calls appointment and booking API endpoints and maps their transport contracts. */
@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/bookings`;

  /** Finds a registered customer and owned balances by mobile number. */
  findCustomer(mobile: string): Observable<BookingCustomerDto | null> {
    return this.http.get<BookingCustomerDto | null>(`${this.url}/customers/by-mobile`, {
      params: new HttpParams().set('mobile', mobile),
    });
  }

  /** Returns enabled payment method identifiers without account details. */
  getPaymentMethods(): Observable<PaymentMethodId[]> {
    return this.http.get<PaymentMethodId[]>(`${this.url}/payment-methods`);
  }

  /** Loads bookings and active holds for one branch and calendar range. */
  calendar(
    branchId: string,
    fromDate: string,
    toDate: string,
    employeeId?: string | null
  ): Observable<CalendarBookingsResultDto> {
    let params = new HttpParams()
      .set('branchId', branchId)
      .set('fromDate', fromDate)
      .set('toDate', toDate);
    if (employeeId) {
      params = params.set('employeeId', employeeId);
    }
    return this.http.get<CalendarBookingsResultDto>(`${this.url}/calendar`, { params });
  }

  /** Creates a booking with the request's idempotency key. */
  create(request: CreateBookingRequest): Observable<CreateBookingResult> {
    return this.http.post<CreateBookingResult>(this.url, request);
  }

  /** Cancels a booking using its current row version. */
  cancel(id: string, version: string): Observable<{ id: string; status: string; version: string }> {
    return this.http.post<{ id: string; status: string; version: string }>(
      `${this.url}/${encodeURIComponent(id)}/cancel`,
      { version }
    );
  }

  /** Saves item and payment changes using the booking's current row version. */
  update(
    id: string,
    version: string,
    items: {
      packageId: string;
      customerPackageId: string | null;
      quantity: number;
      type?: string;
    }[],
    paymentMethod: PaymentMethodId | null
  ): Observable<{ id: string; status: string; version: string }> {
    return this.http.put<{ id: string; status: string; version: string }>(
      `${this.url}/${encodeURIComponent(id)}`,
      { version, items, paymentMethod }
    );
  }

  /** Loads a filtered page and summary for the booking register. */
  list(params: {
    fromDate: string;
    toDate: string;
    pageNumber: number;
    pageSize: number;
    customerMobile?: string;
    customerName?: string;
    employeeId?: string | null;
    status?: string | null;
  }): Observable<BookingListResultDto> {
    let httpParams = new HttpParams()
      .set('fromDate', params.fromDate)
      .set('toDate', params.toDate)
      .set('pageNumber', params.pageNumber)
      .set('pageSize', params.pageSize);
    if (params.customerMobile) httpParams = httpParams.set('customerMobile', params.customerMobile);
    if (params.customerName) httpParams = httpParams.set('customerName', params.customerName);
    if (params.employeeId) httpParams = httpParams.set('employeeId', params.employeeId);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<BookingListResultDto>(this.url, { params: httpParams });
  }

  /** Loads the actor and timestamp history of an accessible booking. */
  history(id: string): Observable<BookingHistoryDto[]> {
    return this.http.get<BookingHistoryDto[]>(`${this.url}/${encodeURIComponent(id)}/history`);
  }

  /** Downloads the current register filter as CSV. */
  export(params: {
    fromDate: string;
    toDate: string;
    customerMobile?: string;
    customerName?: string;
    employeeId?: string | null;
    status?: string | null;
  }): Observable<Blob> {
    let httpParams = new HttpParams().set('fromDate', params.fromDate).set('toDate', params.toDate);
    if (params.customerMobile) httpParams = httpParams.set('customerMobile', params.customerMobile);
    if (params.customerName) httpParams = httpParams.set('customerName', params.customerName);
    if (params.employeeId) httpParams = httpParams.set('employeeId', params.employeeId);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get(`${this.url}/export`, { params: httpParams, responseType: 'blob' });
  }
}
