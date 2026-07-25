import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
}

export interface BranchListResult {
  items: Branch[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  totalTenantCount: number;
}

export interface BranchPayload {
  name: string;
  address: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/branches`;

  list(query: {
    pageNumber: number;
    pageSize: number;
    search: string;
    sortBy: string;
    sortDirection: string;
  }): Observable<BranchListResult> {
    const params = new HttpParams({ fromObject: query });
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
