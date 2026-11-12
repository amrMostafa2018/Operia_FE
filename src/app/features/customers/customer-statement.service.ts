import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';

export interface StatementBalance {
  total: number;
  used: number;
  remaining: number;
  bookable?: number;
  released?: number;
}

export interface StatementSession {
  sessionNumber: number;
  date: string;
  startMinutes: number;
  performer: string | null;
  pulsesUsed: number | null;
  notes: string | null;
  sessionType: string | null;
}

export interface StatementPayment {
  number: number;
  amount: number;
  status: string;
  paidAtUtc: string | null;
  dueOn: string | null;
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
    netCollected: number | null;
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
  registeredAt: string;
  nextInstallmentEligible: boolean;
  nextInstallmentNumber: number | null;
  nextInstallmentAmount: number | null;
  paymentMethods: string[];
  collectionIdempotencyKeys: string[];
}

@Injectable({ providedIn: 'root' })
export class CustomerStatementService {
  private readonly http = inject(HttpClient);
  private readonly statements = new Map<string, CustomerStatement>();

  peek(customerId: string, purchaseId: string): CustomerStatement | null {
    return this.statements.get(this.key(customerId, purchaseId)) ?? null;
  }

  get(customerId: string, purchaseId: string): Observable<CustomerStatement> {
    const key = this.key(customerId, purchaseId);
    return this.http
      .get<CustomerStatement>(
        `${environment.apiUrl}/customers/${encodeURIComponent(customerId)}/purchases/${encodeURIComponent(purchaseId)}/statement`
      )
      .pipe(tap(statement => this.remember(key, statement)));
  }

  private key(customerId: string, purchaseId: string): string {
    return `${customerId}:${purchaseId}`;
  }

  private remember(key: string, statement: CustomerStatement): void {
    if (this.statements.has(key)) {
      this.statements.delete(key);
    }

    this.statements.set(key, statement);
    while (this.statements.size > 30) {
      const oldest = this.statements.keys().next().value;
      if (oldest === undefined) {
        return;
      }

      this.statements.delete(oldest);
    }
  }

  collectInstallment(
    purchaseId: string,
    paymentMethod: string,
    idempotencyKey: string
  ): Observable<unknown> {
    return this.http.post(
      `${environment.apiUrl}/customers/purchases/${encodeURIComponent(purchaseId)}/installments`,
      { paymentMethod, idempotencyKey }
    );
  }
}
