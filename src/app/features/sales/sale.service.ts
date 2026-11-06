import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { BookingCustomerDto } from '@app/features/bookings/appointments-api.service';
import {
  PackageCategoryOption,
  PackageListItem,
} from '@app/features/packages/models/package-list.model';

export type SalePaymentOption = 'cash' | 'installment' | 'owned';

export interface SaleDraftItem {
  offerId: string | null;
  ownedCustomerPackageId: string | null;
  unlistedName: string | null;
  unlistedPrice: number | null;
  unlistedDurationMinutes: number | null;
  paymentOption: SalePaymentOption;
  quantity: number;
}

export interface SaleQuoteRequest {
  customerId: string | null;
  branchId: string | null;
  items: SaleDraftItem[];
  directCustomer: boolean;
}

export interface SaleQuoteLine {
  offerId: string | null;
  ownedCustomerPackageId: string | null;
  name: string;
  offerType: string;
  durationMinutes: number;
  sessionCount: number | null;
  quantity: number;
  paymentOption: SalePaymentOption;
  listPrice: number;
  discountAmount: number;
  finalAmount: number;
  dueNow: number;
  appliedDiscountCode?: string | null;
}

export interface SaleQuote {
  items: SaleQuoteLine[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  dueNow: number;
}

export interface ConfirmSaleRequest extends SaleQuoteRequest {
  branchId: string;
  paymentMethod: string | null;
  expectedGrandTotal: number;
  expectedDueNow: number;
  idempotencyKey: string;
  disposition: 'Close' | 'Later' | 'BookNow';
}

export interface ConfirmSaleResult {
  saleId: string;
  status: string;
  grandTotal: number;
  dueNow: number;
}

export interface SaleState {
  saleId: string;
  status: string;
  disposition: 'Close' | 'Later' | 'BookNow';
  branchId: string;
  durationMinutes: number;
  grandTotal: number;
  dueNow: number;
  collectionId: string | null;
  paymentConfirmed: boolean;
  bookingId: string | null;
}

export interface CollectSaleResult {
  saleId: string;
  collectionId: string;
  paymentConfirmed: boolean;
  amountCollected: number;
  saleStatus: string;
}

export interface BookSaleRequest {
  saleId: string;
  employeeId: string;
  scheduledDate: string;
  startMinutes: number;
  endMinutes: number;
}

export interface BookSaleResult {
  saleId: string;
  bookingId: string | null;
  status: 'Booked' | 'BookingPending';
  recoveryCode: string | null;
}

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/sales`;

  catalog(): Observable<{ items: PackageListItem[] }> {
    return this.http.get<{ items: PackageListItem[] }>(`${this.url}/catalog`);
  }

  categories(): Observable<PackageCategoryOption[]> {
    return this.http.get<PackageCategoryOption[]>(`${this.url}/categories`);
  }

  branches(): Observable<{ id: string; name: string }[]> {
    return this.http.get<{ id: string; name: string }[]>(`${this.url}/branches`);
  }

  paymentMethods(): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/payment-methods`);
  }

  customer(mobile: string): Observable<BookingCustomerDto | null> {
    return this.http.get<BookingCustomerDto | null>(`${this.url}/customer`, {
      params: new HttpParams().set('mobile', mobile),
    });
  }

  quote(request: SaleQuoteRequest): Observable<SaleQuote> {
    return this.http.post<SaleQuote>(`${this.url}/quote`, request);
  }

  confirm(request: ConfirmSaleRequest): Observable<ConfirmSaleResult> {
    return this.http.post<ConfirmSaleResult>(`${this.url}/confirm`, request);
  }

  state(saleId: string): Observable<SaleState> {
    return this.http.get<SaleState>(`${this.url}/${encodeURIComponent(saleId)}`);
  }

  collect(
    saleId: string,
    idempotencyKey: string,
    paymentConfirmed: boolean
  ): Observable<CollectSaleResult> {
    return this.http.post<CollectSaleResult>(`${this.url}/collect`, {
      saleId,
      idempotencyKey,
      paymentConfirmed,
    });
  }

  book(request: BookSaleRequest): Observable<BookSaleResult> {
    return this.http.post<BookSaleResult>(`${this.url}/book`, request);
  }
}
