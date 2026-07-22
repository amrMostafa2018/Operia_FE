import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { EmployeePayload, EmployeeService } from './employee.service';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EmployeeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends employee filters to the tenant-scoped list endpoint', () => {
    service
      .list({ pageNumber: 2, pageSize: 10, search: 'EMP-0002', role: 'Admin', isActive: true })
      .subscribe();

    const request = http.expectOne(
      request => request.url === `${environment.apiUrl}/employees` && request.params.get('pageNumber') === '2'
    );
    expect(request.request.params.get('search')).toBe('EMP-0002');
    expect(request.request.params.get('role')).toBe('Admin');
    expect(request.request.params.get('isActive')).toBe('true');
    request.flush({ items: [], pageNumber: 2, pageSize: 10, totalCount: 0, totalPages: 0, roleCounts: [] });
  });

  it('creates an employee as multipart data with every branch', () => {
    const payload: EmployeePayload = {
      fullName: 'Test Employee', email: 'employee@example.com', mobileNumber: '+201001234567',
      userName: 'test.employee', specialty: 'Laser', jobTitle: 'Specialist', joiningDate: '2026-07-22',
      isActive: true, role: 'Staff', branchIds: ['branch-1', 'branch-2'], temporaryPassword: 'Temp@1234',
    };

    service.create(payload).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/employees`);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.getAll('branchIds')).toEqual(['branch-1', 'branch-2']);
    expect(body.get('temporaryPassword')).toBe('Temp@1234');
    request.flush({});
  });
});
