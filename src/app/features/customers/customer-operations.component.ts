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
import { MenuItem, MessageService } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { CurrencyService } from '@core/services/currency.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { extractApiFieldErrors } from '@core/utils/api-error.util';
import {
  CustomerOperationsFilters,
  CustomerOperation,
  CustomerOperationsPage,
  CustomerOperationsService,
} from './customer-operations.service';
import { CustomerStatementDialogComponent } from './customer-statement-dialog.component';
import { CustomerActionDialogComponent } from './customer-action-dialog.component';
import { CustomerActionHistoryDialogComponent } from './customer-action-history-dialog.component';

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
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MenuModule,
    TranslatePipe,
    CustomerStatementDialogComponent,
    CustomerActionDialogComponent,
    CustomerActionHistoryDialogComponent,
  ],
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
  readonly canRefund = computed(() => this.permissions.hasPermission(Policies.CustomersRefund));
  readonly canBlock = computed(() => this.permissions.hasPermission(Policies.CustomersBlock));
  readonly canHistory = computed(() => this.permissions.hasPermission(Policies.CustomersHistory));
  readonly result = signal<CustomerOperationsPage | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly rangeError = signal(false);
  readonly selectedStatement = signal<CustomerOperation | null>(null);
  readonly selectedAction = signal<CustomerOperation | null>(null);
  readonly selectedHistory = signal<CustomerOperation | null>(null);
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

  openStatement(row: CustomerOperation): void {
    this.selectedStatement.set(row);
  }

  getRowMenu(row: CustomerOperation): MenuItem[] {
    return [
      {
        label: this.translate.instant('CUSTOMER_STATEMENT.TITLE'),
        icon: 'pi pi-list',
        disabled: row.id.includes(':'),
        command: () => this.openStatement(row),
      },
      {
        label: this.translate.instant('CUSTOMER_OPERATIONS.EDIT_STATUS'),
        icon: 'pi pi-pencil',
        visible: this.canRefund() || this.canBlock(),
        disabled: row.id.includes(':'),
        command: () => this.selectedAction.set(row),
      },
      {
        label: this.translate.instant('CUSTOMER_OPERATIONS.AUDIT_HISTORY'),
        icon: 'pi pi-history',
        visible: this.canHistory(),
        disabled: row.id.includes(':'),
        command: () => this.selectedHistory.set(row),
      },
    ];
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
