import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '@env/environment';
import {
  mapSubscriptionDto,
  PagedResult,
  PagedResultApiDto,
  SubscriptionFilters,
  SubscriptionRow,
  TenantSubscriptionApiDto,
} from '@app/features/operia-subscriptions/models/operia-subscriptions.model';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/finance`;

  getSubscriptions(
    filters: SubscriptionFilters,
    pageNumber: number,
    pageSize: number,
  ): Observable<PagedResult<SubscriptionRow>> {
    let params = new HttpParams()
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    params = this.appendFilters(params, filters);

    return this.http
      .get<PagedResultApiDto<TenantSubscriptionApiDto>>(`${this.baseUrl}/subscriptions`, {
        params,
      })
      .pipe(
        map(response => ({
          items: response.items.map(mapSubscriptionDto),
          pageNumber: response.pageNumber,
          pageSize: response.pageSize,
          totalCount: response.totalCount,
          totalPages: response.totalPages,
          hasPreviousPage: response.hasPreviousPage,
          hasNextPage: response.hasNextPage,
        })),
      );
  }

  exportSubscriptions(filters: SubscriptionFilters): Observable<Blob> {
    const params = this.appendFilters(new HttpParams(), filters);

    return this.http.get(`${this.baseUrl}/subscriptions/export`, {
      params,
      responseType: 'blob',
    });
  }

  private appendFilters(params: HttpParams, filters: SubscriptionFilters): HttpParams {
    if (filters.dateFrom) {
      params = params.set('dateFrom', this.toApiDate(filters.dateFrom));
    }

    if (filters.dateTo) {
      params = params.set('dateTo', this.toApiDate(filters.dateTo));
    }

    if (filters.planCode) {
      params = params.set('planCode', filters.planCode);
    }

    if (filters.status) {
      params = params.set('status', filters.status);
    }

    return params;
  }

  private toApiDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
