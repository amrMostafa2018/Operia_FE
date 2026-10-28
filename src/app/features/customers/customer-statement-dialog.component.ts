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
import { CustomerStatement, CustomerStatementService } from './customer-statement.service';

@Component({
  selector: 'app-customer-statement-dialog',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, DialogModule],
  templateUrl: './customer-statement-dialog.component.html',
  styleUrl: './customer-statement-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerStatementDialogComponent {
  readonly row = input.required<CustomerOperation>();
  readonly closed = output<void>();
  private readonly service = inject(CustomerStatementService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = inject(CurrencyService);
  readonly statement = signal<CustomerStatement | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  constructor() {
    // The dialog is recreated for each selected row, so no previous customer's data survives.
    queueMicrotask(() => this.load());
  }

  close(): void {
    this.closed.emit();
  }

  time(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  private load(): void {
    const row = this.row();
    this.service
      .get(row.customerId, row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: statement => {
          this.statement.set(statement);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
