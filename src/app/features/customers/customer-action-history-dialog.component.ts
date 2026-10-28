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
import { TranslatePipe } from '@ngx-translate/core';
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
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = inject(CurrencyService);
  readonly data = signal<CustomerActionHistoryPage | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  constructor() {
    queueMicrotask(() => this.load(1));
  }

  load(page: number): void {
    this.loading.set(true);
    this.failed.set(false);
    const row = this.row();
    this.service
      .get(row.customerId, row.id, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
