import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  approveAddBalancePlatform(revenueId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/add-balance-platform/${revenueId}/approve`, {});
  }

  activateSubscription(subscriptionId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/subscriptions/${subscriptionId}/activate`, {});
  }
}
