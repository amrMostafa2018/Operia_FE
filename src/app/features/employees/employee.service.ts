import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type EmployeeRole = 'SuperAdmin' | 'Admin' | 'Reception' | 'Staff';
export interface EmployeeBranch {
  id: string;
  name: string;
}
export interface Employee {
  id: string;
  code: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  userName: string;
  specialty?: string;
  jobTitle?: string;
  joiningDate: string;
  photoUrl?: string;
  isActive: boolean;
  role: EmployeeRole;
  branches: EmployeeBranch[];
  createdAt: string;
}
export interface EmployeeRoleCount {
  role: EmployeeRole;
  count: number;
}
export interface EmployeeListResult {
  items: Employee[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  roleCounts: EmployeeRoleCount[];
}
export interface EmployeeQuery {
  pageNumber: number;
  pageSize: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  branchId?: string;
  createdFrom?: string;
  createdTo?: string;
}
export interface EmployeePayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  userName: string;
  specialty: string;
  jobTitle: string;
  joiningDate: string;
  isActive: boolean;
  role: EmployeeRole;
  branchIds: string[];
  temporaryPassword?: string;
  photo?: File;
  removePhoto?: boolean;
}
export interface EmployeeWorkingDay {
  day: string;
  enabled: boolean;
  fromTime: string | null;
  toTime: string | null;
}
export interface EmployeeSchedule {
  days: EmployeeWorkingDay[];
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/employees`;
  list(query: EmployeeQuery): Observable<EmployeeListResult> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null)
        params = params.set(key, String(value));
    });
    return this.http.get<EmployeeListResult>(this.url, { params });
  }
  get(id: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.url}/${id}`);
  }
  create(payload: EmployeePayload): Observable<Employee> {
    return this.http.post<Employee>(this.url, this.toFormData(payload));
  }
  update(id: string, payload: EmployeePayload): Observable<Employee> {
    return this.http.put<Employee>(`${this.url}/${id}`, this.toFormData(payload));
  }
  changeRole(id: string, role: EmployeeRole): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/role`, { role });
  }
  changeStatus(id: string, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/status`, { isActive });
  }
  getSchedule(id: string): Observable<EmployeeSchedule> {
    return this.http.get<EmployeeSchedule>(`${this.url}/${id}/schedule`);
  }
  updateSchedule(id: string, schedule: EmployeeSchedule): Observable<EmployeeSchedule> {
    return this.http.put<EmployeeSchedule>(`${this.url}/${id}/schedule`, schedule);
  }
  private toFormData(payload: EmployeePayload): FormData {
    const data = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'branchIds') (value as string[]).forEach(id => data.append('branchIds', id));
      else if (value instanceof File) data.append('photo', value, value.name);
      else if (value !== undefined && value !== null) data.append(key, String(value));
    });
    return data;
  }
}
