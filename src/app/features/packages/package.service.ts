import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import {
  PackageCategoryOption,
  PackageDetail,
  PackageListItem,
  PackageListStatus,
  PackageOfferType,
} from './models/package-list.model';

export interface PackageListResult {
  items: PackageListItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  activeCount: number;
  cancelledCount: number;
}

export interface PackageQuery {
  pageNumber: number;
  pageSize: number;
  search?: string;
  offerType?: PackageOfferType;
  serviceCategoryId?: string;
  status?: PackageListStatus;
}

export interface PackagePayload {
  name: string;
  isActive: boolean;
  offerType: PackageOfferType;
  description: string;
  serviceCategoryId: string;
  subServiceCategoryId: string | null;
  sessionDurationMinutes: number;
  sessionCount: number;
  pulseCount: number | null;
  packageExpiryMonths: number | null;
  price: number;
  discountCode: string;
  discountPercent: number | null;
}

@Injectable({ providedIn: 'root' })
export class PackageService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/packages`;

  list(query: PackageQuery): Observable<PackageListResult> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PackageListResult>(this.url, { params });
  }

  listAllActive(): Observable<PackageListItem[]> {
    const pageSize = 50;
    return this.list({ pageNumber: 1, pageSize, status: 'active' }).pipe(
      switchMap(firstPage => {
        if (firstPage.totalPages <= 1) {
          return of(firstPage.items);
        }

        const remainingPages = Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
          this.list({ pageNumber: index + 2, pageSize, status: 'active' })
        );

        return forkJoin(remainingPages).pipe(
          map(pages => [firstPage.items, ...pages.map(page => page.items)].flat())
        );
      })
    );
  }

  get(id: string): Observable<PackageDetail> {
    return this.http.get<PackageDetail>(`${this.url}/${id}`);
  }

  create(payload: PackagePayload): Observable<PackageDetail> {
    return this.http.post<PackageDetail>(this.url, payload);
  }

  update(id: string, payload: PackagePayload): Observable<PackageDetail> {
    return this.http.put<PackageDetail>(`${this.url}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  listServiceCategories(): Observable<PackageCategoryOption[]> {
    return this.http.get<PackageCategoryOption[]>(`${this.url}/service-categories`);
  }

  listSubServiceCategories(serviceCategoryId?: string | null): Observable<PackageCategoryOption[]> {
    let params = new HttpParams();
    if (serviceCategoryId) {
      params = params.set('serviceCategoryId', serviceCategoryId);
    }
    return this.http.get<PackageCategoryOption[]>(`${this.url}/sub-service-categories`, { params });
  }

  createServiceCategory(payload: {
    name: string;
    icon: string;
  }): Observable<PackageCategoryOption> {
    return this.http.post<PackageCategoryOption>(`${this.url}/service-categories`, payload);
  }

  createSubServiceCategory(payload: {
    name: string;
    serviceCategoryId: string;
  }): Observable<PackageCategoryOption> {
    return this.http.post<PackageCategoryOption>(`${this.url}/sub-service-categories`, payload);
  }
}
