import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface DashboardRevenue {
  today: number;
  month: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardRevenueService {
  private readonly http = inject(HttpClient);

  current(): Observable<DashboardRevenue> {
    const now = new Date();
    const todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const params = new HttpParams()
      .set('todayFromUtc', todayFrom.toISOString())
      .set('todayToUtc', todayTo.toISOString())
      .set('monthFromUtc', monthFrom.toISOString())
      .set('monthToUtc', monthTo.toISOString());
    return this.http.get<DashboardRevenue>(`${environment.apiUrl}/dashboard/revenue`, { params });
  }
}
