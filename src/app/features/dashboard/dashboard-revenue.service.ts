import { HttpClient } from '@angular/common/http';
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
    return this.http.get<DashboardRevenue>(`${environment.apiUrl}/dashboard/revenue`);
  }
}
