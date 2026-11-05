import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { CurrencyService } from '@core/services/currency.service';
import {
  DirectCustomerLedger,
  DirectCustomerLedgerService,
} from './direct-customer-ledger.service';

@Component({
  selector: 'app-direct-customer-ledger',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './direct-customer-ledger.component.html',
  styleUrl: './direct-customer-ledger.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectCustomerLedgerComponent {
  private readonly service = inject(DirectCustomerLedgerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  readonly currency = inject(CurrencyService);

  readonly ledger = signal<DirectCustomerLedger | null>(null);
  readonly page = signal(1);
  readonly loading = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service
      .list(this.page())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ledger => {
          this.ledger.set(ledger);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
            detail: this.translate.instant('CUSTOMER_LEDGER.LOAD_ERROR'),
          });
        },
      });
  }

  changePage(next: number): void {
    this.page.set(next);
    this.load();
  }
}
