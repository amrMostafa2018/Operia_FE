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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { CurrencyService } from '@core/services/currency.service';
import {
  applyServerFieldErrors,
  clearServerFieldError,
  extractApiErrorCodes,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { CustomerOperation } from './customer-operations.service';
import {
  CustomerAction,
  CustomerActionService,
  CustomerBlockAction,
} from './customer-action.service';

@Component({
  selector: 'app-customer-action-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, DialogModule],
  templateUrl: './customer-action-dialog.component.html',
  styleUrl: './customer-action-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActionDialogComponent {
  readonly row = input.required<CustomerOperation>();
  readonly canRefund = input(false);
  readonly canBlock = input(false);
  readonly closed = output<boolean>();
  private readonly service = inject(CustomerActionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  readonly currency = inject(CurrencyService);
  readonly data = signal<CustomerAction | CustomerBlockAction | null>(null);
  readonly purchaseAction = computed(() => {
    const data = this.data();
    return data && 'purchaseId' in data ? data : null;
  });
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly savingRefund = signal(false);
  readonly savingBlock = signal(false);
  private changed = false;
  private refundKey = crypto.randomUUID();

  readonly refundForm = new FormGroup({
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.pattern(/^\d+(\.\d{1,2})?$/),
    ]),
    note: new FormControl('', [Validators.maxLength(1000)]),
  });
  readonly blockForm = new FormGroup({
    isBlocked: new FormControl(false, { nonNullable: true }),
    reason: new FormControl('', [Validators.maxLength(500)]),
  });

  constructor() {
    queueMicrotask(() => this.load());
    this.refundForm.controls.amount.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => clearServerFieldError(this.refundForm, 'amount'));
    this.refundForm.controls.note.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => clearServerFieldError(this.refundForm, 'note'));
    this.blockForm.controls.reason.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => clearServerFieldError(this.blockForm, 'reason'));
  }

  close(): void {
    this.closed.emit(this.changed);
  }

  refundError(): string | null {
    const errors = this.refundForm.controls.amount.errors;
    if (!errors || !this.refundForm.controls.amount.touched) return null;
    if (errors['required']) return this.translate.instant('CUSTOMER_ACTION.AMOUNT_REQUIRED');
    if (errors['min']) return this.translate.instant('CUSTOMER_ACTION.AMOUNT_POSITIVE');
    if (errors['max']) return this.translate.instant('CUSTOMER_ACTION.AMOUNT_CAP');
    if (errors['pattern']) return this.translate.instant('CUSTOMER_ACTION.AMOUNT_DECIMALS');
    return errors['server'] ?? null;
  }

  noteError(): string | null {
    const errors = this.refundForm.controls.note.errors;
    if (!errors || !this.refundForm.controls.note.touched) return null;
    if (errors['maxlength']) return this.translate.instant('CUSTOMER_ACTION.NOTE_LENGTH');
    return errors['server'] ?? null;
  }

  reasonError(): string | null {
    const errors = this.blockForm.controls.reason.errors;
    if (!errors || !this.blockForm.controls.reason.touched) return null;
    if (errors['maxlength']) return this.translate.instant('CUSTOMER_ACTION.REASON_LENGTH');
    return errors['server'] ?? null;
  }

  saveRefund(): void {
    const data = this.purchaseAction();
    if (!data || !this.canRefund() || this.savingRefund()) return;
    this.refundForm.controls.amount.setValidators([
      Validators.required,
      Validators.min(0.01),
      Validators.max(data.remainingRefundable),
      Validators.pattern(/^\d+(\.\d{1,2})?$/),
    ]);
    this.refundForm.controls.amount.updateValueAndValidity();
    this.refundForm.markAllAsTouched();
    if (this.refundForm.invalid) return;
    const amount = this.refundForm.controls.amount.value!;
    this.savingRefund.set(true);
    this.service
      .refund(
        data.purchaseId,
        amount,
        this.refundKey,
        this.refundForm.controls.note.value?.trim() || null
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingRefund.set(false);
          this.changed = true;
          this.success('REFUND_SUCCESS');
          this.close();
        },
        error: (error: HttpErrorResponse) => {
          this.savingRefund.set(false);
          this.showError(error, this.refundForm);
          this.load();
        },
      });
  }

  saveBlock(): void {
    const data = this.data();
    if (!data || !this.canBlock() || this.savingBlock()) return;
    this.blockForm.markAllAsTouched();
    if (this.blockForm.invalid) return;
    const isBlocked = this.blockForm.controls.isBlocked.value;
    this.savingBlock.set(true);
    this.service
      .setBlock(
        data.customerId,
        isBlocked,
        this.blockForm.controls.reason.value?.trim() || null,
        data.customerVersion
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingBlock.set(false);
          this.changed = true;
          this.success(isBlocked ? 'BLOCK_SUCCESS' : 'UNBLOCK_SUCCESS');
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.savingBlock.set(false);
          this.showError(error, this.blockForm);
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.failed.set(false);
    const row = this.row();
    const request = row.id.includes(':')
      ? this.service.getSaleAction(row.customerId, row.saleId)
      : this.service.get(row.customerId, row.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data.set(data);
        this.blockForm.setValue({ isBlocked: data.isBlocked, reason: data.blockReason ?? '' });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  private showError(error: HttpErrorResponse, form: FormGroup): void {
    const fields = translateApiFieldErrors(extractApiFieldErrors(error), key =>
      this.translate.instant(key)
    );
    applyServerFieldErrors(form, fields);
    const code = extractApiErrorCodes(error)[0];
    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
      detail: code
        ? this.translate.instant(`ERRORS.${code}`)
        : this.translate.instant('CUSTOMER_ACTION.SAVE_ERROR'),
    });
  }

  private success(key: string): void {
    this.toast.add({
      severity: 'success',
      summary: this.translate.instant(`CUSTOMER_ACTION.${key}`),
    });
  }
}
