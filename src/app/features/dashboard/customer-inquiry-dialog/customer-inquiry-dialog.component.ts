import {
  ChangeDetectionStrategy,
  Component,
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
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import {
  applyServerFieldErrors,
  extractApiErrorCodes,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { CustomerInquiryResult, InquiryPurchaseDetails } from '../models/customer-inquiry.model';
import { CustomerInquiryService } from './customer-inquiry.service';

@Component({
  selector: 'app-customer-inquiry-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogModule, InputTextModule, TagModule],
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
  private searchSubscription?: Subscription;
  private detailsSubscription?: Subscription;

  readonly visible = input(false);
  readonly closed = output<void>();
  readonly searchForm = this.fb.nonNullable.group({
    mobile: ['', [Validators.required, Validators.pattern(/^\+?[\d\s()-]{8,20}$/)]],
  });
  readonly result = signal<CustomerInquiryResult | null>(null);
  readonly searched = signal(false);
  readonly loading = signal(false);
  readonly selectedPurchaseId = signal<string | null>(null);
  readonly purchaseDetails = signal<InquiryPurchaseDetails | null>(null);
  readonly detailsLoading = signal(false);

  constructor() {
    this.searchForm.controls.mobile.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearInquiry());
  }

  close(): void {
    this.clearInquiry();
    this.searchForm.reset({ mobile: '' });
    this.closed.emit();
  }

  search(): void {
    this.clearInquiry();
    this.searchForm.markAllAsTouched();
    if (this.searchForm.invalid) return;

    this.loading.set(true);
    this.searchSubscription = this.inquiryService
      .findByMobile(this.searchForm.controls.mobile.value.trim())
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

  mobileError(): string | null {
    const control = this.searchForm.controls.mobile;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'CUSTOMER_INQUIRY.ERRORS.MOBILE_REQUIRED';
    if (control.hasError('pattern')) return 'CUSTOMER_INQUIRY.ERRORS.MOBILE_INVALID';
    if (control.hasError('server')) return String(control.getError('server'));
    return null;
  }

  customerInitial(name: string): string {
    return name.trim().charAt(0) || '?';
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
}
