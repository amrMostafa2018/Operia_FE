import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface DashboardSummary {
  newCustomersMonth: number;
  todayBookings: number;
  monthlyBookings: number;
  todayRevenue: number;
  monthlyRevenue: number;
  pendingReviewCount: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardRevenueService {
  private readonly http = inject(HttpClient);

  summary(branchId?: string | null): Observable<DashboardSummary> {
    let params = new HttpParams();
    if (branchId) {
      params = params.set('branchId', branchId);
    }
    return this.http.get<DashboardSummary>(`${environment.apiUrl}/dashboard/summary`, { params });
  }
}
