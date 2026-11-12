import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface DashboardRevenue {
  today: number;
  month: number;
}

export interface DashboardNewCustomers {
  count: number;
}

export interface DashboardMonthlyBookings {
  count: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardRevenueService {
  private readonly http = inject(HttpClient);

  current(): Observable<DashboardRevenue> {
    return this.http.get<DashboardRevenue>(`${environment.apiUrl}/dashboard/revenue`);
  }

  newCustomers(): Observable<DashboardNewCustomers> {
    return this.http.get<DashboardNewCustomers>(`${environment.apiUrl}/dashboard/new-customers`);
  }

  monthlyBookings(): Observable<DashboardMonthlyBookings> {
    return this.http.get<DashboardMonthlyBookings>(
      `${environment.apiUrl}/dashboard/monthly-bookings`
    );
  }
}
