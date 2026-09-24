import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

/** Describes branch used by booking screens. */
export interface Branch {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
}

/** Describes branch list result exchanged with the API. */
export interface BranchListResult {
  items: Branch[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  totalTenantCount: number;
}

/** Describes branch payload used by the booking UI. */
export interface BranchPayload {
  name: string;
  address: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
}

/** Calls branch administration and booking branch lookup endpoints. */
@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/branches`;

  /** Loads only branches available to the signed-in booking user. */
  listBookable(): Observable<Pick<Branch, 'id' | 'name'>[]> {
    return this.http.get<Pick<Branch, 'id' | 'name'>[]>(`${this.url}/bookable`);
  }

  list(query: {
    pageNumber: number;
    pageSize: number;
    search: string;
    sortBy: string;
    sortDirection: string;
  }): Observable<BranchListResult> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<BranchListResult>(this.url, { params });
  }

  create(payload: BranchPayload): Observable<Branch> {
    return this.http.post<Branch>(this.url, payload);
  }
  update(id: string, payload: BranchPayload): Observable<Branch> {
    return this.http.put<Branch>(`${this.url}/${id}`, payload);
  }
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
