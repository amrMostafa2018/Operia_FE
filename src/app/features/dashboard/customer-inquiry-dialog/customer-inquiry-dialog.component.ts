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
import { LanguageService } from '@core/services/language.service';
import {
  applyServerFieldErrors,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { CustomerInquiryResult } from '../models/customer-inquiry.model';
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
  private readonly languageService = inject(LanguageService);
  private readonly inquiryService = inject(CustomerInquiryService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private searchSubscription?: Subscription;

  readonly visible = input(false);
  readonly closed = output<void>();
  readonly searchForm = this.fb.nonNullable.group({
    mobile: ['', [Validators.required, Validators.pattern(/^\+?[\d\s()-]{8,20}$/)]],
  });
  readonly result = signal<CustomerInquiryResult | null>(null);
  readonly searched = signal(false);
  readonly loading = signal(false);
  readonly selectedPurchaseId = signal<string | null>(null);

  close(): void {
    this.searchSubscription?.unsubscribe();
    this.searchForm.reset({ mobile: '' });
    this.result.set(null);
    this.searched.set(false);
    this.loading.set(false);
    this.selectedPurchaseId.set(null);
    this.closed.emit();
  }

  search(): void {
    this.searchSubscription?.unsubscribe();
    this.searchForm.markAllAsTouched();
    this.result.set(null);
    this.searched.set(false);
    this.selectedPurchaseId.set(null);
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
          this.selectedPurchaseId.set(result?.purchases[0]?.id ?? null);
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
    return new Date(value).toLocaleDateString(
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
    this.selectedPurchaseId.update(current => (current === id ? null : id));
  }
}
