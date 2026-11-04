import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, Subject } from 'rxjs';
import { CurrencyService } from '@core/services/currency.service';
import { ConfirmSaleResult, SaleService } from './sale.service';
import { SaleBuilderDialogComponent } from './sale-builder-dialog.component';

describe('SaleBuilderDialogComponent', () => {
  let sales: jasmine.SpyObj<SaleService>;

  beforeEach(async () => {
    sales = jasmine.createSpyObj<SaleService>('SaleService', [
      'catalog',
      'categories',
      'branches',
      'paymentMethods',
      'customer',
      'quote',
      'confirm',
    ]);
    sales.catalog.and.returnValue(of({ items: [] }));
    sales.categories.and.returnValue(of([]));
    sales.branches.and.returnValue(of([]));
    sales.paymentMethods.and.returnValue(of(['cash']));

    await TestBed.configureTestingModule({
      imports: [SaleBuilderDialogComponent],
      providers: [
        { provide: SaleService, useValue: sales },
        { provide: CurrencyService, useValue: { currencyLabel: () => 'EGP' } },
        { provide: MessageService, useValue: jasmine.createSpyObj('MessageService', ['add']) },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    })
      .overrideComponent(SaleBuilderDialogComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('retries an uncertain confirmation with the exact original request after reopening', () => {
    const first = new Subject<ConfirmSaleResult>();
    const retry = new Subject<ConfirmSaleResult>();
    sales.confirm.and.returnValues(first, retry);
    const fixture = TestBed.createComponent(SaleBuilderDialogComponent);
    const dialog = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    dialog.customerForm.setValue({
      mobile: '01012345678',
      customerId: 'customer-1',
      branchId: 'branch-1',
    });
    dialog.rows.set([
      {
        key: 'display-key',
        offerId: 'offer-1',
        ownedCustomerPackageId: null,
        unlistedName: null,
        unlistedPrice: null,
        unlistedDurationMinutes: null,
        paymentOption: 'cash',
        quantity: 1,
      },
    ]);
    dialog.quote.set({ items: [], subtotal: 100, discount: 0, grandTotal: 100, dueNow: 100 });
    dialog.selectedMethod.set('cash');
    dialog.confirm();
    const original = sales.confirm.calls.mostRecent().args[0];
    expect(original.items[0]).not.toEqual(jasmine.objectContaining({ key: 'display-key' }));

    first.error(new HttpErrorResponse({ status: 0 }));
    expect(dialog.pendingConfirmation()).toEqual(original);
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(dialog.pendingConfirmation()).toEqual(original);

    dialog.confirm();
    expect(sales.confirm).toHaveBeenCalledTimes(2);
    expect(sales.confirm.calls.mostRecent().args[0]).toEqual(original);
    retry.next({ saleId: 'sale-1', status: 'PendingCollection', grandTotal: 100, dueNow: 100 });
    expect(dialog.pendingConfirmation()).toBeNull();
  });

  it('releases customer search after its response is invalidated by reopening', () => {
    const first = new Subject<null>();
    sales.customer.and.returnValues(first, of(null));
    const fixture = TestBed.createComponent(SaleBuilderDialogComponent);
    const dialog = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    dialog.customerForm.controls.mobile.setValue('01012345678');
    dialog.searchCustomer();
    expect(dialog.customerLoading()).toBeTrue();
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(dialog.customerLoading()).toBeFalse();
    first.next(null);
    expect(dialog.customerLoading()).toBeFalse();

    dialog.customerForm.controls.mobile.setValue('01098765432');
    dialog.searchCustomer();
    expect(sales.customer).toHaveBeenCalledTimes(2);
    expect(sales.customer.calls.mostRecent().args[0]).toBe('01098765432');
  });
});
