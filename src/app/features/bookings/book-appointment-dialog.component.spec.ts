import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { PackageService } from '@app/features/packages/package.service';
import { AppointmentsApiService, BookingCustomerDto } from './appointments-api.service';
import { BookAppointmentDialogComponent } from './book-appointment-dialog.component';

describe('BookAppointmentDialogComponent customer selection', () => {
  let appointmentsApi: jasmine.SpyObj<AppointmentsApiService>;

  beforeEach(async () => {
    appointmentsApi = jasmine.createSpyObj<AppointmentsApiService>('AppointmentsApiService', [
      'findCustomerById',
    ]);

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
