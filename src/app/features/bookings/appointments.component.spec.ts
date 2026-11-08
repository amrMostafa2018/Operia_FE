import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { PermissionService } from '@core/services/permission.service';
import { LanguageService } from '@core/services/language.service';
import { BranchService } from '@app/features/branches/branch.service';
import { BookableEmployee, EmployeeService } from '@app/features/employees/employee.service';
import { PackageService } from '@app/features/packages/package.service';
import { SaleService } from '@app/features/sales/sale.service';
import { AppointmentsApiService } from './appointments-api.service';
import { SaleHandoffService } from './sale-handoff.service';
import { AppointmentsComponent } from './appointments.component';
import { BookingRecord } from './models/booking.model';

describe('AppointmentsComponent employee request race condition', () => {
  let employeeService: jasmine.SpyObj<EmployeeService>;
  let messageService: jasmine.SpyObj<MessageService>;
  let appointmentsApi: jasmine.SpyObj<AppointmentsApiService>;
  let branchService: jasmine.SpyObj<BranchService>;
  let packageService: jasmine.SpyObj<PackageService>;
  let saleHandoff: jasmine.SpyObj<SaleHandoffService>;

  beforeEach(async () => {
    employeeService = jasmine.createSpyObj<EmployeeService>('EmployeeService', ['listBookable']);
    messageService = jasmine.createSpyObj<MessageService>('MessageService', ['add']);
    appointmentsApi = jasmine.createSpyObj<AppointmentsApiService>('AppointmentsApiService', [
      'calendar',
      'findCustomer',
      'getPaymentMethods',
    ]);
    branchService = jasmine.createSpyObj<BranchService>('BranchService', ['listBookable']);
    packageService = jasmine.createSpyObj<PackageService>('PackageService', [
      'listAllActive',
      'listServiceCategories',
    ]);
    saleHandoff = jasmine.createSpyObj<SaleHandoffService>('SaleHandoffService', ['consumeDraft']);

    branchService.listBookable.and.returnValue(of([{ id: 'branch-1', name: 'Branch 1' }]));
    packageService.listAllActive.and.returnValue(of([]));
    packageService.listServiceCategories.and.returnValue(of([]));
    saleHandoff.consumeDraft.and.returnValue(null);
    appointmentsApi.calendar.and.returnValue(
      of({ bookings: [], holds: [], serverNowUtc: new Date().toISOString() })
    );

    await TestBed.configureTestingModule({
      imports: [AppointmentsComponent],
      providers: [
        { provide: EmployeeService, useValue: employeeService },
        { provide: MessageService, useValue: messageService },
        { provide: AppointmentsApiService, useValue: appointmentsApi },
        { provide: BranchService, useValue: branchService },
        { provide: PackageService, useValue: packageService },
        { provide: SaleService, useValue: {} },
        { provide: SaleHandoffService, useValue: saleHandoff },
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: LanguageService, useValue: { isRtl: () => false, currentLanguage: () => 'en' } },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => key,
            onLangChange: of({}),
          },
        },
      ],
    })
      .overrideComponent(AppointmentsComponent, { set: { template: '' } })
      .compileComponents();
  });

  const empA: BookableEmployee = {
    id: 'emp-a',
    code: 'E01',
    fullName: 'Employee A',
    jobTitle: 'Specialist',
    photoUrl: null,
    specialty: 'General',
    workingDays: [],
  };

  const empB: BookableEmployee = {
    id: 'emp-b',
    code: 'E02',
    fullName: 'Employee B',
    jobTitle: 'Senior Specialist',
    photoUrl: null,
    specialty: 'General',
    workingDays: [],
  };

  it('matches the selected customer and package without removing occupied bookings', () => {
    const fixture = TestBed.createComponent(AppointmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.clients.set([
      { id: 'customer-a', name: 'A', mobile: '123', registered: true, packages: [] },
    ]);
    component.filters.update(filters => ({ ...filters, packageId: 'pkg-a' }));

    const booking = {
      clientId: 'customer-a',
      lineItems: [{ catalogPackageId: 'pkg-a' }],
    } as BookingRecord;
    const otherPackage = {
      ...booking,
      lineItems: [{ catalogPackageId: 'pkg-b' }],
    } as BookingRecord;
    const otherCustomer = { ...booking, clientId: 'customer-b' };
    const multipleItems = {
      ...booking,
      lineItems: [{ catalogPackageId: 'pkg-b' }, { catalogPackageId: 'pkg-a' }],
    } as BookingRecord;

    expect(component.matchesSelectedPackage(booking)).toBeTrue();
    expect(component.matchesSelectedPackage(multipleItems)).toBeTrue();
    expect(component.matchesSelectedPackage(otherPackage)).toBeFalse();
    expect(component.matchesSelectedPackage(otherCustomer)).toBeFalse();
    component.filters.update(filters => ({ ...filters, packageId: null }));
    expect(component.matchesSelectedPackage(otherPackage)).toBeTrue();
  });

  it('ensures slower earlier package employee response does not overwrite latest selection', () => {
    const subjectA = new Subject<BookableEmployee[]>();
    const subjectB = new Subject<BookableEmployee[]>();

    employeeService.listBookable.and.callFake((branchId: string, packageId?: string | null) => {
      if (packageId === 'pkg-a') {
        return subjectA.asObservable();
      }
      if (packageId === 'pkg-b') {
        return subjectB.asObservable();
      }
      return of([]);
    });

    const fixture = TestBed.createComponent(AppointmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.packages.set([
      { id: 'pkg-a', name: 'Package A', durationMinutes: 30, serviceId: 'srv-1' },
      { id: 'pkg-b', name: 'Package B', durationMinutes: 45, serviceId: 'srv-1' },
    ]);

    // User selects Package A first
    component.onPackageSelected('pkg-a');
    expect(component.employeesLoading()).toBe(true);

    // User switches to Package B before Package A responds
    component.onPackageSelected('pkg-b');
    expect(component.employeesLoading()).toBe(true);

    // Package B responds first
    subjectB.next([empB]);
    subjectB.complete();

    expect(component.employees().map(e => e.id)).toEqual(['emp-b']);
    expect(component.employeesLoading()).toBe(false);

    // Stale Package A response arrives later
    subjectA.next([empA]);
    subjectA.complete();

    // Package B's employee list must remain active and not overwritten
    expect(component.employees().map(e => e.id)).toEqual(['emp-b']);
    expect(component.employeesLoading()).toBe(false);
  });

  it('discards error from earlier package employee request when newer selection has been made', () => {
    const subjectA = new Subject<BookableEmployee[]>();
    const subjectB = new Subject<BookableEmployee[]>();

    employeeService.listBookable.and.callFake((branchId: string, packageId?: string | null) => {
      if (packageId === 'pkg-a') {
        return subjectA.asObservable();
      }
      if (packageId === 'pkg-b') {
        return subjectB.asObservable();
      }
      return of([]);
    });

    const fixture = TestBed.createComponent(AppointmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.packages.set([
      { id: 'pkg-a', name: 'Package A', durationMinutes: 30, serviceId: 'srv-1' },
      { id: 'pkg-b', name: 'Package B', durationMinutes: 45, serviceId: 'srv-1' },
    ]);

    // Select package A then B
    component.onPackageSelected('pkg-a');
    component.onPackageSelected('pkg-b');

    // Package B succeeds
    subjectB.next([empB]);
    subjectB.complete();
    expect(component.employees().map(e => e.id)).toEqual(['emp-b']);

    // Package A errors out
    subjectA.error(new Error('Network error'));

    // Employee list must not be cleared and no error toast shown for stale request
    expect(component.employees().map(e => e.id)).toEqual(['emp-b']);
    expect(messageService.add).not.toHaveBeenCalled();
  });

  it('unsubscribes in-flight employee request when a new package is selected', () => {
    const subjectA = new Subject<BookableEmployee[]>();
    const subjectB = new Subject<BookableEmployee[]>();

    employeeService.listBookable.and.callFake((branchId: string, packageId?: string | null) => {
      if (packageId === 'pkg-a') {
        return subjectA.asObservable();
      }
      if (packageId === 'pkg-b') {
        return subjectB.asObservable();
      }
      return of([]);
    });

    const fixture = TestBed.createComponent(AppointmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.packages.set([
      { id: 'pkg-a', name: 'Package A', durationMinutes: 30, serviceId: 'srv-1' },
      { id: 'pkg-b', name: 'Package B', durationMinutes: 45, serviceId: 'srv-1' },
    ]);

    // Select package A
    component.onPackageSelected('pkg-a');
    expect(subjectA.observed).toBe(true);

    // Select package B cancels package A's subscription
    component.onPackageSelected('pkg-b');
    expect(subjectA.observed).toBe(false);
    expect(subjectB.observed).toBe(true);
  });
});
