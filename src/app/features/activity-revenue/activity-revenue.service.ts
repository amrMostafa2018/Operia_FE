import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { currentRevenuePeriodParams } from '@core/utils/revenue-period.util';
import {
  ActivityRevenueSummary,
  InstallmentRevenuePage,
  RevenueBranch,
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
    let params = currentRevenuePeriodParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<ActivityRevenueSummary>(`${environment.apiUrl}/revenue/summary`, {
      params,
    });
  }

  branches(): Observable<RevenueBranch[]> {
    return this.http.get<RevenueBranch[]>(`${environment.apiUrl}/revenue/branches`);
  }
}
