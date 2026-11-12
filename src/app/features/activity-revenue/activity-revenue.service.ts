import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ActivityRevenueSummary,
  InstallmentRevenuePage,
  RevenueBranch,
  RevenueReport,
  RevenueReportFilters,
  RevenueService,
  RevenuePaymentHistory,
} from './models/installment-revenue.model';

@Injectable({ providedIn: 'root' })
export class ActivityRevenueService {
  private readonly http = inject(HttpClient);

  listCollections(page: number, branchId: string | null): Observable<InstallmentRevenuePage> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InstallmentRevenuePage>(`${environment.apiUrl}/revenue/collections`, {
      params,
    });
  }

  summary(branchId: string | null): Observable<ActivityRevenueSummary> {
    const params = branchId ? new HttpParams().set('branchId', branchId) : new HttpParams();
    return this.http.get<ActivityRevenueSummary>(`${environment.apiUrl}/revenue/summary`, {
      params,
    });
  }

  branches(): Observable<RevenueBranch[]> {
    return this.http.get<RevenueBranch[]>(`${environment.apiUrl}/revenue/branches`);
  }

  services(): Observable<RevenueService[]> {
    return this.http.get<RevenueService[]>(`${environment.apiUrl}/revenue/services`);
  }

  report(filters: RevenueReportFilters, page: number, pageSize: number): Observable<RevenueReport> {
    return this.http.get<RevenueReport>(`${environment.apiUrl}/revenue/report`, {
      params: this.reportParams(filters).set('page', page).set('pageSize', pageSize),
    });
  }

  exportReport(filters: RevenueReportFilters): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/revenue/report/export`, {
      params: this.reportParams(filters),
      responseType: 'blob',
    });
  }

  review(paymentId: string, confirm: boolean): Observable<{ paymentId: string; status: string }> {
    return this.http.post<{ paymentId: string; status: string }>(
      `${environment.apiUrl}/revenue/payments/${encodeURIComponent(paymentId)}/${confirm ? 'confirm' : 'cancel'}`,
      {}
    );
  }

  proof(paymentId: string): Observable<Blob> {
    return this.http.get(
      `${environment.apiUrl}/revenue/payments/${encodeURIComponent(paymentId)}/proof`,
      { responseType: 'blob' }
    );
  }

  history(paymentId: string): Observable<RevenuePaymentHistory[]> {
    return this.http.get<RevenuePaymentHistory[]>(
      `${environment.apiUrl}/revenue/payments/${encodeURIComponent(paymentId)}/history`
    );
  }

  private reportParams(filters: RevenueReportFilters): HttpParams {
    let params = new HttpParams();
    if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters.toDate) params = params.set('toDate', filters.toDate);
    if (filters.branchId) params = params.set('branchId', filters.branchId);
    if (filters.serviceId) params = params.set('serviceId', filters.serviceId);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.mobile) params = params.set('mobile', filters.mobile);
    if (filters.customerName) params = params.set('customerName', filters.customerName);
    if (filters.employeeId) params = params.set('employeeId', filters.employeeId);
    return params;
  }
}
