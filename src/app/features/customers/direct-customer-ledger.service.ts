import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface DirectCustomerSale {
  saleId: string;
  createdAt: string;
  cashierId: string | null;
  branchId: string;
  amount: number;
  status: string;
  items: string[];
}

export interface DirectCustomerLedger {
  customerId: string;
  totalSales: number;
  sales: DirectCustomerSale[];
}

@Injectable({ providedIn: 'root' })
export class DirectCustomerLedgerService {
  private readonly http = inject(HttpClient);

  list(page: number): Observable<DirectCustomerLedger | null> {
    return this.http.get<DirectCustomerLedger | null>(
      `${environment.apiUrl}/customers/direct-sales`,
      { params: new HttpParams().set('page', page) }
    );
  }
}
