import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CustomerInquiryResult, InquiryPurchaseDetails } from '../models/customer-inquiry.model';

@Injectable({ providedIn: 'root' })
export class CustomerInquiryService {
  private readonly http = inject(HttpClient);

  findByMobile(mobile: string): Observable<CustomerInquiryResult | null> {
    return this.http.get<CustomerInquiryResult | null>(`${environment.apiUrl}/customers/inquiry`, {
      params: new HttpParams().set('mobile', mobile),
    });
  }

  getPurchaseDetails(purchaseId: string): Observable<InquiryPurchaseDetails> {
    return this.http.get<InquiryPurchaseDetails>(
      `${environment.apiUrl}/customers/purchases/${encodeURIComponent(purchaseId)}/inquiry`
    );
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
