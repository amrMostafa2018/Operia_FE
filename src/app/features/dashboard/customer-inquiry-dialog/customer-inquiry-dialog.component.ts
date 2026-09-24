import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { LanguageService } from '@core/services/language.service';
import {
  CustomerInquiryResult,
  InquiryCustomerRecord,
  inquiryServiceTypeKey,
  inquiryStatusKey,
  lookupCustomerInquiry,
} from '../models/customer-inquiry.model';

@Component({
  selector: 'app-customer-inquiry-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TagModule,
  ],
  templateUrl: './customer-inquiry-dialog.component.html',
  styleUrl: './customer-inquiry-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInquiryDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly languageService = inject(LanguageService);

  readonly visible = input(false);
  readonly closed = output<void>();

  readonly searchForm = this.fb.nonNullable.group({
    mobile: ['', [Validators.required, Validators.pattern(/^01[0125]\d{8}$/)]],
  });

  readonly result = signal<CustomerInquiryResult | null>(null);
  readonly notFound = signal(false);
  readonly searched = signal(false);
  readonly expandedRecordId = signal<string | null>(null);

  close(): void {
    this.reset();
    this.closed.emit();
  }

  search(): void {
    this.searchForm.markAllAsTouched();
    if (this.searchForm.invalid) {
      return;
    }

    const mobile = this.searchForm.controls.mobile.value.trim();
    const inquiry = lookupCustomerInquiry(mobile);
    this.searched.set(true);
    this.notFound.set(!inquiry);
    this.result.set(inquiry);
    this.expandedRecordId.set(inquiry?.records[0]?.id ?? null);
  }

  toggleRecord(record: InquiryCustomerRecord): void {
    this.expandedRecordId.update(current =>
      current === record.id ? null : record.id
    );
  }

  isExpanded(record: InquiryCustomerRecord): boolean {
    return this.expandedRecordId() === record.id;
  }

  statusKey(status: InquiryCustomerRecord['status']): string {
    return inquiryStatusKey(status);
  }

  serviceTypeKey(type: InquiryCustomerRecord['serviceType']): string {
    return inquiryServiceTypeKey(type);
  }

  formatDate(value: string): string {
    const date = new Date(value + 'T12:00:00');
    return date.toLocaleDateString(
      this.languageService.currentLang() === 'ar' ? 'ar-EG' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
  }

  mobileError(): string | null {
    const control = this.searchForm.controls.mobile;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'CUSTOMER_INQUIRY.ERRORS.MOBILE_REQUIRED';
    }
    if (control.hasError('pattern')) {
      return 'CUSTOMER_INQUIRY.ERRORS.MOBILE_INVALID';
    }
    if (control.hasError('server')) {
      return String(control.getError('server'));
    }
    return null;
  }

  customerInitial(name: string): string {
    return name.trim().charAt(0) || '?';
  }

  private reset(): void {
    this.searchForm.reset({ mobile: '' });
    this.result.set(null);
    this.notFound.set(false);
    this.searched.set(false);
    this.expandedRecordId.set(null);
  }
}
