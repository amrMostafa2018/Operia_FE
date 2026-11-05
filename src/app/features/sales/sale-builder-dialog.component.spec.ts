import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '@core/services/currency.service';
import { PermissionService } from '@core/services/permission.service';
import { EmployeeService } from '@app/features/employees/employee.service';
import { ConfirmSaleResult, SaleService } from './sale.service';
import { SaleBuilderDialogComponent } from './sale-builder-dialog.component';

describe('SaleBuilderDialogComponent confirmation', () => {
  let sales: jasmine.SpyObj<SaleService>;

  beforeEach(async () => {
    sales = jasmine.createSpyObj<SaleService>('SaleService', [
      'catalog',
      'categories',
      'branches',
      'paymentMethods',
      'customer',
      'confirm',
    ]);
    sales.catalog.and.returnValue(of({ items: [] }));
    sales.categories.and.returnValue(of([]));
    sales.branches.and.returnValue(of([]));
    sales.paymentMethods.and.returnValue(of(['cash']));
    sessionStorage.removeItem('operia.sale.pending');
    await TestBed.configureTestingModule({
      imports: [SaleBuilderDialogComponent],
      providers: [
        { provide: SaleService, useValue: sales },
        { provide: EmployeeService, useValue: {} },
        { provide: CurrencyService, useValue: {} },
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: MessageService, useValue: { add: () => undefined } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    })
      .overrideComponent(SaleBuilderDialogComponent, { set: { template: '' } })
      .compileComponents();
  });

  function createReadyComponent() {
    const fixture = TestBed.createComponent(SaleBuilderDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.customerForm.setValue({
      mobile: '123',
      customerId: 'customer-1',
      branchId: 'branch-1',
    });
    component.quote.set({ items: [], subtotal: 10, discount: 0, grandTotal: 10, dueNow: 10 });
    component.selectedMethod.set('cash');
    return { fixture, component };
  }

  it('retains the original action and key after an uncertain failure', () => {
    const first = new Subject<ConfirmSaleResult>();
    sales.confirm.and.returnValues(
      first.asObservable(),
      of({
        saleId: 'sale-1',
        status: 'Closed',
        grandTotal: 10,
        dueNow: 10,
      })
    );
    const { fixture, component } = createReadyComponent();
    component.rows.set([
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

    component.confirm('Close');
    const firstRequest = sales.confirm.calls.mostRecent().args[0];
    expect(firstRequest.items[0]).not.toEqual(jasmine.objectContaining({ key: 'display-key' }));
    first.error(new HttpErrorResponse({ status: 500 }));

    expect(component.confirmationLockedTo('BookNow')).toBe(true);
    expect(component.pendingConfirmation()?.request).toEqual(firstRequest);
    component.confirm('BookNow');
    expect(sales.confirm).toHaveBeenCalledTimes(1);
    component.customerForm.controls.branchId.setValue('branch-2');
    component.branchChanged();

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(component.pendingConfirmation()?.request).toEqual(firstRequest);

    component.confirm('Close');
    const retryRequest = sales.confirm.calls.mostRecent().args[0];
    expect(retryRequest).toEqual(firstRequest);
  });

  it('uses the submitted branch for the saved sale even if the form changes', () => {
    const response = new Subject<ConfirmSaleResult>();
    sales.confirm.and.returnValue(response.asObservable());
    const { component } = createReadyComponent();

    component.confirm('BookNow');
    component.customerForm.controls.branchId.setValue('branch-2');
    response.next({ saleId: 'sale-2', status: 'ReadyToBook', grandTotal: 10, dueNow: 10 });
    response.complete();

    expect(sales.confirm.calls.mostRecent().args[0].branchId).toBe('branch-1');
    expect(component.activeSale()?.branchId).toBe('branch-1');
  });

  it('releases customer search after its response is invalidated by reopening', () => {
    const first = new Subject<null>();
    sales.customer.and.returnValues(first, of(null));
    const { fixture, component } = createReadyComponent();

    component.customerForm.controls.mobile.setValue('01012345678');
    component.searchCustomer();
    expect(component.customerLoading()).toBeTrue();

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(component.customerLoading()).toBeFalse();
    first.next(null);
    expect(component.customerLoading()).toBeFalse();

    component.customerForm.controls.mobile.setValue('01098765432');
    component.searchCustomer();
    expect(sales.customer).toHaveBeenCalledTimes(2);
  });
});
