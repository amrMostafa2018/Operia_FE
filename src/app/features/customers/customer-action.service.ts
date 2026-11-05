import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CustomerBlockAction {
  customerId: string;
  customerName: string;
  mobile: string;
  customerVersion: string;
  isBlocked: boolean;
  blockReason: string | null;
}

export interface CustomerAction extends CustomerBlockAction {
  purchaseId: string;
  purchaseStatus: string;
  paid: number;
  refunded: number;
  remainingRefundable: number;
}

export interface RefundResult {
  refundId: string;
  amount: number;
  totalRefunded: number;
  remainingRefundable: number;
  purchaseStatus: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerActionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customers`;

  get(customerId: string, purchaseId: string): Observable<CustomerAction> {
    return this.http.get<CustomerAction>(
      `${this.base}/${encodeURIComponent(customerId)}/purchases/${encodeURIComponent(purchaseId)}/action`
    );
  }

  getSaleAction(customerId: string, saleId: string): Observable<CustomerBlockAction> {
    return this.http.get<CustomerBlockAction>(
      `${this.base}/${encodeURIComponent(customerId)}/sales/${encodeURIComponent(saleId)}/action`
    );
  }

  refund(
    purchaseId: string,
    amount: number,
    idempotencyKey: string,
    note: string | null
  ): Observable<RefundResult> {
    return this.http.post<RefundResult>(
      `${this.base}/purchases/${encodeURIComponent(purchaseId)}/cancel-refund`,
      { amount, idempotencyKey, note }
    );
  }

  setBlock(
    customerId: string,
    isBlocked: boolean,
    reason: string | null,
    version: string
  ): Observable<void> {
    return this.http.put<void>(`${this.base}/${encodeURIComponent(customerId)}/block`, {
      isBlocked,
      reason,
      version,
    });
  }
}
