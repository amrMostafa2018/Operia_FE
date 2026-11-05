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
      'findCustomer',
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
    appointmentsApi.findCustomer.and.callFake(mobile =>
      mobile === '111' ? first.asObservable() : second.asObservable()
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
    appointmentsApi.findCustomer.and.callFake(mobile =>
      mobile === '111' ? first.asObservable() : second.asObservable()
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
});
