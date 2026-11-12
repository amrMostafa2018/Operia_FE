import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import {
  applyServerFieldErrors,
  extractApiErrorCodes,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { CustomerOperation } from './customer-operations.service';
import {
  CustomerStatement,
  CustomerStatementService,
  StatementPayment,
} from './customer-statement.service';

export interface StatementCollectedPayment {
  key: string;
  amount: number;
  paidAt: string | null;
  paymentMethod: string | null;
  recordedBy: string | null;
  isInitial: boolean;
}

@Component({
  selector: 'app-customer-statement-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, DialogModule, DropdownModule],
  templateUrl: './customer-statement-dialog.component.html',
  styleUrl: './customer-statement-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerStatementDialogComponent {
  readonly row = input.required<CustomerOperation>();
  readonly closed = output<void>();
  private readonly service = inject(CustomerStatementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly permissionService = inject(PermissionService);
  readonly language = inject(LanguageService);
  readonly currency = inject(CurrencyService);
  readonly statement = signal<CustomerStatement | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly failed = signal(false);
  readonly loadingMetaSlots = [0, 1, 2];
  readonly loadingBalanceSlots = [0, 1];
  readonly loadingTableSlots = [0, 1, 2, 3];
  readonly paymentVisible = signal(false);
  readonly paymentSaving = signal(false);
  readonly paymentUncertain = signal(false);
  readonly paymentForm = this.fb.nonNullable.group({
    paymentMethod: ['', Validators.required],
  });
  readonly canCollectInstallment = computed(() =>
    this.permissionService.hasPermission(Policies.CustomersCollectInstallment)
  );
  readonly collectedPayments = computed(() => this.buildCollectedPayments(this.statement()));
  private paymentKey: string | null = null;
  private paymentKeyStorageName: string | null = null;

  constructor() {
    queueMicrotask(() => {
      const row = this.row();
      const cached = this.service.peek(row.customerId, row.id);
      if (cached) {
        this.statement.set(this.present(cached));
        this.loading.set(false);
        this.refreshing.set(true);
      }

      this.load();
    });
  }

  close(): void {
    this.closed.emit();
  }

  formatDate(value: string | null): string {
    if (!value) {
      return this.translate.instant('CUSTOMER_STATEMENT.NOT_RECORDED');
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(
          Number(value.slice(0, 4)),
          Number(value.slice(5, 7)) - 1,
          Number(value.slice(8, 10))
        )
      : new Date(value);
    return date.toLocaleDateString(this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatTime(minutes: number): string {
    const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
    return date.toLocaleTimeString(this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-GB', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatMoney(value: number | null): string {
    if (value === null) {
      return '—';
    }

    const formatted = new Intl.NumberFormat(
      this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-EG',
      { minimumFractionDigits: 0, maximumFractionDigits: 2 }
    ).format(value);
    const currency = this.currency.currencyLabel();
    return currency ? `${formatted} ${currency}` : formatted;
  }

  paidInstallmentCount(data: CustomerStatement): number {
    return data.installments.filter(payment => payment.status === 'paid').length;
  }

  closePayment(): void {
    if (this.paymentSaving()) {
      return;
    }

    this.paymentVisible.set(false);
  }

  onPaymentVisibleChange(visible: boolean): void {
    if (!visible) {
      this.closePayment();
      return;
    }

    this.paymentVisible.set(true);
  }

  openPayment(): void {
    const data = this.statement();
    if (
      !data?.nextInstallmentEligible ||
      !data.nextInstallmentNumber ||
      data.paymentMethods.length === 0 ||
      !this.canCollectInstallment()
    ) {
      return;
    }

    this.paymentKeyStorageName = `operia.installment.${this.row().id}.${data.nextInstallmentNumber}`;
    this.paymentKey = sessionStorage.getItem(this.paymentKeyStorageName);
    if (!this.paymentKey) {
      this.paymentKey = crypto.randomUUID();
      sessionStorage.setItem(this.paymentKeyStorageName, this.paymentKey);
      this.paymentForm.reset({ paymentMethod: '' });
    }

    this.paymentVisible.set(true);
    if (this.paymentUncertain()) {
      this.recheckPayment(data.nextInstallmentNumber);
    }
  }

  paymentMethodError(): string | null {
    const control = this.paymentForm.controls.paymentMethod;
    if (!control.touched && !control.dirty) {
      return null;
    }

    if (control.hasError('required')) {
      return 'CUSTOMER_INQUIRY.PAYMENT_METHOD_REQUIRED';
    }

    if (control.hasError('server')) {
      return String(control.getError('server'));
    }

    return null;
  }

  collectInstallment(): void {
    const data = this.statement();
    this.paymentForm.markAllAsTouched();
    if (
      !data?.nextInstallmentEligible ||
      !data.nextInstallmentNumber ||
      !this.paymentKey ||
      this.paymentForm.invalid ||
      this.paymentSaving() ||
      this.paymentUncertain()
    ) {
      return;
    }

    const previousNumber = data.nextInstallmentNumber;
    this.paymentSaving.set(true);
    this.service
      .collectInstallment(
        this.row().id,
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
          this.load();
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
            previousNumber,
            translated && translated !== key ? translated : undefined
          );
        },
      });
  }

  recheckPayment(previousNumber?: number | null, failureMessage?: string): void {
    const row = this.row();
    this.service
      .get(row.customerId, row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: statement => {
          statement = this.present(statement);
          this.statement.set(statement);
          this.loading.set(false);
          this.failed.set(false);
          this.paymentUncertain.set(false);
          const keys = statement.collectionIdempotencyKeys ?? [];
          if (this.paymentKey && keys.includes(this.paymentKey)) {
            this.paymentVisible.set(false);
            this.clearPaymentKey();
            this.toast.add({
              severity: 'success',
              summary: 'OPERIA',
              detail: this.translate.instant('CUSTOMER_INQUIRY.COLLECTION_SAVED'),
            });
          } else if (previousNumber && statement.nextInstallmentNumber !== previousNumber) {
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

  private present(statement: CustomerStatement): CustomerStatement {
    return {
      ...statement,
      paymentMethods: statement.paymentMethods ?? [],
      collectionIdempotencyKeys: statement.collectionIdempotencyKeys ?? [],
      nextInstallmentEligible: statement.nextInstallmentEligible ?? false,
    };
  }

  private clearPaymentKey(): void {
    if (this.paymentKeyStorageName) {
      sessionStorage.removeItem(this.paymentKeyStorageName);
    }

    this.paymentKey = null;
    this.paymentKeyStorageName = null;
    this.paymentUncertain.set(false);
  }

  private load(): void {
    const row = this.row();
    if (this.statement()) {
      this.refreshing.set(true);
    }

    this.service
      .get(row.customerId, row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: statement => {
          this.statement.set(this.present(statement));
          this.loading.set(false);
          this.refreshing.set(false);
          this.failed.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.refreshing.set(false);
          if (this.statement()) {
            this.toast.add({
              severity: 'warn',
              summary: 'OPERIA',
              detail: this.translate.instant('CUSTOMER_STATEMENT.LOAD_ERROR'),
            });
            return;
          }

          this.failed.set(true);
        },
      });
  }

  private buildCollectedPayments(data: CustomerStatement | null): StatementCollectedPayment[] {
    if (!data) {
      return [];
    }

    const rows: StatementCollectedPayment[] = [];
    if (data.firstPayment) {
      rows.push({
        key: 'initial',
        amount: data.firstPayment.amount,
        paidAt: data.firstPayment.paidAtUtc,
        paymentMethod: data.firstPayment.paymentMethod,
        recordedBy: data.firstPayment.recordedBy,
        isInitial: true,
      });
    }

    for (const payment of data.installments) {
      if (payment.status !== 'paid' || this.sameCollection(data, payment)) {
        continue;
      }

      rows.push({
        key: `installment-${payment.number}`,
        amount: payment.amount,
        paidAt: payment.paidAtUtc,
        paymentMethod: payment.paymentMethod,
        recordedBy: payment.recordedBy,
        isInitial: false,
      });
    }

    return rows;
  }

  private sameCollection(data: CustomerStatement, payment: StatementPayment): boolean {
    const first = data.firstPayment;
    return (
      !!first &&
      first.amount === payment.amount &&
      !!payment.paidAtUtc &&
      first.paidAtUtc === payment.paidAtUtc
    );
  }
}
