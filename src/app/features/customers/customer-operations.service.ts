import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CustomerOperationsFilters {
  fromDate: string;
  toDate: string;
  customer: string;
  mobile: string;
  service: string;
  serviceType: string;
  status: string;
  paymentType: string;
}

export interface CustomerOperation {
  id: string;
  saleId: string;
  customerId: string;
  customerName: string;
  mobile: string;
  branchName: string;
  service: string;
  serviceType: string;
  operationDate: string;
  paymentType: string;
  total: number;
  collected: number;
  remaining: number;
  unitsTotal: number | null;
  unitsRemaining: number | null;
  customerRestriction: string;
  purchaseStatus: string;
  paymentStatus: string;
  installmentDueStatus: string;
}

export interface CustomerOperationsPage {
  totalCount: number;
  page: number;
  pageSize: number;
  totalSales: number;
  totalCollected: number;
  totalRemaining: number;
  rows: CustomerOperation[];
}

@Injectable({ providedIn: 'root' })
export class CustomerOperationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/customers/operations`;

  list(
    filters: CustomerOperationsFilters,
    page: number,
    pageSize: number
  ): Observable<CustomerOperationsPage> {
    return this.http.get<CustomerOperationsPage>(this.baseUrl, {
      params: this.params(filters).set('page', page).set('pageSize', pageSize),
    });
  }

  export(filters: CustomerOperationsFilters): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export`, {
      params: this.params(filters),
      responseType: 'blob',
    });
  }

  private params(filters: CustomerOperationsFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) {
        params = params.set(key, value.trim());
      }
    }
    return params;
  }
}
