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
    sales = jasmine.createSpyObj<SaleService>('SaleService', ['confirm']);
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

  function createReadyComponent(): SaleBuilderDialogComponent {
    const fixture = TestBed.createComponent(SaleBuilderDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.customerForm.setValue({
      mobile: '123',
      customerId: 'customer-1',
      branchId: 'branch-1',
    });
    component.quote.set({ items: [], subtotal: 10, discount: 0, grandTotal: 10, dueNow: 10 });
    component.selectedMethod.set('cash');
    return component;
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
    const component = createReadyComponent();

    component.confirm('Close');
    const firstRequest = sales.confirm.calls.mostRecent().args[0];
    first.error(new HttpErrorResponse({ status: 500 }));

    expect(component.confirmationLockedTo('BookNow')).toBe(true);
    component.confirm('BookNow');
    expect(sales.confirm).toHaveBeenCalledTimes(1);

    component.confirm('Close');
    const retryRequest = sales.confirm.calls.mostRecent().args[0];
    expect(retryRequest.disposition).toBe('Close');
    expect(retryRequest.idempotencyKey).toBe(firstRequest.idempotencyKey);
  });

  it('uses the submitted branch for the saved sale even if the form changes', () => {
    const response = new Subject<ConfirmSaleResult>();
    sales.confirm.and.returnValue(response.asObservable());
    const component = createReadyComponent();

    component.confirm('BookNow');
    component.customerForm.controls.branchId.setValue('branch-2');
    response.next({ saleId: 'sale-2', status: 'ReadyToBook', grandTotal: 10, dueNow: 10 });
    response.complete();

    expect(sales.confirm.calls.mostRecent().args[0].branchId).toBe('branch-1');
    expect(component.activeSale()?.branchId).toBe('branch-1');
  });
});
