import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  output,
  input,
  computed,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CurrencyService } from '@core/services/currency.service';
import {
  applyServerFieldErrors,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { setupServerErrorClearing } from '@core/utils/validators.util';
import { BookingCustomerDto } from '@app/features/bookings/appointments-api.service';
import { BookableEmployee, EmployeeService } from '@app/features/employees/employee.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import {
  PackageCategoryOption,
  PackageListItem,
} from '@app/features/packages/models/package-list.model';
import {
  ConfirmSaleRequest,
  ConfirmSaleResult,
  SaleDraftItem,
  SalePaymentOption,
  SaleQuote,
  SaleService,
  SaleState,
} from './sale.service';

interface DraftRow extends SaleDraftItem {
  key: string;
}

interface PendingConfirmation {
  request: ConfirmSaleRequest;
  durationMinutes: number;
}

@Component({
  selector: 'app-sale-builder-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
  ],
  templateUrl: './sale-builder-dialog.component.html',
  styleUrl: './sale-builder-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleBuilderDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sales = inject(SaleService);
  private readonly employeesApi = inject(EmployeeService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = inject(CurrencyService);

  readonly visible = input(false);
  readonly closed = output<void>();
  readonly confirmed = output<ConfirmSaleResult>();

  readonly customerForm = this.fb.nonNullable.group({
    mobile: ['', Validators.required],
    customerId: ['', Validators.required],
    branchId: ['', Validators.required],
  });
  readonly unlistedForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    price: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(999999999.99),
    ]),
    durationMinutes: [30, [Validators.required, Validators.min(1), Validators.max(1440)]],
  });
  readonly bookingForm = this.fb.nonNullable.group({
    employeeId: ['', Validators.required],
    scheduledDate: ['', Validators.required],
    startTime: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
  });

  readonly catalog = signal<PackageListItem[]>([]);
  readonly categories = signal<PackageCategoryOption[]>([]);
  readonly branches = signal<{ id: string; name: string }[]>([]);
  readonly paymentMethods = signal<string[]>([]);
  readonly customer = signal<BookingCustomerDto | null>(null);
  readonly directCustomer = signal(false);
  readonly pendingCustomerMode = signal<boolean | null>(null);
  readonly rows = signal<DraftRow[]>([]);
  readonly quote = signal<SaleQuote | null>(null);
  readonly quoteLoading = signal(false);
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly customerLoading = signal(false);
  readonly pendingConfirmation = signal<PendingConfirmation | null>(null);
  readonly showUnlisted = signal(false);
  readonly editingUnlistedKey = signal<string | null>(null);
  readonly categoryId = signal('all');
  readonly searchText = signal('');
  readonly selectedMethod = signal<string | null>(null);
  readonly itemError = signal<string | null>(null);
  readonly activeSale = signal<SaleState | null>(null);
  readonly bookableEmployees = signal<BookableEmployee[]>([]);
  readonly recoveryError = signal<string | null>(null);
  readonly resumeSaleId = signal('');
  readonly resumeError = signal<string | null>(null);
  readonly bookingRequested = signal(false);
  readonly canBookNow = computed(() => this.permissions.hasPermission(Policies.BookingsManage));
  private quoteVersion = 0;
  private customerVersion = 0;
  private optionsVersion = 0;
  private confirmationKey = crypto.randomUUID();
  private collectionKey = crypto.randomUUID();
  private readonly recoveryStorageKey = 'operia.sale.pending';

  readonly filteredCatalog = computed(() => {
    const category = this.categoryId();
    const search = this.searchText().trim().toLocaleLowerCase();
    return this.catalog().filter(
      offer =>
        (!this.directCustomer() ||
          offer.offerType === 'singleSession' ||
          offer.cashEnabled !== false) &&
        (category === 'all' || offer.serviceCategoryId === category) &&
        (!search || offer.name.toLocaleLowerCase().includes(search))
    );
  });
  readonly hasDirectPackage = computed(
    () =>
      this.directCustomer() &&
      this.rows().some(row =>
        this.catalog().some(offer => offer.id === row.offerId && offer.offerType === 'package')
      )
  );
  readonly hasUnlisted = computed(() => this.rows().some(row => row.unlistedName !== null));

  constructor() {
    setupServerErrorClearing(this.customerForm, this.destroyRef, [
      'mobile',
      'customerId',
      'branchId',
    ]);
    setupServerErrorClearing(this.unlistedForm, this.destroyRef, [
      'name',
      'price',
      'durationMinutes',
    ]);
    setupServerErrorClearing(this.bookingForm, this.destroyRef, [
      'employeeId',
      'scheduledDate',
      'startTime',
    ]);
    effect(
      () => {
        if (this.visible()) {
          untracked(() => {
            if (!this.pendingConfirmation()) {
              this.reset();
              this.loadOptions();
              this.restorePendingSale();
            }
          });
        }
      },
      { allowSignalWrites: true }
    );
  }

  private reset(): void {
    this.quoteVersion++;
    this.customerVersion++;
    this.confirmationKey = crypto.randomUUID();
    this.collectionKey = crypto.randomUUID();
    this.pendingConfirmation.set(null);
    this.customerLoading.set(false);
    this.activeSale.set(null);
    this.recoveryError.set(null);
    this.resumeSaleId.set('');
    this.resumeError.set(null);
    this.bookingRequested.set(false);
    this.bookableEmployees.set([]);
    this.bookingForm.reset({ employeeId: '', scheduledDate: '', startTime: '' });
    this.customerForm.reset({ mobile: '', customerId: '', branchId: '' });
    this.unlistedForm.reset({ name: '', price: null, durationMinutes: 30 });
    this.customer.set(null);
    this.directCustomer.set(false);
    this.pendingCustomerMode.set(null);
    this.customerForm.controls.mobile.enable({ emitEvent: false });
    this.customerForm.controls.customerId.enable({ emitEvent: false });
    this.catalog.set([]);
    this.categories.set([]);
    this.branches.set([]);
    this.paymentMethods.set([]);
    this.rows.set([]);
    this.quote.set(null);
    this.itemError.set(null);
    this.selectedMethod.set(null);
    this.categoryId.set('all');
    this.searchText.set('');
    this.showUnlisted.set(false);
    this.editingUnlistedKey.set(null);
  }

  private loadOptions(): void {
    const version = ++this.optionsVersion;
    this.loading.set(true);
    forkJoin({
      catalog: this.sales.catalog(),
      categories: this.sales.categories(),
      branches: this.sales.branches(),
      paymentMethods: this.sales.paymentMethods(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: options => {
          if (version !== this.optionsVersion) return;
          const today = new Date().toISOString().slice(0, 10);
          this.catalog.set(
            options.catalog.items.filter(
              offer => offer.status === 'active' && (!offer.endsAt || offer.endsAt >= today)
            )
          );
          this.categories.set(options.categories);
          this.branches.set(options.branches);
          this.paymentMethods.set(options.paymentMethods);
          if (options.branches.length === 1) {
            this.customerForm.controls.branchId.setValue(options.branches[0].id);
          }
          this.selectedMethod.set(options.paymentMethods[0] ?? null);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (version !== this.optionsVersion) return;
          this.loading.set(false);
          this.showError(error);
        },
      });
  }

  searchCustomer(): void {
    if (this.directCustomer()) return;
    this.customerForm.controls.mobile.markAsTouched();
    if (this.customerForm.controls.mobile.invalid) return;
    const version = ++this.customerVersion;
    this.customerLoading.set(true);
    this.sales
      .customer(this.customerForm.controls.mobile.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: customer => {
          if (version !== this.customerVersion) return;
          this.customerLoading.set(false);
          this.customer.set(customer);
          this.customerForm.controls.customerId.setValue(customer?.id ?? '');
          if (!customer) this.customerForm.controls.customerId.markAsTouched();
          this.rows.update(rows => rows.filter(row => !row.ownedCustomerPackageId));
          this.changed();
        },
        error: (error: HttpErrorResponse) => {
          if (version !== this.customerVersion) return;
          this.customerLoading.set(false);
          applyServerFieldErrors(
            this.customerForm,
            translateApiFieldErrors(extractApiFieldErrors(error), key =>
              this.translate.instant(key)
            )
          );
          this.showError(error);
        },
      });
  }

  mobileChanged(): void {
    this.customerVersion++;
    this.customerLoading.set(false);
    this.customer.set(null);
    this.customerForm.controls.customerId.setValue('');
    this.rows.update(rows => rows.filter(row => !row.ownedCustomerPackageId));
    this.changed();
  }

  setDirectCustomer(direct: boolean): void {
    if (this.directCustomer() === direct || this.saving()) return;
    const hadCustomer = this.customer() !== null;
    const removedRows = this.rows().some(
      row =>
        row.ownedCustomerPackageId ||
        this.catalog().some(
          offer =>
            offer.id === row.offerId &&
            offer.offerType === 'package' &&
            (row.paymentOption !== 'cash' || offer.cashEnabled === false)
        )
    );
    if (direct && (hadCustomer || removedRows)) {
      this.pendingCustomerMode.set(direct);
      return;
    }
    this.applyCustomerMode(direct);
  }

  confirmCustomerMode(): void {
    const direct = this.pendingCustomerMode();
    if (direct === null) return;
    this.pendingCustomerMode.set(null);
    this.applyCustomerMode(direct);
  }

  private applyCustomerMode(direct: boolean): void {
    this.customerVersion++;
    this.customerLoading.set(false);
    this.customer.set(null);
    this.customerForm.controls.mobile.setValue('');
    this.customerForm.controls.customerId.setValue('');
    this.rows.update(rows =>
      rows.filter(
        row =>
          !row.ownedCustomerPackageId &&
          (!direct ||
            !this.catalog().some(
              offer =>
                offer.id === row.offerId &&
                offer.offerType === 'package' &&
                (row.paymentOption !== 'cash' || offer.cashEnabled === false)
            ))
      )
    );
    this.directCustomer.set(direct);
    if (direct) {
      this.customerForm.controls.mobile.disable({ emitEvent: false });
      this.customerForm.controls.customerId.disable({ emitEvent: false });
    } else {
      this.customerForm.controls.mobile.enable({ emitEvent: false });
      this.customerForm.controls.customerId.enable({ emitEvent: false });
    }
    if (!direct) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('SALE_BUILDER.CUSTOMER_SWITCH_TITLE'),
        detail: this.translate.instant('SALE_BUILDER.CUSTOMER_SWITCH_WARNING'),
      });
    }
    this.changed();
  }

  branchChanged(): void {
    this.changed();
  }

  addOffer(offer: PackageListItem): void {
    if (this.directCustomer() && offer.offerType === 'package' && offer.cashEnabled === false) {
      this.itemError.set(this.translate.instant('ERRORS.SaleDirectPackageIncomeOnly'));
      return;
    }
    const option: SalePaymentOption = offer.cashEnabled !== false ? 'cash' : 'installment';
    if (option === 'installment' && !offer.installmentEnabled) return;
    const current = this.rows().find(
      row => row.offerId === offer.id && !row.ownedCustomerPackageId && row.paymentOption === option
    );
    if (current) {
      this.rows.update(rows =>
        rows.map(row =>
          row.key === current.key ? { ...row, quantity: Math.min(row.quantity + 1, 100) } : row
        )
      );
    } else {
      this.rows.update(rows => [
        ...rows,
        {
          key: crypto.randomUUID(),
          offerId: offer.id,
          ownedCustomerPackageId: null,
          unlistedName: null,
          unlistedPrice: null,
          unlistedDurationMinutes: null,
          paymentOption: option,
          quantity: 1,
        },
      ]);
    }
    this.changed();
  }

  addOwned(purchase: BookingCustomerDto['packages'][number]): void {
    if (this.directCustomer()) return;
    if (this.rows().some(row => row.ownedCustomerPackageId === purchase.customerPackageId)) return;
    this.rows.update(rows => [
      ...rows,
      {
        key: crypto.randomUUID(),
        offerId: null,
        ownedCustomerPackageId: purchase.customerPackageId,
        unlistedName: null,
        unlistedPrice: null,
        unlistedDurationMinutes: null,
        paymentOption: 'owned',
        quantity: 1,
      },
    ]);
    this.changed();
  }

  openUnlisted(row?: DraftRow): void {
    if (!row && this.rows().some(item => item.unlistedName !== null)) {
      this.itemError.set(this.translate.instant('ERRORS.SaleUnlistedLimit'));
      return;
    }
    this.editingUnlistedKey.set(row?.key ?? null);
    this.unlistedForm.reset({
      name: row?.unlistedName ?? '',
      price: row?.unlistedPrice ?? null,
      durationMinutes: row?.unlistedDurationMinutes ?? 30,
    });
    this.showUnlisted.set(true);
  }

  closeUnlisted(): void {
    this.showUnlisted.set(false);
    this.editingUnlistedKey.set(null);
  }

  unlistedVisibilityChanged(visible: boolean): void {
    if (!visible) this.closeUnlisted();
  }

  addUnlisted(): void {
    this.unlistedForm.markAllAsTouched();
    if (this.unlistedForm.invalid) return;
    const editingKey = this.editingUnlistedKey();
    if (this.rows().some(row => row.unlistedName !== null && row.key !== editingKey)) {
      this.itemError.set(this.translate.instant('ERRORS.SaleUnlistedLimit'));
      return;
    }
    const value = this.unlistedForm.getRawValue();
    if (value.price === null) return;
    const details = {
      unlistedName: value.name.trim(),
      unlistedPrice: value.price,
      unlistedDurationMinutes: value.durationMinutes,
    };
    if (editingKey) {
      this.rows.update(rows =>
        rows.map(row => (row.key === editingKey ? { ...row, ...details } : row))
      );
    } else {
      this.rows.update(rows => [
        ...rows,
        {
          key: crypto.randomUUID(),
          offerId: null,
          ownedCustomerPackageId: null,
          ...details,
          paymentOption: 'cash',
          quantity: 1,
        },
      ]);
    }
    this.closeUnlisted();
    this.changed();
  }

  removeRow(key: string): void {
    this.rows.update(rows => rows.filter(row => row.key !== key));
    this.changed();
  }

  setOption(key: string, option: SalePaymentOption): void {
    if (this.directCustomer() && option === 'installment') return;
    this.rows.update(rows =>
      rows.map(row => (row.key === key ? { ...row, paymentOption: option } : row))
    );
    this.changed();
  }

  setQuantity(key: string, quantity: number): void {
    this.rows.update(rows =>
      rows.map(row =>
        row.key === key ? { ...row, quantity: Math.max(1, Math.min(100, quantity)) } : row
      )
    );
    this.changed();
  }

  canInstallment(row: DraftRow): boolean {
    const offer = this.catalog().find(item => item.id === row.offerId);
    return (
      !this.directCustomer() && offer?.offerType === 'package' && offer.installmentEnabled === true
    );
  }

  canCash(row: DraftRow): boolean {
    return this.catalog().find(item => item.id === row.offerId)?.cashEnabled !== false;
  }

  displayPrice(offer: PackageListItem): number {
    return offer.cashEnabled === false
      ? (offer.installmentPrice ?? offer.price)
      : (offer.cashPriceAfterDiscount ?? offer.price);
  }

  rowName(row: DraftRow): string {
    if (row.unlistedName) return row.unlistedName;
    if (row.ownedCustomerPackageId) {
      return (
        this.customer()?.packages.find(p => p.customerPackageId === row.ownedCustomerPackageId)
          ?.packageName ?? ''
      );
    }
    return this.catalog().find(offer => offer.id === row.offerId)?.name ?? '';
  }

  lineAt(index: number) {
    return this.quote()?.items[index] ?? null;
  }

  private requestItems(): SaleDraftItem[] {
    return this.rows().map(row => ({
      offerId: row.offerId,
      ownedCustomerPackageId: row.ownedCustomerPackageId,
      unlistedName: row.unlistedName,
      unlistedPrice: row.unlistedPrice,
      unlistedDurationMinutes: row.unlistedDurationMinutes,
      paymentOption: row.paymentOption,
      quantity: row.quantity,
    }));
  }

  private changed(): void {
    if (this.pendingConfirmation()) return;
    this.confirmationKey = crypto.randomUUID();
    this.itemError.set(null);
    const version = ++this.quoteVersion;
    const items = this.requestItems();
    if (items.length === 0) {
      this.quote.set(null);
      this.quoteLoading.set(false);
      return;
    }
    this.quote.set(null);
    this.quoteLoading.set(true);
    this.sales
      .quote({
        customerId: this.directCustomer() ? null : (this.customer()?.id ?? null),
        branchId: this.customerForm.controls.branchId.value || null,
        items,
        directCustomer: this.directCustomer(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: quote => {
          if (version !== this.quoteVersion) return;
          this.quote.set(quote);
          this.quoteLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (version !== this.quoteVersion) return;
          this.quoteLoading.set(false);
          this.itemError.set(this.errorText(error));
        },
      });
  }

  confirm(disposition: 'Close' | 'Later' | 'BookNow'): void {
    if (this.hasDirectPackage() && disposition !== 'Close') return;
    const pending = this.pendingConfirmation();
    if (pending) {
      if (!this.saving() && pending.request.disposition === disposition) {
        this.submitConfirmation(pending);
      }
      return;
    }
    this.customerForm.markAllAsTouched();
    const quote = this.quote();
    if (this.customerForm.invalid || !quote || this.quoteLoading() || this.saving()) return;
    if (quote.dueNow > 0 && !this.selectedMethod()) {
      this.itemError.set(this.translate.instant('ERRORS.SalePaymentMethodUnavailable'));
      return;
    }
    const request: ConfirmSaleRequest = {
      customerId: this.directCustomer() ? null : this.customerForm.controls.customerId.value,
      directCustomer: this.directCustomer(),
      branchId: this.customerForm.controls.branchId.value,
      items: this.requestItems(),
      paymentMethod: quote.dueNow > 0 ? this.selectedMethod() : null,
      expectedGrandTotal: quote.grandTotal,
      expectedDueNow: quote.dueNow,
      idempotencyKey: this.confirmationKey,
      disposition,
    };
    const confirmation: PendingConfirmation = {
      request,
      durationMinutes: quote.items.reduce(
        (sum, line) =>
          sum + line.durationMinutes * (line.offerType === 'package' ? 1 : line.quantity),
        0
      ),
    };
    this.pendingConfirmation.set(confirmation);
    this.submitConfirmation(confirmation);
  }

  private submitConfirmation(confirmation: PendingConfirmation): void {
    this.saving.set(true);
    this.sales
      .confirm(confirmation.request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.saving.set(false);
          this.pendingConfirmation.set(null);
          const state: SaleState = {
            saleId: result.saleId,
            status: result.status,
            disposition: confirmation.request.disposition,
            branchId: confirmation.request.branchId,
            durationMinutes: confirmation.durationMinutes,
            grandTotal: result.grandTotal,
            dueNow: result.dueNow,
            collectionId: null,
            paymentConfirmed: false,
            bookingId: null,
            requiresCollection: confirmation.request.items.some(
              item => item.paymentOption !== 'owned'
            ),
          };
          this.activeSale.set(state);
          sessionStorage.setItem(this.recoveryStorageKey, result.saleId);
          if (state.requiresCollection && result.dueNow === 0) {
            this.collect(true);
          } else if (!state.requiresCollection && confirmation.request.disposition === 'BookNow') {
            this.bookingRequested.set(true);
            this.loadBookableEmployees();
          }
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          if (error.status < 400 || error.status === 408 || error.status >= 500) {
            this.toast.add({
              severity: 'warn',
              summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
              detail: this.translate.instant('SALE_BUILDER.CONFIRMATION_UNKNOWN'),
            });
            return;
          }
          this.pendingConfirmation.set(null);
          const codes = Object.values(error.error?.errorCodes ?? {}).flat();
          const fields = translateApiFieldErrors(extractApiFieldErrors(error), key =>
            this.translate.instant(key)
          );
          applyServerFieldErrors(this.customerForm, fields);
          this.itemError.set(fields['items'] ?? fields['paymentMethod'] ?? this.errorText(error));
          this.showError(error);
          if (codes.includes('SaleQuoteChanged')) {
            this.changed();
          } else {
            this.confirmationKey = crypto.randomUUID();
          }
        },
      });
  }

  confirmationLockedTo(disposition: 'Close' | 'Later' | 'BookNow'): boolean {
    const pending = this.pendingConfirmation();
    return pending !== null && pending.request.disposition !== disposition;
  }

  retryConfirmation(): void {
    const pending = this.pendingConfirmation();
    if (pending && !this.saving()) this.submitConfirmation(pending);
  }

  collect(paymentConfirmed: boolean): void {
    const sale = this.activeSale();
    if (!sale || this.saving()) return;
    this.saving.set(true);
    this.recoveryError.set(null);
    this.sales
      .collect(sale.saleId, this.collectionKey, paymentConfirmed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.saving.set(false);
          this.activeSale.set({
            ...sale,
            status: result.saleStatus,
            collectionId: result.collectionId,
            paymentConfirmed: result.paymentConfirmed,
          });
          if (!result.paymentConfirmed) {
            this.collectionKey = crypto.randomUUID();
            this.recoveryError.set(this.translate.instant('SALE_BUILDER.COLLECTION_FAILED'));
            return;
          }
          if (sale.disposition === 'BookNow') {
            this.bookingRequested.set(true);
            this.loadBookableEmployees();
          } else {
            this.complete(result.saleStatus);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.recoveryError.set(this.errorText(error));
          this.refreshSaleState();
        },
      });
  }

  book(): void {
    const sale = this.activeSale();
    this.bookingForm.markAllAsTouched();
    if (
      !sale ||
      (!sale.paymentConfirmed && sale.requiresCollection) ||
      this.bookingForm.invalid ||
      this.saving()
    )
      return;
    const value = this.bookingForm.getRawValue();
    const [hours, minutes] = value.startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const duration = sale.durationMinutes;
    if (duration <= 0 || startMinutes + duration > 1440) {
      this.recoveryError.set(this.translate.instant('ERRORS.SaleDurationMismatch'));
      return;
    }
    this.saving.set(true);
    this.sales
      .book({
        saleId: sale.saleId,
        employeeId: value.employeeId,
        scheduledDate: value.scheduledDate,
        startMinutes,
        endMinutes: startMinutes + duration,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.saving.set(false);
          if (result.status === 'Booked') {
            this.complete('Booked');
            return;
          }
          this.recoveryError.set(
            this.translate.instant(`ERRORS.${result.recoveryCode ?? 'SaleBookingUnavailable'}`)
          );
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          const fields = translateApiFieldErrors(extractApiFieldErrors(error), key =>
            this.translate.instant(key)
          );
          applyServerFieldErrors(this.bookingForm, {
            employeeId: fields['employeeId'],
            scheduledDate: fields['scheduledDate'],
            startTime: fields['startMinutes'] ?? fields['endMinutes'],
          });
          this.recoveryError.set(this.errorText(error));
          this.refreshSaleState();
        },
      });
  }

  bookingError(field: 'employeeId' | 'scheduledDate' | 'startTime'): string | null {
    const control = this.bookingForm.controls[field];
    if (!control.touched) return null;
    if (control.hasError('server')) return String(control.getError('server'));
    if (control.hasError('required')) return this.translate.instant('SALE_BUILDER.REQUIRED');
    if (control.hasError('pattern')) return this.translate.instant('SALE_BUILDER.TIME_INVALID');
    return null;
  }

  private loadBookableEmployees(): void {
    const branchId = this.activeSale()?.branchId;
    this.employeesApi
      .listBookable(branchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: employees => this.bookableEmployees.set(employees),
        error: (error: HttpErrorResponse) => this.recoveryError.set(this.errorText(error)),
      });
  }

  private restorePendingSale(): void {
    const saleId = sessionStorage.getItem(this.recoveryStorageKey);
    if (!saleId) return;
    this.sales
      .state(saleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: state => {
          if (state.status === 'Booked' || state.status === 'Closed') {
            sessionStorage.removeItem(this.recoveryStorageKey);
            return;
          }
          this.activeSale.set(state);
          if (
            (state.paymentConfirmed || !state.requiresCollection) &&
            state.disposition === 'BookNow'
          ) {
            this.bookingRequested.set(true);
            this.loadBookableEmployees();
          }
        },
        error: () => sessionStorage.removeItem(this.recoveryStorageKey),
      });
  }

  private refreshSaleState(): void {
    const saleId = this.activeSale()?.saleId;
    if (!saleId) return;
    this.sales
      .state(saleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: state => {
          this.activeSale.set(state);
          if (
            (state.paymentConfirmed || !state.requiresCollection) &&
            state.disposition === 'BookNow'
          ) {
            this.bookingRequested.set(true);
            this.loadBookableEmployees();
          }
        },
      });
  }

  complete(status: string): void {
    const sale = this.activeSale();
    if (!sale) return;
    if (status !== 'ReadyToBook') {
      sessionStorage.removeItem(this.recoveryStorageKey);
    }
    this.confirmed.emit({
      saleId: sale.saleId,
      status,
      grandTotal: sale.grandTotal,
      dueNow: sale.dueNow,
    });
  }

  startNewSale(): void {
    sessionStorage.removeItem(this.recoveryStorageKey);
    this.reset();
    this.loadOptions();
  }

  startBooking(): void {
    this.bookingRequested.set(true);
    this.loadBookableEmployees();
  }

  resumeSale(): void {
    const saleId = this.resumeSaleId().trim();
    if (!saleId) {
      this.resumeError.set(this.translate.instant('SALE_BUILDER.REQUIRED'));
      return;
    }
    this.resumeError.set(null);
    this.saving.set(true);
    this.sales
      .state(saleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: state => {
          this.saving.set(false);
          this.activeSale.set(state);
          sessionStorage.setItem(this.recoveryStorageKey, state.saleId);
          if (
            (state.paymentConfirmed || !state.requiresCollection) &&
            state.disposition === 'BookNow'
          ) {
            this.startBooking();
          }
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.resumeError.set(this.errorText(error));
        },
      });
  }

  fieldError(field: 'mobile' | 'customerId' | 'branchId'): string | null {
    const control = this.customerForm.controls[field];
    if (!control.touched) return null;
    if (control.hasError('server')) return String(control.getError('server'));
    if (control.hasError('required')) return this.translate.instant('SALE_BUILDER.REQUIRED');
    return null;
  }

  unlistedError(field: 'name' | 'price' | 'durationMinutes'): string | null {
    const control = this.unlistedForm.controls[field];
    if (!control.touched) return null;
    if (control.hasError('server')) return String(control.getError('server'));
    if (control.hasError('required')) return this.translate.instant('SALE_BUILDER.REQUIRED');
    if (control.hasError('maxlength') || control.hasError('pattern'))
      return this.translate.instant('ERRORS.SaleUnlistedNameInvalid');
    if (control.hasError('min') || control.hasError('max')) {
      return this.translate.instant(
        field === 'durationMinutes'
          ? 'ERRORS.SaleUnlistedDurationInvalid'
          : 'ERRORS.SaleUnlistedPriceInvalid'
      );
    }
    return null;
  }

  private errorText(error: HttpErrorResponse): string {
    const code = Object.values(error.error?.errorCodes ?? {}).flat()[0];
    if (typeof code === 'string') {
      const key = `ERRORS.${code}`;
      const text = this.translate.instant(key);
      if (text !== key) return text;
    }
    return (
      (error as HttpErrorResponse & { userMessage?: string }).userMessage ??
      this.translate.instant('HTTP_ERRORS.SERVER')
    );
  }

  private showError(error: HttpErrorResponse): void {
    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
      detail: this.errorText(error),
    });
  }
}
