import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { PackageService } from '@app/features/packages/package.service';
import { AppointmentsApiService, BookingCustomerDto } from './appointments-api.service';
import { BookAppointmentDialogComponent } from './book-appointment-dialog.component';
import { ServiceCatalogItem } from './models/booking.model';

describe('BookAppointmentDialogComponent customer selection', () => {
  let appointmentsApi: jasmine.SpyObj<AppointmentsApiService>;

  beforeEach(async () => {
    appointmentsApi = jasmine.createSpyObj<AppointmentsApiService>('AppointmentsApiService', [
      'findCustomer',
      'findCustomerById',
      'getPaymentMethods',
    ]);
    appointmentsApi.findCustomer.and.returnValue(of(null));
    appointmentsApi.getPaymentMethods.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [BookAppointmentDialogComponent],
      providers: [
        { provide: AppointmentsApiService, useValue: appointmentsApi },
        { provide: PackageService, useValue: {} },
        { provide: CurrencyService, useValue: {} },
        { provide: LanguageService, useValue: { currentLang: () => 'en' } },
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: MessageService, useValue: { add: () => undefined } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    })
      .overrideComponent(BookAppointmentDialogComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('keeps the newest selection pending when an earlier lookup completes first', () => {
    const first = new Subject<BookingCustomerDto | null>();
    const second = new Subject<BookingCustomerDto | null>();
    appointmentsApi.findCustomerById.and.callFake(id =>
      id === 'a' ? first.asObservable() : second.asObservable()
    );

    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectCustomer({ id: 'a', fullName: 'A', mobileNumber: '111' });
    component.selectCustomer({ id: 'b', fullName: 'B', mobileNumber: '222' });

    first.next({ id: 'a', fullName: 'A', mobileNumber: '111', packages: [] });
    first.complete();
    expect(component.customerSelectionLoading()).toBe(true);
    expect(component.selectedCustomer()).toBeNull();

    second.next({ id: 'b', fullName: 'B', mobileNumber: '222', packages: [] });
    second.complete();
    expect(component.customerSelectionLoading()).toBe(false);
    expect(component.selectedCustomer()?.id).toBe('b');
  });

  it('does not let an earlier lookup overwrite a completed later selection', () => {
    const first = new Subject<BookingCustomerDto | null>();
    const second = new Subject<BookingCustomerDto | null>();
    appointmentsApi.findCustomerById.and.callFake(id =>
      id === 'a' ? first.asObservable() : second.asObservable()
    );

    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectCustomer({ id: 'a', fullName: 'A', mobileNumber: '111' });
    component.selectCustomer({ id: 'b', fullName: 'B', mobileNumber: '222' });

    second.next({ id: 'b', fullName: 'B', mobileNumber: '222', packages: [] });
    second.complete();
    first.next({ id: 'a', fullName: 'A', mobileNumber: '111', packages: [] });
    first.complete();

    expect(component.selectedCustomer()?.id).toBe('b');
    expect(component.clientForm.controls.mobile.value).toBe('222');
  });

  it('recognizes an existing customer entered from the new-customer tab', fakeAsync(() => {
    appointmentsApi.findCustomer.and.returnValue(
      of({
        id: 'c4d86d28-49ed-4b48-87a7-64a2e6c6cf14',
        fullName: 'عميل 1',
        mobileNumber: '201148908184',
        packages: [
          {
            customerPackageId: 'df1fae10-adca-4a27-8365-e79a179d8131',
            packageId: '8974aa68-b0b0-4464-b659-68fb24db1588',
            packageName: 'باقه 5000 بلس',
            sessionDurationMinutes: 30,
            totalSessions: 5000,
            usedSessions: 3168,
            reservedSessions: 1,
            availableSessions: 1832,
            expiresOn: '2027-11-10',
            offerType: 'package',
            sessionCount: null,
            pulseCount: 5000,
            installmentDueNow: false,
          },
        ],
      })
    );

    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    tick(200);
    const component = fixture.componentInstance;
    component.setCustomerMode('new');
    component.clientForm.controls.mobile.setValue('201148908184');
    tick(250);
    fixture.detectChanges();

    expect(component.customerMode()).toBe('registered');
    expect(component.matchedClient()).toEqual(
      jasmine.objectContaining({
        id: 'c4d86d28-49ed-4b48-87a7-64a2e6c6cf14',
        name: 'عميل 1',
        registered: true,
      })
    );
    expect(component.matchedClient()?.packages[0]).toEqual(
      jasmine.objectContaining({
        packageId: '8974aa68-b0b0-4464-b659-68fb24db1588',
        packageName: 'باقه 5000 بلس',
        totalSessions: 5000,
      })
    );
    expect(component.clientForm.controls.name.value).toBe('عميل 1');
    discardPeriodicTasks();
  }));

  it('keeps a number with no customer as unregistered in the new-customer tab', fakeAsync(() => {
    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setCustomerMode('new');
    component.clientForm.controls.mobile.setValue('201000000000');
    tick(250);
    fixture.detectChanges();

    expect(component.customerMode()).toBe('new');
    expect(component.matchedClient()).toBeNull();
    discardPeriodicTasks();
  }));

  it('adds, edits, and removes an unlisted service as a local draft', () => {
    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openUnlisted();
    component.unlistedForm.setValue({
      name: '  Temporary service  ',
      price: 125,
      durationMinutes: 25,
    });
    component.addUnlisted();

    const item = component.unlistedItems()[0];
    expect(item).toEqual(
      jasmine.objectContaining({
        name: 'Temporary service',
        type: 'unlisted',
        price: 125,
        durationMinutes: 25,
      })
    );
    expect(item.catalogPackageId).toBeUndefined();
    expect(component.lineItems()).toContain(item);
    expect(component.serviceDuration()).toBe(25);
    expect(component.dueNow()).toBe(125);

    component.openUnlisted(item);
    component.unlistedForm.setValue({ name: 'Updated', price: 100, durationMinutes: 40 });
    component.addUnlisted();
    expect(component.unlistedItems().length).toBe(1);
    expect(component.unlistedItems()[0].id).toBe(item.id);
    expect(component.serviceDuration()).toBe(40);
    expect(component.dueNow()).toBe(100);

    component.removeLineItem(item.id);
    expect(component.lineItems()).toEqual([]);
    expect(component.dueNow()).toBe(0);
  });

  it('dims a package with an installment due now and does not select it', () => {
    appointmentsApi.findCustomerById.and.returnValue(
      of({
        id: 'customer-1',
        fullName: 'عميل',
        mobileNumber: '201148908184',
        packages: [
          {
            customerPackageId: 'due-balance',
            packageId: 'due-package',
            packageName: 'باقة 5000 بلس',
            sessionDurationMinutes: 30,
            totalSessions: 5000,
            usedSessions: 0,
            reservedSessions: 0,
            availableSessions: 2500,
            expiresOn: '2027-11-10',
            offerType: 'package',
            sessionCount: null,
            pulseCount: 5000,
            installmentDueNow: true,
          },
          {
            customerPackageId: 'open-balance',
            packageId: 'open-package',
            packageName: 'باقة مفتوحة',
            sessionDurationMinutes: 30,
            totalSessions: 10,
            usedSessions: 1,
            reservedSessions: 0,
            availableSessions: 4,
            expiresOn: '2027-11-10',
            offerType: 'package',
            sessionCount: 10,
            pulseCount: null,
            installmentDueNow: false,
          },
        ],
      })
    );

    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectCustomer({
      id: 'customer-1',
      fullName: 'عميل',
      mobileNumber: '201148908184',
    });
    fixture.detectChanges();

    expect(component.packageOptions()).toEqual([
      jasmine.objectContaining({ value: 'due-package', disabled: true }),
      jasmine.objectContaining({ value: 'open-package', disabled: false }),
    ]);
    component.onPackageIdsChange(['due-package', 'open-package']);
    expect(component.selectedPackageIds()).toEqual(['open-package']);
    expect(component.selectedClientPackages().map(pkg => pkg.packageId)).toEqual(['open-package']);
  });

  it('shows a separate table row for each selection of the same service', () => {
    const service: ServiceCatalogItem = {
      id: 'service-laser',
      name: 'تحديد',
      category: 'laser',
      durationMinutes: 30,
      price: 250,
      icon: 'pi pi-bolt',
      type: 'session',
    };
    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.componentRef.setInput('catalogItems', [service]);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.changeQuantity(service, 1);
    component.changeQuantity(service, 1);

    expect(component.lineItems()).toHaveSize(1);
    expect(component.lineItems()[0].quantity).toBe(2);
    expect(component.selectionRows()).toHaveSize(2);
    expect(component.selectionRows().map(row => row.amount)).toEqual([250, 250]);
    expect(component.dueNow()).toBe(500);
    expect(component.serviceDuration()).toBe(60);

    component.removeLineItem(component.lineItems()[0].id);

    expect(component.selectionRows()).toHaveSize(1);
    expect(component.dueNow()).toBe(250);
    expect(component.quantityFor(service.id)).toBe(1);
  });

  it('rejects empty price and whitespace-only unlisted name', () => {
    const fixture = TestBed.createComponent(BookAppointmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openUnlisted();
    component.unlistedForm.setValue({ name: '   ', price: null, durationMinutes: 30 });
    component.addUnlisted();
    expect(component.unlistedItems()).toEqual([]);
    expect(component.unlistedNameError()).toBe('ERRORS.SaleUnlistedNameInvalid');
    expect(component.unlistedPriceError()).toBe('BOOKINGS.DETAILS.ERRORS.UNLISTED_PRICE_REQUIRED');
  });
});
