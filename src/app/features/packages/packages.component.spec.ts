import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '@core/services/currency.service';
import { PermissionService } from '@core/services/permission.service';
import { PackageService, PackageListResult } from './package.service';
import { PackageDetail } from './models/package-list.model';
import { PackagesComponent } from './packages.component';

describe('PackagesComponent payment validation', () => {
  let packageService: jasmine.SpyObj<PackageService>;
  let messageService: jasmine.SpyObj<MessageService>;

  const emptyListResult: PackageListResult = {
    items: [],
    totalCount: 0,
    activeCount: 0,
    cancelledCount: 0,
    pageNumber: 1,
    pageSize: 10,
    totalPages: 0,
  };

  beforeEach(async () => {
    packageService = jasmine.createSpyObj<PackageService>('PackageService', [
      'list',
      'get',
      'create',
      'update',
      'delete',
      'listServiceCategories',
      'listSubServiceCategories',
      'listAvailableStaff',
    ]);
    packageService.list.and.returnValue(of(emptyListResult));
    packageService.listServiceCategories.and.returnValue(of([]));
    packageService.listSubServiceCategories.and.returnValue(of([]));
    packageService.listAvailableStaff.and.returnValue(of([]));
    packageService.create.and.returnValue(of({} as PackageDetail));

    messageService = jasmine.createSpyObj<MessageService>('MessageService', ['add']);

    await TestBed.configureTestingModule({
      imports: [PackagesComponent],
      providers: [
        FormBuilder,
        { provide: PackageService, useValue: packageService },
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        {
          provide: CurrencyService,
          useValue: { hasCurrency: () => true, currencyLabel: () => 'EGP' },
        },
        { provide: MessageService, useValue: messageService },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => key,
            onLangChange: of({}),
          },
        },
      ],
    })
      .overrideComponent(PackagesComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('requires price > 0 when cash payment is enabled', () => {
    const fixture = TestBed.createComponent(PackagesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.form.controls.cashEnabled.setValue(true);
    component.form.controls.price.setValue(null);
    expect(component.form.controls.price.valid).toBe(false);
    expect(component.form.controls.price.hasError('required')).toBe(true);

    component.form.controls.price.setValue(0);
    component.form.controls.price.markAsTouched();
    expect(component.form.controls.price.valid).toBe(false);
    expect(component.form.controls.price.hasError('min')).toBe(true);
    expect(component.getFieldError('price')).toBe('PACKAGES.CREATE.ERRORS.CASH_PRICE_POSITIVE');

    component.form.controls.price.setValue(150);
    expect(component.form.controls.price.valid).toBe(true);
  });

  it('allows empty cash price when cash is disabled for installment-only package', () => {
    const fixture = TestBed.createComponent(PackagesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.form.controls.cashEnabled.setValue(false);
    component.form.controls.installmentEnabled.setValue(true);

    component.form.controls.price.setValue(null);
    component.form.controls.price.markAsTouched();
    expect(component.form.controls.price.valid).toBe(true);
    expect(component.getFieldError('price')).toBeNull();

    component.form.controls.price.setValue(0);
    expect(component.form.controls.price.valid).toBe(true);
  });

  it('flags negative price even when cash payment is disabled', () => {
    const fixture = TestBed.createComponent(PackagesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.form.controls.cashEnabled.setValue(false);
    component.form.controls.installmentEnabled.setValue(true);

    component.form.controls.price.setValue(-10);
    component.form.controls.price.markAsTouched();
    expect(component.form.controls.price.valid).toBe(false);
    expect(component.form.controls.price.hasError('min')).toBe(true);
    expect(component.getFieldError('price')).toBe('PACKAGES.CREATE.ERRORS.PRICE_MIN');
  });

  it('saves installment-only package when cash price is empty and sends 0 in payload', () => {
    const fixture = TestBed.createComponent(PackagesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCreate();
    component.selectOfferType('package');

    component.form.patchValue({
      name: 'Laser 10 Sessions Plan',
      serviceCategoryId: 'cat-1',
      sessionDurationValue: 30,
      sessionDurationUnit: 'minute',
      sessionCount: 10,
      pulseCount: null,
      packageExpiryMonths: 12,
      price: null,
      cashEnabled: false,
      installmentEnabled: true,
      installmentPrice: 2000,
      firstPayment: 500,
      installmentCount: 2,
      installments: [
        { amount: 750, sessionsUnlocked: 3 },
        { amount: 750, sessionsUnlocked: 7 },
      ],
      allStaff: true,
      staffIds: [],
    });

    expect(component.form.valid).toBe(true);

    component.save();

    expect(packageService.create).toHaveBeenCalledTimes(1);
    const payload = packageService.create.calls.mostRecent().args[0];
    expect(payload.price).toBe(0);
    expect(payload.cashEnabled).toBe(false);
    expect(payload.installmentEnabled).toBe(true);
    expect(payload.installmentPrice).toBe(2000);
  });
});
