import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { CurrencyService } from '@core/services/currency.service';
import { CustomerOperation } from './customer-operations.service';
import {
  CustomerActionHistoryPage,
  CustomerActionHistoryService,
} from './customer-action-history.service';

@Component({
  selector: 'app-customer-action-history-dialog',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, DialogModule],
  templateUrl: './customer-action-history-dialog.component.html',
  styleUrl: './customer-action-history-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActionHistoryDialogComponent {
  readonly row = input.required<CustomerOperation>();
  readonly closed = output<void>();
  private readonly service = inject(CustomerActionHistoryService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = inject(CurrencyService);
  readonly data = signal<CustomerActionHistoryPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly page = signal(1);
  readonly cursors = signal<(string | null)[]>([null]);
  private requestId = 0;

  constructor() {
    queueMicrotask(() => this.load(1));
  }

  load(page: number): void {
    if (page < 1 || page > this.cursors().length) return;
    const id = ++this.requestId;
    this.loading.set(true);
    this.failed.set(false);
    const row = this.row();
    this.service
      .get(
        row.customerId,
        row.id.includes(':') ? row.saleId : row.id,
        row.id.includes(':'),
        this.cursors()[page - 1]
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          if (id !== this.requestId) return;
          this.data.set(data);
          this.page.set(page);
          if (data.nextCursor) {
            this.cursors.update(cursors => [...cursors.slice(0, page), data.nextCursor]);
          }
          this.loading.set(false);
        },
        error: () => {
          if (id !== this.requestId) return;
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  valueLabel(value: string | null): string {
    if (!value) return '—';
    const key = `CUSTOMER_HISTORY.VALUES.${value}`;
    const translated = this.translate.instant(key);
    return translated === key ? value : translated;
  }
}
