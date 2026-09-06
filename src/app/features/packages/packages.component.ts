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
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  sessionCount: 0,
  pulseCount: 0,
  packageExpiryMonths: 12,
  price: 0,
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
    required: 'PACKAGES.CREATE.ERRORS.SESSION_COUNT_REQUIRED',
    min: 'PACKAGES.CREATE.ERRORS.SESSION_COUNT_MIN',
  },
  pulseCount: {
    min: 'PACKAGES.CREATE.ERRORS.PULSE_COUNT_MIN',
  },
  price: {
    required: 'PACKAGES.CREATE.ERRORS.PRICE_REQUIRED',
    min: 'PACKAGES.CREATE.ERRORS.PRICE_MIN',
  },
  discountCode: {
    maxlength: 'PACKAGES.CREATE.ERRORS.DISCOUNT_CODE_MAX',
  },
  discountPercent: {
    min: 'PACKAGES.CREATE.ERRORS.DISCOUNT_PERCENT_MIN',
    max: 'PACKAGES.CREATE.ERRORS.DISCOUNT_PERCENT_MAX',
  },
};

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
  readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  readonly rowsPerPageOptions = [5, 10, 20, 50];
  readonly rows = signal(5);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(this.translate.instant('PACKAGES.PAGE_REPORT'));
  readonly serviceCategories = signal<{ label: string; value: string }[]>([]);
  readonly subServiceCategories = signal<{ label: string; value: string }[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    status: [true],
    offerType: ['singleSession' as PackageOfferType, Validators.required],
    description: ['', [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]],
    serviceCategoryId: [null as string | null, Validators.required],
    subServiceCategoryId: [null as string | null],
    sessionDurationValue: [30, [Validators.required, Validators.min(1)]],
    sessionDurationUnit: ['minute' as PackageDurationUnit, Validators.required],
    sessionCount: [0],
    pulseCount: [0 as number | null, [Validators.min(0)]],
    packageExpiryMonths: [12 as number | null],
    price: [0, [Validators.required, Validators.min(0)]],
    discountCode: ['', [Validators.maxLength(50)]],
    discountPercent: [0 as number | null, [Validators.min(0), Validators.max(100)]],
  });

  private readonly formValue = signal<PackageFormValue>(this.form.getRawValue());

  readonly descriptionLength = computed(() => (this.formValue().description ?? '').length);
  readonly priceAfterDiscount = computed(() => {
    const price = Number(this.formValue().price) || 0;
    const percent = Number(this.formValue().discountPercent) || 0;
    const clamped = Math.min(100, Math.max(0, percent));
    return Math.max(0, price * (1 - clamped / 100));
  });
  readonly offerTypeValue = computed(() => this.formValue().offerType);
  readonly isPackageOffer = computed(() => this.offerTypeValue() === 'package');
  readonly statusValue = computed(() => this.formValue().status);

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
      'discountCode',
      'discountPercent',
    ]);
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formValue.set(this.form.getRawValue());
    });
    this.form.controls.serviceCategoryId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(categoryId => {
        this.form.controls.subServiceCategoryId.setValue(null, { emitEvent: false });
        this.loadSubServiceCategories(categoryId);
      });
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('PACKAGES.PAGE_REPORT'));
    });
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
    this.loadServiceCategories();
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
            sessionCount: detail.sessionCount ?? 0,
            pulseCount: detail.pulseCount ?? 0,
            packageExpiryMonths: detail.packageExpiryMonths ?? 12,
            price: detail.price,
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
    this.form.controls.offerType.setValue(type);
    this.syncPackageFieldValidators(type);
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

  private resetForm(value: PackageFormValue): void {
    this.form.reset(value);
    this.syncPackageFieldValidators(value.offerType);
    this.formValue.set(this.form.getRawValue());
    this.loadSubServiceCategories(value.serviceCategoryId);
  }

  private syncPackageFieldValidators(type: PackageOfferType): void {
    const sessionCount = this.form.controls.sessionCount;
    if (type === 'package') {
      sessionCount.setValidators([Validators.required, Validators.min(1)]);
    } else {
      sessionCount.clearValidators();
      sessionCount.setValue(0, { emitEvent: false });
      this.form.controls.pulseCount.setValue(0, { emitEvent: false });
    }
    sessionCount.updateValueAndValidity({ emitEvent: false });
  }

  private toPayload(value: PackageFormValue): PackagePayload {
    return {
      name: value.name.trim(),
      isActive: value.status,
      offerType: value.offerType,
      description: value.description.trim(),
      serviceCategoryId: value.serviceCategoryId ?? '',
      subServiceCategoryId: value.subServiceCategoryId,
      sessionDurationMinutes: Number(value.sessionDurationValue) || 0,
      sessionCount: value.offerType === 'package' ? Number(value.sessionCount) || 0 : 0,
      pulseCount: value.offerType === 'package' ? value.pulseCount : null,
      packageExpiryMonths: value.offerType === 'package' ? value.packageExpiryMonths : null,
      price: Number(value.price) || 0,
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
