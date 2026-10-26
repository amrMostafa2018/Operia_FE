import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { PermissionService } from '@core/services/permission.service';
import { CurrencyService } from '@core/services/currency.service';
import { Policies } from '@core/models/permissions.model';
import {
  applyServerFieldErrors,
  clearServerFieldError,
  extractApiErrorCodes,
  extractApiFieldErrors,
  PACKAGE_CATEGORY_DUPLICATE_CODES,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { setupServerErrorClearing } from '@core/utils/validators.util';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { isFieldInvalid } from '@app/shared/utils/form-field.util';
import {
  PackageDurationUnit,
  PackageFormValue,
  PackageListItem,
  PackageListStatus,
  PackageOfferType,
  PackageInstallmentRow,
} from './models/package-list.model';
import { PackagePayload, PackageService } from './package.service';

const DEFAULT_CATEGORY_ICON = 'pi-tag';
const DESCRIPTION_MAX_LENGTH = 250;

const DEFAULT_FORM_VALUE: PackageFormValue = {
  name: '',
  status: true,
  offerType: 'singleSession',
  description: '',
  serviceCategoryId: null,
  subServiceCategoryId: null,
  sessionDurationValue: 30,
  sessionDurationUnit: 'minute',
  sessionCount: null,
  pulseCount: null,
  packageExpiryMonths: 12,
  price: 0,
  cashEnabled: true,
  installmentEnabled: false,
  installmentPrice: null,
  firstPayment: null,
  installmentCount: null,
  installments: [],
  allStaff: true,
  staffIds: [],
  discountCode: '',
  discountPercent: 0,
};

const FIELD_ERROR_KEYS: Record<string, Record<string, string>> = {
  name: {
    required: 'PACKAGES.CREATE.ERRORS.NAME_REQUIRED',
    maxlength: 'PACKAGES.CREATE.ERRORS.NAME_MAX',
  },
  description: {
    maxlength: 'PACKAGES.CREATE.ERRORS.DESCRIPTION_MAX',
  },
  serviceCategoryId: {
    required: 'PACKAGES.CREATE.ERRORS.CATEGORY_REQUIRED',
  },
  sessionDurationValue: {
    required: 'PACKAGES.CREATE.ERRORS.DURATION_REQUIRED',
    min: 'PACKAGES.CREATE.ERRORS.DURATION_MIN',
  },
  sessionCount: {
    min: 'PACKAGES.CREATE.ERRORS.SESSION_COUNT_MIN',
  },
  pulseCount: {
    min: 'PACKAGES.CREATE.ERRORS.PULSE_COUNT_MIN',
  },
  price: {
    required: 'PACKAGES.CREATE.ERRORS.PRICE_REQUIRED',
    min: 'PACKAGES.CREATE.ERRORS.CASH_PRICE_POSITIVE',
  },
  cashEnabled: {
    paymentOptionRequired: 'PACKAGES.CREATE.ERRORS.PAYMENT_OPTION_REQUIRED',
  },
  installmentPrice: {
    required: 'PACKAGES.CREATE.ERRORS.INSTALLMENT_PRICE_REQUIRED',
    min: 'PACKAGES.CREATE.ERRORS.INSTALLMENT_PRICE_MIN',
  },
  firstPayment: {
    required: 'ERRORS.PACKAGE_FIRST_PAYMENT_REQUIRED',
    min: 'ERRORS.PACKAGE_FIRST_PAYMENT_RANGE',
    maxPayment: 'ERRORS.PACKAGE_FIRST_PAYMENT_RANGE',
  },
  installmentCount: {
    required: 'ERRORS.PACKAGE_INSTALLMENT_COUNT_RANGE',
    min: 'ERRORS.PACKAGE_INSTALLMENT_COUNT_RANGE',
  },
  installments: {
    rowsCount: 'ERRORS.PACKAGE_INSTALLMENT_ROWS_COUNT',
    amountInvalid: 'ERRORS.PACKAGE_INSTALLMENT_AMOUNT_INVALID',
    totalMismatch: 'ERRORS.PACKAGE_INSTALLMENT_TOTAL_MISMATCH',
    sessionsInvalid: 'ERRORS.PACKAGE_INSTALLMENT_SESSIONS_INVALID',
    releaseCap: 'ERRORS.PACKAGE_INSTALLMENT_RELEASE_CAP',
  },
  staffIds: {
    requiredStaff: 'ERRORS.PACKAGE_STAFF_INVALID',
  },
  discountCode: {
    maxlength: 'PACKAGES.CREATE.ERRORS.DISCOUNT_CODE_MAX',
  },
  discountPercent: {
    min: 'PACKAGES.CREATE.ERRORS.DISCOUNT_PERCENT_MIN',
    max: 'PACKAGES.CREATE.ERRORS.DISCOUNT_PERCENT_MAX',
  },
};

function sessionOrPulseXorValidator(group: AbstractControl): ValidationErrors | null {
  const sessionCount = group.get('sessionCount')?.value as number | null;
  const pulseCount = group.get('pulseCount')?.value as number | null;
  const sessionFilled = sessionCount != null && sessionCount > 0;
  const pulseFilled = pulseCount != null && pulseCount > 0;

  if (!sessionFilled && !pulseFilled) {
    return { sessionOrPulseRequired: true };
  }

  if (sessionFilled && pulseFilled) {
    return { sessionAndPulseBothFilled: true };
  }

  return null;
}

@Component({
  selector: 'app-packages',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DropdownModule,
    InputSwitchModule,
    InputTextModule,
    InputNumberModule,
    InputTextareaModule,
    TableModule,
    TagModule,
    MultiSelectModule,
    ConfirmActionDialogComponent,
  ],
  templateUrl: './packages.component.html',
  styleUrl: './packages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PackagesComponent implements OnInit {
  private readonly service = inject(PackageService);
  private readonly permissions = inject(PermissionService);
  readonly currencyService = inject(CurrencyService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly isFieldInvalid = isFieldInvalid;
  readonly canManage = computed(() => this.permissions.hasPermission(Policies.PackagesManage));
  readonly serviceCategoryIdValue = computed(() => this.formValue().serviceCategoryId);
  readonly serviceCategorySearchText = signal('');
  readonly subServiceCategorySearchText = signal('');
  readonly categorySaving = signal<'service' | 'sub' | null>(null);
  readonly packages = signal<PackageListItem[]>([]);
  readonly total = signal(0);
  readonly totalCount = signal(0);
  readonly activeCount = signal(0);
  readonly closedCount = signal(0);
  readonly loading = signal(false);
  readonly pendingDelete = signal<PackageListItem | null>(null);
  readonly dialogOpen = signal(false);
  readonly editing = signal<PackageListItem | null>(null);
  readonly discountOpen = signal(false);
  readonly saving = signal(false);
  readonly pendingPlanReplacement = signal<'singleSession' | number | null>(null);
  private readonly manualPlanEdited = signal(false);
  readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  readonly rowsPerPageOptions = [5, 10, 20, 50];
  readonly rows = signal(5);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(this.translate.instant('PACKAGES.PAGE_REPORT'));
  readonly serviceCategories = signal<{ label: string; value: string }[]>([]);
  readonly subServiceCategories = signal<{ label: string; value: string }[]>([]);
  readonly availableStaff = signal<{ label: string; value: string }[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    status: [true],
    offerType: ['singleSession' as PackageOfferType, Validators.required],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]],
    serviceCategoryId: [null as string | null, Validators.required],
    subServiceCategoryId: [null as string | null],
    sessionDurationValue: [30, [Validators.required, Validators.min(1)]],
    sessionDurationUnit: ['minute' as PackageDurationUnit, Validators.required],
    sessionCount: [null as number | null],
    pulseCount: [null as number | null, [Validators.min(0)]],
    packageExpiryMonths: [12 as number | null],
    price: [0, [Validators.required, Validators.min(0)]],
    cashEnabled: [true],
    installmentEnabled: [false],
    installmentPrice: [null as number | null],
    firstPayment: [null as number | null],
    installmentCount: [null as number | null],
    installments: [[] as PackageInstallmentRow[]],
    allStaff: [true],
    staffIds: [[] as string[]],
    discountCode: ['', [Validators.maxLength(50)]],
    discountPercent: [0 as number | null, [Validators.min(0), Validators.max(100)]],
  });

  readonly formValue = signal<PackageFormValue>(this.form.getRawValue());

  readonly descriptionLength = computed(() => (this.formValue().description ?? '').length);
  readonly priceAfterDiscount = computed(() => {
    const price = Number(this.formValue().price) || 0;
    const percent = Number(this.formValue().discountPercent) || 0;
    const clamped = Math.min(100, Math.max(0, percent));
    return Math.max(0, price * (1 - clamped / 100));
  });
  readonly offerTypeValue = computed(() => this.formValue().offerType);
  readonly isPackageOffer = computed(() => this.offerTypeValue() === 'package');
  readonly bothSessionAndPulseFilled = computed(() => {
    const value = this.formValue();
    return (
      this.isPackageOffer() &&
      value.sessionCount != null &&
      value.sessionCount > 0 &&
      value.pulseCount != null &&
      value.pulseCount > 0
    );
  });
  readonly neitherSessionNorPulseFilled = computed(() => {
    const value = this.formValue();
    return (
      this.isPackageOffer() &&
      (value.sessionCount == null || value.sessionCount <= 0) &&
      (value.pulseCount == null || value.pulseCount <= 0)
    );
  });
  readonly statusValue = computed(() => this.formValue().status);
  readonly installmentEnabledValue = computed(() => this.formValue().installmentEnabled);
  readonly allStaffValue = computed(() => this.formValue().allStaff);
  readonly installmentRows = computed(() => this.formValue().installments);
  readonly installmentTotal = computed(() =>
    this.installmentRows().reduce((total, row) => total + (Number(row.amount) || 0), 0)
  );
  readonly remainingInstallmentBalance = computed(() =>
    Math.max(
      0,
      (Number(this.formValue().installmentPrice) || 0) -
        (Number(this.formValue().firstPayment) || 0)
    )
  );
  readonly distributedSessions = computed(() =>
    this.installmentRows().reduce((total, row) => total + (Number(row.sessionsUnlocked) || 0), 0)
  );
  readonly prepaymentReleaseLimit = computed(() =>
    Math.min(
      Math.max(0, (Number(this.formValue().sessionCount) || 0) - 1),
      Math.ceil((Number(this.formValue().sessionCount) || 0) * 0.7 - 0.5)
    )
  );

  readonly offerTypeOptions: { label: string; value: PackageOfferType }[] = [
    { label: 'PACKAGES.OFFER_TYPE_PACKAGE', value: 'package' },
    { label: 'PACKAGES.OFFER_TYPE_SINGLE', value: 'singleSession' },
  ];
  readonly statusOptions: { label: string; value: PackageListStatus }[] = [
    { label: 'PACKAGES.STATUS_ACTIVE', value: 'active' },
    { label: 'PACKAGES.STATUS_CANCELLED', value: 'cancelled' },
  ];
  readonly durationUnitOptions: { label: string; value: PackageDurationUnit }[] = [
    { label: 'PACKAGES.CREATE.DURATION_UNIT_MINUTE', value: 'minute' },
  ];
  readonly expiryMonthOptions = [1, 3, 6, 12, 18, 24].map(value => ({ value }));

  search = '';
  offerTypeFilter: PackageOfferType | null = null;
  serviceCategoryFilter: string | null = null;
  statusFilter: PackageListStatus | null = null;
  private readonly searchChanges = new Subject<string>();

  ngOnInit(): void {
    setupServerErrorClearing(this.form, this.destroyRef, [
      'name',
      'description',
      'serviceCategoryId',
      'subServiceCategoryId',
      'sessionDurationValue',
      'sessionCount',
      'pulseCount',
      'packageExpiryMonths',
      'price',
      'cashEnabled',
      'installmentPrice',
      'firstPayment',
      'installmentCount',
      'installments',
      'staffIds',
      'discountCode',
      'discountPercent',
    ]);
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formValue.set(this.form.getRawValue());
    });
    this.form.controls.cashEnabled.setValidators(control =>
      control.value || this.form.controls.installmentEnabled.value
        ? null
        : { paymentOptionRequired: true }
    );
    this.form.controls.installmentEnabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncPaymentValidators();
        if (
          this.form.controls.installmentEnabled.value &&
          this.form.controls.offerType.value === 'package'
        ) {
          this.suggestDistribution();
        }
      });
    this.form.controls.cashEnabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncPaymentValidators());
    this.syncPaymentValidators();
    this.form.controls.installmentPrice.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculateAmounts());
    this.form.controls.firstPayment.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculateAmounts());
    this.form.controls.installmentCount.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resizeInstallmentRows());
    this.form.controls.sessionCount.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.validateInstallmentRows());
    this.form.controls.serviceCategoryId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(categoryId => {
        this.form.controls.subServiceCategoryId.setValue(null, { emitEvent: false });
        this.loadSubServiceCategories(categoryId);
      });
    this.form.controls.allStaff.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncStaffValidator());
    this.syncStaffValidator();
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('PACKAGES.PAGE_REPORT'));
    });
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
    this.loadServiceCategories();
    this.loadAvailableStaff();
  }

  load(): void {
    const rows = this.rows();
    this.loading.set(true);
    this.service
      .list({
        pageNumber: Math.floor(this.first() / rows) + 1,
        pageSize: rows,
        search: this.search.trim() || undefined,
        offerType: this.offerTypeFilter ?? undefined,
        serviceCategoryId: this.serviceCategoryFilter ?? undefined,
        status: this.statusFilter ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.packages.set(result.items);
          this.total.set(result.totalCount);
          this.totalCount.set(result.totalCount);
          this.activeCount.set(result.activeCount);
          this.closedCount.set(result.cancelledCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.first.set(first);
    this.rows.set(rows);
    this.load();
  }

  applyFilters(): void {
    this.first.set(0);
    this.load();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.searchChanges.next(value.trim());
  }

  clearFilters(): void {
    this.search = '';
    this.offerTypeFilter = null;
    this.serviceCategoryFilter = null;
    this.statusFilter = null;
    this.applyFilters();
  }

  openCreate(): void {
    this.editing.set(null);
    this.resetForm(DEFAULT_FORM_VALUE);
    this.discountOpen.set(false);
    this.dialogOpen.set(true);
  }

  openEdit(item: PackageListItem): void {
    this.editing.set(item);
    this.discountOpen.set(false);
    this.dialogOpen.set(true);
    this.service
      .get(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => {
          this.resetForm({
            name: detail.name,
            status: detail.status === 'active',
            offerType: detail.offerType,
            description: detail.description ?? '',
            serviceCategoryId: detail.serviceCategoryId,
            subServiceCategoryId: detail.subServiceCategoryId,
            sessionDurationValue: detail.sessionDurationMinutes,
            sessionDurationUnit: 'minute',
            sessionCount:
              detail.sessionCount != null && detail.sessionCount > 0 ? detail.sessionCount : null,
            pulseCount:
              detail.pulseCount != null && detail.pulseCount > 0 ? detail.pulseCount : null,
            packageExpiryMonths: detail.packageExpiryMonths ?? 12,
            price: detail.price,
            cashEnabled: detail.cashEnabled,
            installmentEnabled: detail.installmentEnabled,
            installmentPrice: detail.installmentPrice,
            firstPayment: detail.firstPayment,
            installmentCount: detail.installmentCount,
            installments: detail.installments.map(row => ({
              amount: row.amount,
              sessionsUnlocked: row.sessionsUnlocked,
            })),
            allStaff: detail.allStaff,
            staffIds: detail.staffIds,
            discountCode: detail.discountCode ?? '',
            discountPercent: detail.discountPercent ?? 0,
          });
          this.discountOpen.set(
            !!(detail.discountCode?.trim() || (detail.discountPercent ?? 0) > 0)
          );
        },
        error: () => {
          this.close();
        },
      });
  }

  close(): void {
    this.dialogOpen.set(false);
    this.editing.set(null);
    this.saving.set(false);
  }

  selectOfferType(type: PackageOfferType): void {
    if (type === 'singleSession' && this.form.controls.installmentEnabled.value) {
      this.pendingPlanReplacement.set('singleSession');
      return;
    }
    this.applyOfferType(type);
  }

  private applyOfferType(type: PackageOfferType): void {
    this.form.controls.offerType.setValue(type);
    if (type === 'singleSession') {
      this.form.controls.installmentEnabled.setValue(false);
    }
    this.syncPackageFieldValidators(type);
    this.syncPaymentValidators();
    this.syncStaffValidator();
  }

  confirmPlanReplacement(): void {
    const pending = this.pendingPlanReplacement();
    this.pendingPlanReplacement.set(null);
    if (pending === 'singleSession') {
      this.applyOfferType('singleSession');
    } else if (pending !== null) {
      this.form.controls.installmentCount.setValue(pending, { emitEvent: false });
      this.resizeInstallmentRows(true);
    }
  }

  cancelPlanReplacement(): void {
    this.pendingPlanReplacement.set(null);
  }

  updateInstallmentRow(
    index: number,
    field: keyof PackageInstallmentRow,
    value: number | null
  ): void {
    const rows = this.form.controls.installments.value.map(row => ({ ...row }));
    rows[index][field] = Number(value) || 0;
    this.form.controls.installments.setValue(rows);
    this.form.controls.installments.markAsTouched();
    this.manualPlanEdited.set(true);
  }

  cumulativeSessions(index: number): number {
    return this.installmentRows()
      .slice(0, index + 1)
      .reduce((total, row) => total + (Number(row.sessionsUnlocked) || 0), 0);
  }

  suggestDistribution(): void {
    if (
      !this.form.controls.installmentEnabled.value ||
      this.form.controls.offerType.value !== 'package'
    ) {
      return;
    }
    const count = this.form.controls.installmentCount.value;
    if (count == null || count < 1) {
      this.form.controls.installmentCount.setValue(3);
      this.suggestDistribution();
      return;
    }
    const rows = this.distributedAmounts(count).map(amount => ({ amount, sessionsUnlocked: 0 }));
    const totalSessions = Math.max(0, Number(this.form.controls.sessionCount.value) || 0);
    const fullyPaidUpfront =
      (Number(this.form.controls.installmentPrice.value) || 0) -
        (Number(this.form.controls.firstPayment.value) || 0) ===
      0;
    if (!fullyPaidUpfront) {
      const early = Math.min(Math.max(0, totalSessions - 1), Math.ceil(totalSessions * 0.7 - 0.5));
      for (let index = 0; index < count - 1; index++) {
        rows[index].sessionsUnlocked =
          Math.floor(early / (count - 1)) + (index < early % (count - 1) ? 1 : 0);
      }
      rows[count - 1].sessionsUnlocked = totalSessions - early;
    }
    this.form.controls.installments.setValue(rows);
    this.manualPlanEdited.set(false);
    this.validateInstallmentRows();
  }

  private distributedAmounts(count: number): number[] {
    const totalCents = Math.round(
      Math.max(
        0,
        (Number(this.form.controls.installmentPrice.value) || 0) -
          (Number(this.form.controls.firstPayment.value) || 0)
      ) * 100
    );
    const base = Math.floor(totalCents / count);
    return Array.from(
      { length: count },
      (_, index) => (base + (index < totalCents % count ? 1 : 0)) / 100
    );
  }

  private resizeInstallmentRows(confirmed = false): void {
    const count = Math.max(0, Number(this.form.controls.installmentCount.value) || 0);
    const previous = this.form.controls.installments.value;
    if (!confirmed && this.manualPlanEdited() && count !== previous.length) {
      this.form.controls.installmentCount.setValue(previous.length, { emitEvent: false });
      this.formValue.set(this.form.getRawValue());
      this.pendingPlanReplacement.set(count);
      return;
    }
    const rows = Array.from(
      { length: count },
      (_, index) => previous[index] ?? { amount: 0, sessionsUnlocked: 0 }
    );
    this.form.controls.installments.setValue(rows);
    this.recalculateAmounts();
  }

  private recalculateAmounts(): void {
    this.form.controls.firstPayment.updateValueAndValidity({ emitEvent: false });
    const rows = this.form.controls.installments.value;
    if (rows.length === 0) {
      this.validateInstallmentRows();
      return;
    }
    const amounts = this.distributedAmounts(rows.length);
    this.form.controls.installments.setValue(
      rows.map((row, index) => ({
        ...row,
        amount: amounts[index],
      }))
    );
    this.validateInstallmentRows();
  }

  private validateInstallmentRows(): void {
    this.form.controls.installments.updateValueAndValidity({ emitEvent: false });
    this.formValue.set(this.form.getRawValue());
  }

  toggleDiscount(): void {
    this.discountOpen.update(open => !open);
  }

  addServiceCategory(): void {
    const name = this.serviceCategorySearchText().trim();
    if (!name || this.categorySaving()) {
      return;
    }

    this.categorySaving.set('service');
    this.service
      .createServiceCategory({ name, icon: DEFAULT_CATEGORY_ICON })
      .pipe(
        finalize(() => this.categorySaving.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: category => {
          this.serviceCategories.update(items => [
            ...items,
            { label: category.name, value: category.id },
          ]);
          this.form.controls.serviceCategoryId.setValue(category.id);
          this.serviceCategorySearchText.set('');
          this.loadSubServiceCategories(category.id);
        },
        error: (error: HttpErrorResponse) =>
          this.handleCategoryCreateError(error, 'serviceCategoryId'),
      });
  }

  addSubServiceCategory(): void {
    const name = this.subServiceCategorySearchText().trim();
    const serviceCategoryId = this.serviceCategoryIdValue();
    if (!name || !serviceCategoryId || this.categorySaving()) {
      return;
    }

    this.categorySaving.set('sub');
    this.service
      .createSubServiceCategory({ name, serviceCategoryId })
      .pipe(
        finalize(() => this.categorySaving.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: category => {
          this.subServiceCategories.update(items => [
            ...items,
            { label: category.name, value: category.id },
          ]);
          this.form.controls.subServiceCategoryId.setValue(category.id);
          this.subServiceCategorySearchText.set('');
        },
        error: (error: HttpErrorResponse) =>
          this.handleCategoryCreateError(error, 'subServiceCategoryId'),
      });
  }

  onServiceCategoryFilter(event: { filter?: string }): void {
    this.serviceCategorySearchText.set((event.filter ?? '').trim());
  }

  onSubServiceCategoryFilter(event: { filter?: string }): void {
    this.subServiceCategorySearchText.set((event.filter ?? '').trim());
  }

  private handleCategoryCreateError(
    error: HttpErrorResponse,
    targetField: 'serviceCategoryId' | 'subServiceCategoryId'
  ): void {
    clearServerFieldError(this.form, 'name');

    const duplicateCode = this.findCategoryDuplicateCode(error);
    if (duplicateCode) {
      const errorKey = `ERRORS.${duplicateCode}`;
      const detail = this.translate.instant(errorKey);
      const message = detail === errorKey ? duplicateCode : detail;

      this.showCategoryDuplicateToast(message);

      const control = this.form.get(targetField);
      if (control) {
        control.setErrors({ ...control.errors, server: message });
        control.markAsTouched();
      }
      return;
    }

    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
      detail:
        (error as HttpErrorResponse & { userMessage?: string }).userMessage ??
        this.translate.instant('HTTP_ERRORS.SERVER'),
    });
  }

  private findCategoryDuplicateCode(error: HttpErrorResponse): string | undefined {
    const fromCodes = extractApiErrorCodes(error).find(code =>
      PACKAGE_CATEGORY_DUPLICATE_CODES.has(code)
    );
    if (fromCodes) {
      return fromCodes;
    }

    return Object.values(extractApiFieldErrors(error)).find(value =>
      PACKAGE_CATEGORY_DUPLICATE_CODES.has(value)
    );
  }

  private lastCategoryDuplicateToastAt = 0;

  private showCategoryDuplicateToast(message: string): void {
    const now = Date.now();
    if (now - this.lastCategoryDuplicateToastAt < 750) {
      return;
    }
    this.lastCategoryDuplicateToastAt = now;

    this.toast.add({
      severity: 'warn',
      summary: this.translate.instant('PACKAGES.TITLE'),
      detail: message,
      life: 6000,
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.discountCode.invalid || this.form.controls.discountPercent.invalid) {
        this.discountOpen.set(true);
      }
      return;
    }
    const value = this.form.getRawValue();
    const payload = this.toPayload(value);
    const existing = this.editing();
    const request = existing
      ? this.service.update(existing.id, payload)
      : this.service.create(payload);
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: this.translate.instant('PACKAGES.TITLE'),
          detail: this.translate.instant('PACKAGES.SAVED'),
        });
        this.close();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        const fieldErrors = translateApiFieldErrors(extractApiFieldErrors(error), key =>
          this.translate.instant(key)
        );
        applyServerFieldErrors(this.form, fieldErrors);
        if (Object.keys(fieldErrors).length === 0) {
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
            detail:
              (error as HttpErrorResponse & { userMessage?: string }).userMessage ??
              this.translate.instant('HTTP_ERRORS.SERVER'),
          });
        }
      },
    });
  }

  getFieldError(field: string): string | null {
    const control = this.form.get(field);
    if (!control?.touched || !control.errors) {
      return null;
    }
    if (control.errors['server']) {
      return control.errors['server'];
    }
    if (field === 'price' && control.errors['min'] && !this.form.controls.cashEnabled.value) {
      return this.translate.instant('PACKAGES.CREATE.ERRORS.PRICE_MIN');
    }
    const fieldMap = FIELD_ERROR_KEYS[field] ?? {};
    for (const key of Object.keys(control.errors)) {
      const i18nKey = fieldMap[key];
      if (i18nKey) {
        return this.translate.instant(i18nKey);
      }
    }
    return this.translate.instant('ERRORS.FieldRequired');
  }

  requestDelete(item: PackageListItem): void {
    this.pendingDelete.set(item);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) {
      return;
    }
    this.service
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('PACKAGES.TITLE'),
            detail: this.translate.instant('PACKAGES.DELETED'),
          });
          this.cancelDelete();
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
            detail:
              (error as HttpErrorResponse & { userMessage?: string }).userMessage ??
              this.translate.instant('HTTP_ERRORS.SERVER'),
          });
        },
      });
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }
    const iso = value.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) {
      return value;
    }
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  formatPriceAmount(value: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  offerTypeLabel(type: PackageOfferType): string {
    return type === 'package'
      ? this.translate.instant('PACKAGES.OFFER_TYPE_PACKAGE')
      : this.translate.instant('PACKAGES.OFFER_TYPE_SINGLE');
  }

  categoryLabel(item: PackageListItem): string {
    return item.serviceCategoryName || '—';
  }

  showSessionPulseGroupError(): boolean {
    if (!this.isPackageOffer() || !this.form.touched) {
      return false;
    }

    return this.bothSessionAndPulseFilled() || this.neitherSessionNorPulseFilled();
  }

  sessionPulseGroupErrorKey(): string {
    return this.bothSessionAndPulseFilled()
      ? 'PACKAGES.CREATE.ERRORS.SESSION_AND_PULSE_BOTH_FILLED'
      : 'PACKAGES.CREATE.ERRORS.SESSION_OR_PULSE_REQUIRED';
  }

  private resetForm(value: PackageFormValue): void {
    this.manualPlanEdited.set(false);
    this.form.reset(value, { emitEvent: false });
    this.syncPackageFieldValidators(value.offerType);
    this.syncPaymentValidators();
    this.syncStaffValidator();
    this.formValue.set(this.form.getRawValue());
    this.loadSubServiceCategories(value.serviceCategoryId);
  }

  private syncPaymentValidators(): void {
    const price = this.form.controls.price;
    price.setValidators([
      Validators.required,
      Validators.min(this.form.controls.cashEnabled.value ? 0.01 : 0),
    ]);
    price.updateValueAndValidity({ emitEvent: false });
    const installmentPrice = this.form.controls.installmentPrice;
    installmentPrice.setValidators(
      this.form.controls.installmentEnabled.value ? [Validators.required, Validators.min(0.01)] : []
    );
    installmentPrice.updateValueAndValidity({ emitEvent: false });
    const enabled =
      this.form.controls.installmentEnabled.value &&
      this.form.controls.offerType.value === 'package';
    const firstPayment = this.form.controls.firstPayment;
    firstPayment.setValidators(
      enabled
        ? [
            Validators.required,
            Validators.min(0),
            control =>
              Number(control.value) > Number(this.form.controls.installmentPrice.value)
                ? { maxPayment: true }
                : null,
          ]
        : []
    );
    firstPayment.updateValueAndValidity({ emitEvent: false });
    const installmentCount = this.form.controls.installmentCount;
    installmentCount.setValidators(enabled ? [Validators.required, Validators.min(1)] : []);
    installmentCount.updateValueAndValidity({ emitEvent: false });
    const installments = this.form.controls.installments;
    installments.setValidators(
      enabled ? [control => this.installmentsValidation(control.value)] : []
    );
    installments.updateValueAndValidity({ emitEvent: false });
    if (!enabled) {
      firstPayment.setValue(null, { emitEvent: false });
      installmentCount.setValue(null, { emitEvent: false });
      installments.setValue([], { emitEvent: false });
    }
    this.form.controls.cashEnabled.updateValueAndValidity({ emitEvent: false });
  }

  private syncStaffValidator(): void {
    const staffIds = this.form.controls.staffIds;
    staffIds.setValidators(
      this.form.controls.allStaff.value
        ? []
        : [control => (control.value.length ? null : { requiredStaff: true })]
    );
    staffIds.updateValueAndValidity({ emitEvent: false });
    if (this.form.controls.allStaff.value) {
      staffIds.setValue([], { emitEvent: false });
    }
  }

  private installmentsValidation(rows: PackageInstallmentRow[]): ValidationErrors | null {
    if (rows.length !== this.form.controls.installmentCount.value) {
      return { rowsCount: true };
    }
    if (rows.some(row => row.amount < 0 || Math.round(row.amount * 100) !== row.amount * 100)) {
      return { amountInvalid: true };
    }
    const expected =
      (Number(this.form.controls.installmentPrice.value) || 0) -
      (Number(this.form.controls.firstPayment.value) || 0);
    if (
      Math.round(rows.reduce((total, row) => total + row.amount, 0) * 100) !==
      Math.round(expected * 100)
    ) {
      return { totalMismatch: true };
    }
    const sessions = Number(this.form.controls.sessionCount.value) || 0;
    let released = 0;
    let paid = Number(this.form.controls.firstPayment.value) || 0;
    for (const row of rows) {
      released += row.sessionsUnlocked;
      paid += row.amount;
      if (
        !Number.isInteger(row.sessionsUnlocked) ||
        row.sessionsUnlocked < 0 ||
        released > sessions
      ) {
        return { sessionsInvalid: true };
      }
      if (
        Math.round(paid * 100) <
          Math.round(Number(this.form.controls.installmentPrice.value) * 100) &&
        released > Math.min(Math.max(0, sessions - 1), Math.ceil(sessions * 0.7 - 0.5))
      ) {
        return { releaseCap: true };
      }
    }
    return null;
  }

  private syncPackageFieldValidators(type: PackageOfferType): void {
    const sessionCount = this.form.controls.sessionCount;
    const pulseCount = this.form.controls.pulseCount;

    if (type === 'package') {
      sessionCount.clearValidators();
      pulseCount.setValidators([Validators.min(0)]);
      this.form.setValidators(sessionOrPulseXorValidator);
    } else {
      sessionCount.clearValidators();
      pulseCount.clearValidators();
      sessionCount.setValue(null, { emitEvent: false });
      pulseCount.setValue(null, { emitEvent: false });
      this.form.clearValidators();
    }

    sessionCount.updateValueAndValidity({ emitEvent: false });
    pulseCount.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private toPayload(value: PackageFormValue): PackagePayload {
    const sessionFilled = value.sessionCount != null && value.sessionCount > 0;
    const pulseFilled = value.pulseCount != null && value.pulseCount > 0;

    return {
      name: value.name.trim(),
      isActive: value.status,
      offerType: value.offerType,
      description: value.description.trim(),
      serviceCategoryId: value.serviceCategoryId,
      subServiceCategoryId: value.subServiceCategoryId,
      sessionDurationMinutes: Number(value.sessionDurationValue) || 0,
      sessionCount:
        value.offerType === 'package' ? (sessionFilled ? value.sessionCount : null) : null,
      pulseCount: value.offerType === 'package' ? (pulseFilled ? value.pulseCount : null) : null,
      packageExpiryMonths: value.offerType === 'package' ? value.packageExpiryMonths : null,
      price: Number(value.price) || 0,
      cashEnabled: value.cashEnabled,
      installmentEnabled: value.installmentEnabled,
      installmentPrice: value.installmentEnabled ? value.installmentPrice : null,
      firstPayment: value.installmentEnabled ? value.firstPayment : null,
      installmentCount: value.installmentEnabled ? value.installmentCount : null,
      installments: value.installmentEnabled ? value.installments : [],
      allStaff: value.allStaff,
      staffIds: value.allStaff ? [] : value.staffIds,
      discountCode: value.discountCode.trim(),
      discountPercent: value.discountPercent,
    };
  }

  private loadServiceCategories(): void {
    this.service
      .listServiceCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: categories =>
          this.serviceCategories.set(
            categories.map(category => ({ label: category.name, value: category.id }))
          ),
        error: () => this.serviceCategories.set([]),
      });
  }

  private loadAvailableStaff(): void {
    this.service
      .listAvailableStaff()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: employees =>
          this.availableStaff.set(
            employees.map(employee => ({ label: employee.fullName, value: employee.id }))
          ),
        error: () => this.availableStaff.set([]),
      });
  }

  private loadSubServiceCategories(serviceCategoryId: string | null): void {
    if (!serviceCategoryId) {
      this.subServiceCategories.set([]);
      return;
    }
    this.service
      .listSubServiceCategories(serviceCategoryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: categories =>
          this.subServiceCategories.set(
            categories.map(category => ({ label: category.name, value: category.id }))
          ),
        error: () => this.subServiceCategories.set([]),
      });
  }
}
