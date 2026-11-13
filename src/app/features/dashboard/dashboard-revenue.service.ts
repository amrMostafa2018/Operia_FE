import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface DashboardSummary {
  newCustomersMonth: number;
  todayBookings: number;
  monthlyBookings: number;
  todayRevenue: number;
  monthlyRevenue: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardRevenueService {
  private readonly http = inject(HttpClient);

  summary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${environment.apiUrl}/dashboard/summary`);
  }
}
