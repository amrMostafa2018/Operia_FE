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
      'quote',
    ]);
    sales.catalog.and.returnValue(of({ items: [] }));
    sales.categories.and.returnValue(of([]));
    sales.branches.and.returnValue(of([]));
    sales.paymentMethods.and.returnValue(of(['cash']));
    sales.quote.and.returnValue(
      of({ items: [], subtotal: 0, discount: 0, grandTotal: 0, dueNow: 0 })
    );
    sessionStorage.removeItem('operia.sale.pending');
    await TestBed.configureTestingModule({
      imports: [SaleBuilderDialogComponent],
      providers: [
        { provide: SaleService, useValue: sales },
        { provide: EmployeeService, useValue: { listBookable: () => of([]) } },
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

  it('keeps a walk-in package cash-only and allows only an income-only close', () => {
    const response = new Subject<ConfirmSaleResult>();
    sales.confirm.and.returnValue(response.asObservable());
    const { component } = createReadyComponent();
    component.catalog.set([
      {
        id: 'package',
        name: 'Walk-in package',
        offerType: 'package',
        sessionDurationMinutes: 30,
        serviceCategoryId: 'category',
        serviceCategoryName: 'Category',
        price: 100,
        status: 'active',
        createdAt: '2026-11-08',
        endsAt: null,
        cashEnabled: true,
        installmentEnabled: true,
      },
    ]);
    component.directCustomer.set(true);
    component.customerForm.controls.mobile.disable();
    component.customerForm.controls.customerId.disable();
    component.rows.set([
      {
        key: 'walk-in-package',
        offerId: 'package',
        ownedCustomerPackageId: null,
        unlistedName: null,
        unlistedPrice: null,
        unlistedDurationMinutes: null,
        paymentOption: 'cash',
        quantity: 1,
      },
    ]);

    expect(component.filteredCatalog().map(offer => offer.id)).toEqual(['package']);
    expect(component.hasDirectPackage()).toBeTrue();
    expect(component.canInstallment(component.rows()[0])).toBeFalse();
    component.setOption('walk-in-package', 'installment');
    expect(component.rows()[0].paymentOption).toBe('cash');
    component.confirm('Later');
    expect(sales.confirm).not.toHaveBeenCalled();
    component.confirm('Close');
    expect(sales.confirm.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ directCustomer: true, disposition: 'Close' })
    );
  });

  it('edits a single unlisted draft and requotes without adding a second row', () => {
    const { component } = createReadyComponent();
    component.openUnlisted();
    component.unlistedForm.setValue({ name: '  Consultation  ', price: 125, durationMinutes: 25 });
    component.addUnlisted();
    const original = component.rows()[0];
    expect(original.unlistedName).toBe('Consultation');
    expect(component.showUnlisted()).toBeFalse();

    component.openUnlisted(original);
    component.unlistedForm.setValue({ name: 'Updated', price: 150, durationMinutes: 40 });
    component.addUnlisted();

    expect(component.rows().length).toBe(1);
    expect(component.rows()[0]).toEqual(
      jasmine.objectContaining({
        key: original.key,
        unlistedName: 'Updated',
        unlistedPrice: 150,
        unlistedDurationMinutes: 40,
      })
    );
    expect(sales.quote.calls.mostRecent().args[0].items[0]).toEqual(
      jasmine.objectContaining({
        unlistedName: 'Updated',
        unlistedPrice: 150,
        unlistedDurationMinutes: 40,
      })
    );

    component.openUnlisted(component.rows()[0]);
    component.unlistedForm.controls.name.setValue('Discarded');
    component.closeUnlisted();
    expect(component.rows()[0].unlistedName).toBe('Updated');
  });

  it('rejects a blank name and a missing price without creating a draft row', () => {
    const { component } = createReadyComponent();
    component.openUnlisted();
    component.unlistedForm.setValue({ name: '   ', price: null, durationMinutes: 30 });
    component.addUnlisted();
    expect(component.rows()).toEqual([]);
    expect(component.unlistedError('name')).toBeTruthy();
    expect(component.unlistedError('price')).toBeTruthy();
    expect(sales.quote).not.toHaveBeenCalled();
  });
});
