import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CustomerActionHistoryRow {
  id: string;
  atUtc: string;
  action: string;
  actor: string | null;
  oldValue: string | null;
  newValue: string | null;
  amount: number | null;
  reason: string | null;
  oldReason: string | null;
  newReason: string | null;
  referenceType: string;
  referenceId: string;
}

export interface CustomerActionHistoryPage {
  total: number;
  nextCursor: string | null;
  items: CustomerActionHistoryRow[];
}

@Injectable({ providedIn: 'root' })
export class CustomerActionHistoryService {
  private readonly http = inject(HttpClient);

  get(
    customerId: string,
    operationId: string,
    saleOnly: boolean,
    cursor: string | null
  ): Observable<CustomerActionHistoryPage> {
    const resource = saleOnly
      ? `sales/${encodeURIComponent(operationId)}`
      : `purchases/${encodeURIComponent(operationId)}`;
    return this.http.get<CustomerActionHistoryPage>(
      `${environment.apiUrl}/customers/${encodeURIComponent(customerId)}/${resource}/history`,
      { params: cursor ? { cursor } : {} }
    );
  }
}
