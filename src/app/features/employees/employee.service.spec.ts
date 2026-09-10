import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { EmployeePayload, EmployeeService, EmployeeWorkingDay } from './employee.service';

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
      .list({
        pageNumber: 2,
        pageSize: 10,
        search: 'EMP-0002',
        role: 'Admin',
        isActive: true,
        joiningDate: '2026-08-15',
      })
      .subscribe();

    const request = http.expectOne(
      request =>
        request.url === `${environment.apiUrl}/employees` &&
        request.params.get('pageNumber') === '2'
    );
    expect(request.request.params.get('search')).toBe('EMP-0002');
    expect(request.request.params.get('role')).toBe('Admin');
    expect(request.request.params.get('isActive')).toBe('true');
    expect(request.request.params.get('joiningDate')).toBe('2026-08-15');
    request.flush({
      items: [],
      pageNumber: 2,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
      roleCounts: [],
    });
  });

  it('maps list joiningDate from joiningDate and ignores createdAt', () => {
    let joiningDate = '';
    service.list({ pageNumber: 1, pageSize: 10 }).subscribe(result => {
      joiningDate = result.items[0].joiningDate;
    });

    const request = http.expectOne(
      req => req.url === `${environment.apiUrl}/employees` && req.params.get('pageNumber') === '1'
    );
    request.flush({
      items: [
        {
          id: 'emp-1',
          code: 'EMP-0001',
          fullName: 'Test Employee',
          email: 'employee@example.com',
          mobileNumber: '+201001234567',
          userName: 'test.employee',
          joiningDate: '2026-08-15',
          isActive: true,
          role: 'Staff',
          branches: [],
          createdAt: '2026-08-18T08:00:00Z',
        },
      ],
      pageNumber: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      roleCounts: [],
    });

    expect(joiningDate).toBe('2026-08-15');
  });

  it('creates an employee as multipart data with every branch', () => {
    const payload: EmployeePayload = {
      fullName: 'Test Employee',
      email: 'employee@example.com',
      mobileNumber: '+201001234567',
      userName: 'test.employee',
      specialty: 'Laser',
      jobTitle: 'Specialist',
      joiningDate: '2026-07-22',
      isActive: true,
      role: 'Staff',
      branchIds: ['branch-1', 'branch-2'],
      temporaryPassword: 'Temp@1234',
    };

    service.create(payload).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/employees`);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.getAll('branchIds')).toEqual(['branch-1', 'branch-2']);
    expect(body.get('temporaryPassword')).toBe('Temp@1234');
    request.flush({});
  });

  it('loads bookable staff for a branch', () => {
    service.listBookable('branch-1').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/employees/bookable?branchId=branch-1`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('loads and saves an employee weekly schedule', () => {
    const days: EmployeeWorkingDay[] = [
      { day: 'sat', enabled: true, fromTime: '10:00:00', toTime: '16:00:00' },
    ];

    service.getSchedule('employee-1').subscribe();
    const getRequest = http.expectOne(`${environment.apiUrl}/employees/employee-1/schedule`);
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush({ days });

    service.updateSchedule('employee-1', { days }).subscribe();
    const putRequest = http.expectOne(`${environment.apiUrl}/employees/employee-1/schedule`);
    expect(putRequest.request.method).toBe('PUT');
    expect(putRequest.request.body).toEqual({ days });
    putRequest.flush({ days });
  });
});
