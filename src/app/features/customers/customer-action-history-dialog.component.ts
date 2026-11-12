import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand, reduce } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { CustomerOperation } from './customer-operations.service';
import {
  CustomerActionHistoryPage,
  CustomerActionHistoryRow,
  CustomerActionHistoryService,
} from './customer-action-history.service';

type HistoryTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

@Component({
  selector: 'app-customer-action-history-dialog',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, DialogModule],
  templateUrl: './customer-action-history-dialog.component.html',
  styleUrl: './customer-action-history-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActionHistoryDialogComponent {
  readonly row = input.required<CustomerOperation>();
  readonly closed = output<void>();
  private readonly service = inject(CustomerActionHistoryService);
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = inject(CurrencyService);
  readonly data = signal<CustomerActionHistoryPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  private requestId = 0;

  constructor() {
    queueMicrotask(() => this.load());
  }

  load(): void {
    const id = ++this.requestId;
    this.loading.set(true);
    this.failed.set(false);
    const row = this.row();
    const saleOnly = row.id.includes(':');
    const operationId = saleOnly ? row.saleId : row.id;

    this.service
      .get(row.customerId, operationId, saleOnly, null)
      .pipe(
        expand((page, index) =>
          page.nextCursor && index < 19
            ? this.service.get(row.customerId, operationId, saleOnly, page.nextCursor)
            : EMPTY
        ),
        reduce(
          (all, page) => ({
            total: page.total,
            nextCursor: null,
            items: [...all.items, ...page.items],
          }),
          { total: 0, nextCursor: null, items: [] as CustomerActionHistoryRow[] }
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: data => {
          if (id !== this.requestId) return;
          this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          if (id !== this.requestId) return;
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const locale = this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-GB';
    const day = date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const time = date.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return `${day} · ${time}`;
  }

  tone(action: string): HistoryTone {
    switch (action) {
      case 'SalePaymentConfirmed':
      case 'InstallmentCollected':
      case 'PackageInstallmentCollected':
      case 'CustomerUnblocked':
        return 'success';
      case 'PurchaseCancelled':
      case 'RefundPosted':
      case 'CustomerBlocked':
        return 'danger';
      case 'SaleCollectionAttempted':
      case 'CustomerBlockReasonChanged':
        return 'warning';
      case 'CustomerCreated':
      case 'SaleConfirmed':
      case 'PurchaseBranchAttributed':
        return 'info';
      default:
        return 'neutral';
    }
  }

  valueLabel(value: string | null): string {
    if (!value) return '—';
    const key = `CUSTOMER_HISTORY.VALUES.${value}`;
    const translated = this.translate.instant(key);
    return translated === key ? value : translated;
  }
}
