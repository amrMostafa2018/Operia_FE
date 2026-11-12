import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { CustomerInquiryResult } from '../models/customer-inquiry.model';
import { CustomerInquiryDialogComponent } from './customer-inquiry-dialog.component';
import { CustomerInquiryService } from './customer-inquiry.service';

describe('CustomerInquiryDialogComponent', () => {
  let inquiryService: jasmine.SpyObj<CustomerInquiryService>;

  beforeEach(async () => {
    inquiryService = jasmine.createSpyObj<CustomerInquiryService>('CustomerInquiryService', [
      'findByMobile',
      'getPurchaseDetails',
    ]);

    await TestBed.configureTestingModule({
      imports: [CustomerInquiryDialogComponent],
      providers: [
        { provide: CustomerInquiryService, useValue: inquiryService },
        { provide: CurrencyService, useValue: { currencyLabel: () => 'USD' } },
        { provide: LanguageService, useValue: { currentLang: () => 'en' } },
        { provide: MessageService, useValue: jasmine.createSpyObj('MessageService', ['add']) },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    })
      .overrideComponent(CustomerInquiryDialogComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('drops an earlier result when the mobile field changes', fakeAsync(() => {
    const firstRequest = new Subject<CustomerInquiryResult | null>();
    const secondRequest = new Subject<CustomerInquiryResult | null>();
    inquiryService.findByMobile.and.returnValues(firstRequest, secondRequest);

    const component = TestBed.createComponent(CustomerInquiryDialogComponent).componentInstance;
    component.searchForm.controls.mobile.setValue('01012345678');
    component.search();
    expect(component.loading()).toBeTrue();

    component.searchForm.controls.mobile.setValue('01098765432');
    expect(component.loading()).toBeFalse();
    expect(component.result()).toBeNull();

    firstRequest.next({
      customerId: 'first',
      fullName: 'First customer',
      mobileNumber: '01012345678',
      registeredAt: '2026-01-01',
      membershipStatus: 'active',
      operationCount: 0,
      purchases: [],
    });
    expect(component.result()).toBeNull();
    expect(component.searched()).toBeFalse();

    component.search();
    expect(inquiryService.findByMobile).toHaveBeenCalledWith('201098765432');
    secondRequest.next(null);
    expect(component.searched()).toBeTrue();
    tick(350);
    discardPeriodicTasks();
  }));

  it('does not show a mobile error until a number is typed or search is attempted', () => {
    const component = TestBed.createComponent(CustomerInquiryDialogComponent).componentInstance;
    expect(component.mobileError()).toBeNull();

    component.searchForm.controls.mobile.markAsTouched();
    component.searchForm.controls.mobile.markAsDirty();
    expect(component.mobileError()).toBeNull();

    component.searchForm.controls.mobile.setValue('01012');
    expect(component.mobileError()).toBeNull();

    component.searchForm.controls.mobile.setValue('01312345678');
    expect(component.mobileError()).toBe('CUSTOMER_INQUIRY.ERRORS.MOBILE_INVALID');

    component.searchForm.controls.mobile.setValue('01012345678');
    expect(component.mobileError()).toBeNull();

    component.searchForm.controls.mobile.setValue(null);
    component.search();
    expect(component.mobileError()).toBe('CUSTOMER_INQUIRY.ERRORS.MOBILE_REQUIRED');
  });

  it('auto-searches once the mobile number becomes valid', fakeAsync(() => {
    const request = new Subject<CustomerInquiryResult | null>();
    inquiryService.findByMobile.and.returnValue(request);

    const component = TestBed.createComponent(CustomerInquiryDialogComponent).componentInstance;
    component.searchForm.controls.mobile.setValue('01012345678');
    tick(299);
    expect(inquiryService.findByMobile).not.toHaveBeenCalled();

    tick(1);
    expect(inquiryService.findByMobile).toHaveBeenCalledWith('201012345678');

    request.next(null);
    discardPeriodicTasks();
  }));

  it('does not call the API for a partial mobile number', fakeAsync(() => {
    inquiryService.findByMobile.and.returnValue(new Subject<CustomerInquiryResult | null>());

    const component = TestBed.createComponent(CustomerInquiryDialogComponent).componentInstance;
    component.searchForm.controls.mobile.setValue('0114899');
    tick(350);
    expect(inquiryService.findByMobile).not.toHaveBeenCalled();
    expect(component.searchDisabled()).toBeTrue();
    discardPeriodicTasks();
  }));

  it('formats money using the tenant currency label', () => {
    const component = TestBed.createComponent(CustomerInquiryDialogComponent).componentInstance;
    expect(component.formatMoney(12.5)).toBe('12.5 USD');
    expect(component.formatMoney(null)).toBe('—');
  });
});
