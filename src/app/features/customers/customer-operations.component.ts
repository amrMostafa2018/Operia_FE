import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { CurrencyService } from '@core/services/currency.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { extractApiFieldErrors } from '@core/utils/api-error.util';
import {
  CustomerOperationsFilters,
  CustomerOperationsPage,
  CustomerOperationsService,
} from './customer-operations.service';

const emptyFilters = (): CustomerOperationsFilters => ({
  fromDate: '',
  toDate: '',
  customer: '',
  mobile: '',
  service: '',
  serviceType: '',
  status: '',
  paymentType: '',
});

@Component({
  selector: 'app-customer-operations',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './customer-operations.component.html',
  styleUrl: './customer-operations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOperationsComponent {
  private readonly service = inject(CustomerOperationsService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  readonly currency = inject(CurrencyService);

  readonly canExport = computed(() => this.permissions.hasPermission(Policies.CustomersExport));
  readonly result = signal<CustomerOperationsPage | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly rangeError = signal(false);
  draft = emptyFilters();
  private applied = emptyFilters();
  private requestId = 0;

  constructor() {
    this.load();
  }

  search(): void {
    const invalid =
      !!this.draft.fromDate && !!this.draft.toDate && this.draft.toDate < this.draft.fromDate;
    this.rangeError.set(invalid);
    if (invalid) return;
    this.applied = { ...this.draft };
    this.page.set(1);
    this.load();
  }

  clear(): void {
    this.draft = emptyFilters();
    this.rangeError.set(false);
    this.search();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.changePage(1);
  }

  load(): void {
    const id = ++this.requestId;
    this.loading.set(true);
    this.service
      .list(this.applied, this.page(), this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (id !== this.requestId) return;
          this.result.set(result);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (id !== this.requestId) return;
          this.loading.set(false);
          const fields = extractApiFieldErrors(error);
          if (Object.values(fields).includes('CustomerOperationDateRangeInvalid')) {
            this.rangeError.set(true);
          } else if (Object.values(fields).includes('CustomerOperationFilterInvalid')) {
            this.error('CustomerOperationFilterInvalid', true);
          } else {
            this.error('LOAD_ERROR');
          }
        },
      });
  }

  export(): void {
    if (!this.canExport() || this.exporting()) return;
    this.exporting.set(true);
    this.service
      .export(this.applied)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'customer-operations.xlsx';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.exporting.set(false);
        },
        error: () => {
          this.exporting.set(false);
          this.error('EXPORT_ERROR');
        },
      });
  }

  private error(key: string, apiCode = false): void {
    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
      detail: this.translate.instant(`${apiCode ? 'ERRORS' : 'CUSTOMER_OPERATIONS'}.${key}`),
    });
  }
}
