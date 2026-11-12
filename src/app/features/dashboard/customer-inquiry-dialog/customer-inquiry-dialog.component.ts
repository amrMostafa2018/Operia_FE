import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChangeData, CountryISO, NgxIntlTelInputModule } from 'ngx-intl-tel-input';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import {
  applyServerFieldErrors,
  extractApiErrorCodes,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';
import {
  isValidPhoneChangeData,
  toBookingSearchMobile,
  toPhoneChangeData,
} from '@app/shared/utils/phone-number.util';
import { CustomerInquiryResult, InquiryPurchaseDetails } from '../models/customer-inquiry.model';
import { CustomerInquiryService } from './customer-inquiry.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';

@Component({
  selector: 'app-customer-inquiry-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogModule, NgxIntlTelInputModule],
  templateUrl: './customer-inquiry-dialog.component.html',
  styleUrl: './customer-inquiry-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInquiryDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly currencyService = inject(CurrencyService);
  private readonly languageService = inject(LanguageService);
  private readonly inquiryService = inject(CustomerInquiryService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissionService = inject(PermissionService);
  private searchSubscription?: Subscription;
  private detailsSubscription?: Subscription;

  readonly visible = input(false);
  readonly closed = output<void>();
  readonly searchForm = this.fb.group({
    mobile: this.fb.control<ChangeData | string | null>(null, Validators.required),
  });
  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly selectedCountryISO = signal<CountryISO>(PHONE_INPUT_DEFAULT_COUNTRY);
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;
  readonly result = signal<CustomerInquiryResult | null>(null);
  readonly searched = signal(false);
  readonly searchAttempted = signal(false);
  readonly loading = signal(false);
  readonly selectedPurchaseId = signal<string | null>(null);
  readonly purchaseDetails = signal<InquiryPurchaseDetails | null>(null);
  readonly detailsLoading = signal(false);
  readonly paymentVisible = signal(false);
  readonly paymentSaving = signal(false);
  readonly paymentUncertain = signal(false);
  readonly canCollectInstallment = computed(() =>
    this.permissionService.hasPermission(Policies.CustomersCollectInstallment)
  );
  readonly paymentForm = this.fb.nonNullable.group({
    paymentMethod: ['', Validators.required],
  });
  private paymentKey: string | null = null;
  private paymentKeyStorageName: string | null = null;
  private readonly mobileRevision = signal(0);
  readonly mobileError = computed(() => this.readMobileError());

  constructor() {
    this.searchForm.controls.mobile.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.mobileRevision.update(version => version + 1);
        this.clearInquiry();
      });
  }

  close(): void {
    this.paymentVisible.set(false);
    this.searchSubscription?.unsubscribe();
    this.detailsSubscription?.unsubscribe();
    this.clearInquiry();
    this.searchForm.reset({ mobile: null });
    this.searchForm.markAsPristine();
    this.searchForm.markAsUntouched();
    this.searchAttempted.set(false);
    this.mobileRevision.update(version => version + 1);
    this.selectedCountryISO.set(PHONE_INPUT_DEFAULT_COUNTRY);
    this.closed.emit();
  }

  search(): void {
    this.clearInquiry();
    this.searchAttempted.set(true);
    this.searchForm.markAllAsTouched();
    const parsed = this.parsedMobile();
    const mobile = toBookingSearchMobile(parsed);
    if (!mobile || !isValidPhoneChangeData(parsed) || this.searchForm.invalid) return;

    this.loading.set(true);
    this.searchSubscription = this.inquiryService
      .findByMobile(mobile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.loading.set(false);
          this.result.set(result);
          this.searched.set(true);
          if (result?.purchases[0]) this.togglePurchase(result.purchases[0].id);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          const fieldErrors = translateApiFieldErrors(extractApiFieldErrors(error), key =>
            this.translate.instant(key)
          );
          applyServerFieldErrors(this.searchForm, fieldErrors);
          if (!fieldErrors['mobile']) {
            this.toast.add({
              severity: 'error',
              summary: 'OPERIA',
              detail: this.translate.instant('CUSTOMER_INQUIRY.CONNECTION_ERROR'),
            });
          }
        },
      });
  }

  formatDate(value: string): string {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(
          Number(value.slice(0, 4)),
          Number(value.slice(5, 7)) - 1,
          Number(value.slice(8, 10))
        )
      : new Date(value);
    return date.toLocaleDateString(
      this.languageService.currentLang() === 'ar' ? 'ar-EG' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
  }

  private readMobileError(): string | null {
    this.mobileRevision();
    const searched = this.searchAttempted();
    const parsed = this.parsedMobile();
    const national = this.nationalDigits(parsed);
    const typedNumber = national.length > 0;

    if (!searched && !typedNumber) {
      return null;
    }

    const control = this.searchForm.controls.mobile;
    if (control.hasError('server')) {
      return String(control.getError('server'));
    }

    if (!typedNumber) {
      return 'CUSTOMER_INQUIRY.ERRORS.MOBILE_REQUIRED';
    }

    if (control.hasError('validatePhoneNumber') || !isValidPhoneChangeData(parsed)) {
      if (!searched && national.length < 8) {
        return null;
      }
      return 'CUSTOMER_INQUIRY.ERRORS.MOBILE_INVALID';
    }

    return null;
  }

  onMobileCountryChange(country: { iso2: string }): void {
    const iso = country.iso2 as CountryISO;
    if (PHONE_INPUT_ONLY_COUNTRIES.includes(iso)) {
      this.selectedCountryISO.set(iso);
    }
  }

  selectedPurchaseName(): string {
    return (
      this.result()?.purchases.find(purchase => purchase.id === this.selectedPurchaseId())
        ?.offerName ?? ''
    );
  }

  paidInstallmentCount(details: InquiryPurchaseDetails): number {
    return details.installments.filter(installment => installment.status === 'paid').length;
  }

  installmentTotal(details: InquiryPurchaseDetails): number {
    return Math.max(details.installmentCount, details.installments.length);
  }

  togglePurchase(id: string): void {
    this.detailsSubscription?.unsubscribe();
    if (this.selectedPurchaseId() === id) {
      this.selectedPurchaseId.set(null);
      this.purchaseDetails.set(null);
      this.detailsLoading.set(false);
      return;
    }

    this.selectedPurchaseId.set(id);
    this.loadPurchaseDetails(id);
  }

  private loadPurchaseDetails(id: string): void {
    this.purchaseDetails.set(null);
    this.detailsLoading.set(true);
    this.detailsSubscription = this.inquiryService
      .getPurchaseDetails(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: details => {
          this.purchaseDetails.set(details);
          this.detailsLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.detailsLoading.set(false);
          const code = extractApiErrorCodes(error)[0];
          const key = code ? `ERRORS.${code}` : 'CUSTOMER_INQUIRY.DETAILS_ERROR';
          const message = this.translate.instant(key);
          this.toast.add({
            severity: 'error',
            summary: 'OPERIA',
            detail:
              message === key ? this.translate.instant('CUSTOMER_INQUIRY.DETAILS_ERROR') : message,
          });
        },
      });
  }

  openPayment(): void {
    const details = this.purchaseDetails();
    if (
      !details?.nextInstallmentEligible ||
      !details.nextInstallmentNumber ||
      details.paymentMethods.length === 0 ||
      !this.canCollectInstallment()
    )
      return;
    const purchaseId = this.selectedPurchaseId();
    if (!purchaseId) return;
    this.paymentKeyStorageName = `operia.installment.${purchaseId}.${details.nextInstallmentNumber}`;
    this.paymentKey = sessionStorage.getItem(this.paymentKeyStorageName);
    if (!this.paymentKey) {
      this.paymentKey = crypto.randomUUID();
      sessionStorage.setItem(this.paymentKeyStorageName, this.paymentKey);
      this.paymentForm.reset({ paymentMethod: '' });
    }
    this.paymentVisible.set(true);
    if (this.paymentUncertain()) this.recheckPayment(purchaseId, details.nextInstallmentNumber);
  }

  paymentMethodError(): string | null {
    const control = this.paymentForm.controls.paymentMethod;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'CUSTOMER_INQUIRY.PAYMENT_METHOD_REQUIRED';
    if (control.hasError('server')) return String(control.getError('server'));
    return null;
  }

  collectInstallment(): void {
    const details = this.purchaseDetails();
    const purchaseId = this.selectedPurchaseId();
    this.paymentForm.markAllAsTouched();
    if (
      !details?.nextInstallmentEligible ||
      !details.nextInstallmentNumber ||
      !purchaseId ||
      !this.paymentKey ||
      this.paymentForm.invalid ||
      this.paymentSaving() ||
      this.paymentUncertain()
    )
      return;

    const previousNumber = details.nextInstallmentNumber;
    this.paymentSaving.set(true);
    this.inquiryService
      .collectInstallment(
        purchaseId,
        this.paymentForm.controls.paymentMethod.value,
        this.paymentKey
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.paymentSaving.set(false);
          this.paymentVisible.set(false);
          this.clearPaymentKey();
          this.toast.add({
            severity: 'success',
            summary: 'OPERIA',
            detail: this.translate.instant('CUSTOMER_INQUIRY.COLLECTION_SAVED'),
          });
          this.loadPurchaseDetails(purchaseId);
        },
        error: (error: HttpErrorResponse) => {
          this.paymentSaving.set(false);
          const fieldErrors = translateApiFieldErrors(extractApiFieldErrors(error), key =>
            this.translate.instant(key)
          );
          applyServerFieldErrors(this.paymentForm, fieldErrors);
          this.paymentUncertain.set(true);
          const code = extractApiErrorCodes(error)[0];
          const key = code ? `ERRORS.${code}` : '';
          const translated = key ? this.translate.instant(key) : '';
          this.recheckPayment(
            purchaseId,
            previousNumber,
            translated && translated !== key ? translated : undefined
          );
        },
      });
  }

  recheckPayment(purchaseId?: string, previousNumber?: number, failureMessage?: string): void {
    const id = purchaseId ?? this.selectedPurchaseId();
    const number = previousNumber ?? this.purchaseDetails()?.nextInstallmentNumber;
    if (!id) return;
    this.inquiryService
      .getPurchaseDetails(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: details => {
          this.purchaseDetails.set(details);
          this.paymentUncertain.set(false);
          if (
            this.paymentKey &&
            details.collections.some(collection => collection.idempotencyKey === this.paymentKey)
          ) {
            this.paymentVisible.set(false);
            this.clearPaymentKey();
            this.toast.add({
              severity: 'success',
              summary: 'OPERIA',
              detail: this.translate.instant('CUSTOMER_INQUIRY.COLLECTION_SAVED'),
            });
          } else if (number && details.nextInstallmentNumber !== number) {
            this.paymentVisible.set(false);
            this.clearPaymentKey();
            this.toast.add({
              severity: 'warn',
              summary: 'OPERIA',
              detail: this.translate.instant('ERRORS.CustomerInstallmentAlreadyCollected'),
            });
          } else {
            this.toast.add({
              severity: 'warn',
              summary: 'OPERIA',
              detail:
                failureMessage ?? this.translate.instant('CUSTOMER_INQUIRY.COLLECTION_RECHECKED'),
            });
          }
        },
        error: () => {
          this.toast.add({
            severity: 'warn',
            summary: 'OPERIA',
            detail: this.translate.instant('CUSTOMER_INQUIRY.COLLECTION_UNKNOWN'),
          });
        },
      });
  }

  private clearPaymentKey(): void {
    if (this.paymentKeyStorageName) sessionStorage.removeItem(this.paymentKeyStorageName);
    this.paymentKey = null;
    this.paymentKeyStorageName = null;
    this.paymentUncertain.set(false);
  }

  formatMoney(value: number | null): string {
    if (value === null) return '—';
    const formatted = new Intl.NumberFormat(
      this.languageService.currentLang() === 'ar' ? 'ar-EG' : 'en-EG',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    ).format(value);
    const currency = this.currencyService.currencyLabel();
    return currency ? `${formatted} ${currency}` : formatted;
  }

  private clearInquiry(): void {
    this.searchSubscription?.unsubscribe();
    this.detailsSubscription?.unsubscribe();
    this.result.set(null);
    this.searched.set(false);
    this.loading.set(false);
    this.selectedPurchaseId.set(null);
    this.purchaseDetails.set(null);
    this.detailsLoading.set(false);
  }

  formatTime(minutes: number): string {
    const hour = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const minute = (minutes % 60).toString().padStart(2, '0');
    return `${hour}:${minute}`;
  }

  private parsedMobile(): ChangeData | null {
    const raw = this.searchForm.controls.mobile.value;
    if (!raw) {
      return null;
    }

    return typeof raw === 'string' ? toPhoneChangeData(raw) : raw;
  }

  private nationalDigits(value: ChangeData | null): string {
    if (!value) {
      return '';
    }

    return (value.nationalNumber ?? value.number ?? '').replace(/\D/g, '');
  }
}
