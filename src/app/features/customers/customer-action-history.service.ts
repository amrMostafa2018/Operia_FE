import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CustomerActionHistoryRow {
  id: string;
  atUtc: string;
  action: string;
  actor: string | null;
  amount: number | null;
  reason: string | null;
}

export interface CustomerActionHistoryPage {
  total: number;
  page: number;
  items: CustomerActionHistoryRow[];
}

@Injectable({ providedIn: 'root' })
export class CustomerActionHistoryService {
  private readonly http = inject(HttpClient);

  get(customerId: string, purchaseId: string, page: number): Observable<CustomerActionHistoryPage> {
    return this.http.get<CustomerActionHistoryPage>(
      `${environment.apiUrl}/customers/${encodeURIComponent(customerId)}/purchases/${encodeURIComponent(purchaseId)}/history`,
      { params: { page } }
    );
  }
}
