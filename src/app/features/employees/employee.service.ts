import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '@env/environment';

export type EmployeeRole = 'Admin' | 'Reception' | 'Staff';
export type EmployeeRoleResponse = EmployeeRole | 'SuperAdmin';
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
  role: EmployeeRoleResponse;
  branches: EmployeeBranch[];
  createdAt: string;
}
export interface EmployeeRoleCount {
  role: EmployeeRoleResponse;
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
  joiningDate?: string;
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
export interface EmployeeBranchSchedule {
  branchId: string;
  branchName: string;
  days: EmployeeWorkingDay[];
}
export interface EmployeeSchedule {
  branches: EmployeeBranchSchedule[];
}

export interface BookableEmployee {
  id: string;
  code: string;
  fullName: string;
  photoUrl?: string | null;
  specialty?: string | null;
  jobTitle?: string | null;
  workingDays: EmployeeWorkingDay[];
}

function toJoiningDateValue(value: unknown): string {
  if (value && typeof value === 'object' && 'year' in value && 'month' in value && 'day' in value) {
    const date = value as { year: number; month: number; day: number };
    return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  }

  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10);
  }

  return '';
}

function mapEmployee(employee: Employee): Employee {
  return {
    ...employee,
    joiningDate: toJoiningDateValue(employee.joiningDate),
  };
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
    return this.http.get<EmployeeListResult>(this.url, { params }).pipe(
      map(result => ({
        ...result,
        items: result.items.map(mapEmployee),
      }))
    );
  }
  get(id: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.url}/${id}`).pipe(map(mapEmployee));
  }
  create(payload: EmployeePayload, schedule?: EmployeeBranchSchedule[]): Observable<Employee> {
    return this.http
      .post<Employee>(this.url, this.toFormData(payload, schedule))
      .pipe(map(mapEmployee));
  }
  update(id: string, payload: EmployeePayload): Observable<Employee> {
    return this.http
      .put<Employee>(`${this.url}/${id}`, this.toFormData(payload))
      .pipe(map(mapEmployee));
  }
  changeRole(id: string, role: EmployeeRole): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/role`, { role });
  }
  changeStatus(id: string, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/status`, { isActive });
  }
  listBookable(branchId: string): Observable<BookableEmployee[]> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.get<BookableEmployee[]>(`${this.url}/bookable`, { params });
  }

  getSchedule(id: string): Observable<EmployeeSchedule> {
    return this.http.get<EmployeeSchedule>(`${this.url}/${id}/schedule`);
  }
  updateSchedule(id: string, schedule: EmployeeSchedule): Observable<EmployeeSchedule> {
    return this.http.put<EmployeeSchedule>(`${this.url}/${id}/schedule`, schedule);
  }
  private toFormData(payload: EmployeePayload, schedule?: EmployeeBranchSchedule[]): FormData {
    const data = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'branchIds') (value as string[]).forEach(id => data.append('branchIds', id));
      else if (value instanceof File) data.append('photo', value, value.name);
      else if (value !== undefined && value !== null) data.append(key, String(value));
    });
    if (schedule) {
      data.append('scheduleJson', JSON.stringify(schedule));
    }
    return data;
  }
}
