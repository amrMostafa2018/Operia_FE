import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface StatementBalance {
  total: number;
  used: number;
  remaining: number;
}

export interface StatementSession {
  sessionNumber: number;
  date: string;
  startMinutes: number;
  performer: string | null;
  pulsesUsed: number | null;
  notes: string | null;
}

export interface StatementPayment {
  number: number;
  amount: number;
  status: string;
  paidAtUtc: string | null;
  paymentMethod: string | null;
  recordedBy: string | null;
  notes: string | null;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  mobile: string;
  customerActive: boolean;
  customerRestriction: string;
  operationCount: number;
  serviceName: string;
  serviceType: string;
  purchase: {
    id: string;
    purchasedAt: string;
    startsOn: string | null;
    expiresOn: string | null;
    packageStatus: string;
    paymentStatus: string;
    purchasePrice: number | null;
    amountPaid: number | null;
    amountRemaining: number | null;
    refunded: number;
    netCollected: number;
    refundStatus: string;
    pulses: StatementBalance | null;
    completedSessions: StatementSession[];
  };
  sessionBalance: StatementBalance | null;
  firstPayment: {
    amount: number;
    paidAtUtc: string;
    paymentMethod: string;
    recordedBy: string | null;
  } | null;
  installments: StatementPayment[];
}

@Injectable({ providedIn: 'root' })
export class CustomerStatementService {
  private readonly http = inject(HttpClient);

  get(customerId: string, purchaseId: string): Observable<CustomerStatement> {
    return this.http.get<CustomerStatement>(
      `${environment.apiUrl}/customers/${encodeURIComponent(customerId)}/purchases/${encodeURIComponent(purchaseId)}/statement`
    );
  }
}
