import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { InstallmentRevenuePage } from './models/installment-revenue.model';

@Injectable({ providedIn: 'root' })
export class ActivityRevenueService {
  private readonly http = inject(HttpClient);

  listInstallmentCollections(page: number): Observable<InstallmentRevenuePage> {
    return this.http.get<InstallmentRevenuePage>(
      `${environment.apiUrl}/revenue/installment-collections`,
      { params: new HttpParams().set('page', page).set('pageSize', 20) }
    );
  }
}
