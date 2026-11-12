import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { getLeadingIconPos } from '@app/shared/utils/rtl.util';
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
import { toDateKey } from '../bookings/models/booking.model';

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
    DecimalPipe,
    NgClass,
    FormsModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    InputTextModule,
    MenuModule,
    TableModule,
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
  private readonly languageService = inject(LanguageService);
  readonly currency = inject(CurrencyService);

  readonly canExport = computed(() => this.permissions.hasPermission(Policies.CustomersExport));
  readonly canRefund = computed(() => this.permissions.hasPermission(Policies.CustomersRefund));
  readonly canBlock = computed(() => this.permissions.hasPermission(Policies.CustomersBlock));
  readonly canHistory = computed(() => this.permissions.hasPermission(Policies.CustomersHistory));
  readonly result = signal<CustomerOperationsPage | null>(null);
  readonly rowsPerPageOptions = [5, 10, 25, 50, 100];
  readonly rows = signal(5);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(this.translate.instant('CUSTOMER_OPERATIONS.PAGE_REPORT'));
  readonly leadingIconPos = computed(() => getLeadingIconPos(this.languageService.currentLang()));
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly rangeError = signal(false);
  readonly selectedStatement = signal<CustomerOperation | null>(null);
  readonly selectedAction = signal<CustomerOperation | null>(null);
  readonly selectedHistory = signal<CustomerOperation | null>(null);
  readonly draftFromDate = signal<Date | null>(null);
  readonly draftToDate = signal<Date | null>(null);
  readonly serviceTypeOptions = [
    { label: 'CUSTOMER_OPERATIONS.TYPES.package', value: 'package' },
    { label: 'CUSTOMER_OPERATIONS.TYPES.session', value: 'session' },
  ];
  readonly statusOptions = [
    { label: 'CUSTOMER_OPERATIONS.PURCHASE_STATUSES.active', value: 'active' },
    { label: 'CUSTOMER_OPERATIONS.PURCHASE_STATUSES.completed', value: 'completed' },
    { label: 'CUSTOMER_OPERATIONS.PURCHASE_STATUSES.expired', value: 'expired' },
    { label: 'CUSTOMER_OPERATIONS.PURCHASE_STATUSES.cancelled', value: 'cancelled' },
    { label: 'CUSTOMER_OPERATIONS.PURCHASE_STATUSES.pending', value: 'pending' },
  ];
  readonly paymentTypeOptions = [
    { label: 'CUSTOMER_OPERATIONS.PAYMENT_TYPES.cash', value: 'cash' },
    { label: 'CUSTOMER_OPERATIONS.PAYMENT_TYPES.installment', value: 'installment' },
    { label: 'CUSTOMER_OPERATIONS.PAYMENT_TYPES.owned', value: 'owned' },
  ];
  draft = emptyFilters();
  private applied = emptyFilters();
  private requestId = 0;
  private readonly searchChanges = new Subject<void>();

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('CUSTOMER_OPERATIONS.PAGE_REPORT'));
    });
    this.searchChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
  }

  onServiceChange(value: string): void {
    this.draft.service = value;
    this.searchChanges.next();
  }

  onCustomerChange(value: string): void {
    this.draft.customer = value;
    this.searchChanges.next();
  }

  onMobileChange(value: string): void {
    this.draft.mobile = value;
    this.searchChanges.next();
  }

  onSelectFilterChange(): void {
    this.normalizeDraftFilters();
    this.applyFilters();
  }

  onDateFromChange(value: Date | null): void {
    const to = this.draftToDate();
    if (value && to && value > to) {
      this.draftToDate.set(value);
    }
    this.draftFromDate.set(value);
    this.applyDateFilter();
  }

  onDateToChange(value: Date | null): void {
    const from = this.draftFromDate();
    if (value && from && value < from) {
      this.draftFromDate.set(value);
    }
    this.draftToDate.set(value);
    this.applyDateFilter();
  }

  applyFilters(): void {
    this.syncDraftDates();
    const invalid = this.isDateRangeInvalid();
    this.rangeError.set(invalid);
    if (invalid) return;
    this.normalizeDraftFilters();
    this.applied = { ...this.draft };
    this.first.set(0);
    this.load();
  }

  clear(): void {
    this.draft = emptyFilters();
    this.draftFromDate.set(null);
    this.draftToDate.set(null);
    this.rangeError.set(false);
    this.applyFilters();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.first.set(first);
    this.rows.set(rows);
    this.load();
  }

  rowNumber(index: number): number {
    return this.first() + index + 1;
  }

  isRowBlocked(row: CustomerOperation): boolean {
    return row.customerRestriction === 'blocked';
  }

  serviceIcon(serviceType: string): string {
    return serviceType === 'package' ? 'pi pi-box' : 'pi pi-stopwatch';
  }

  serviceTypePillClass(serviceType: string): string {
    return serviceType === 'package' ? 'type-pill--package' : 'type-pill--session';
  }

  paymentTypePillClass(paymentType: string): string {
    switch (paymentType) {
      case 'cash':
        return 'type-pill--cash';
      case 'installment':
        return 'type-pill--installment';
      case 'owned':
        return 'type-pill--owned';
      default:
        return 'type-pill--neutral';
    }
  }

  sessionsLabel(row: CustomerOperation): string {
    if (row.unitsTotal == null) return '—';
    if (row.unitsRemaining == null) return String(row.unitsTotal);
    const used = Math.max(0, row.unitsTotal - row.unitsRemaining);
    return `${used}/${row.unitsTotal}`;
  }

  rowStatusKey(row: CustomerOperation): string {
    if (row.customerRestriction === 'blocked') {
      return 'CUSTOMER_OPERATIONS.RESTRICTIONS.blocked';
    }
    if (row.paymentStatus === 'unpaid' || row.paymentStatus === 'partial') {
      return `CUSTOMER_OPERATIONS.PAYMENT_STATUSES.${row.paymentStatus}`;
    }
    return `CUSTOMER_OPERATIONS.PURCHASE_STATUSES.${row.purchaseStatus}`;
  }

  statusPillClass(row: CustomerOperation): string {
    if (row.customerRestriction === 'blocked') {
      return 'status-pill--danger';
    }
    if (row.paymentStatus === 'unpaid' || row.paymentStatus === 'partial') {
      return 'status-pill--warning';
    }
    switch (row.purchaseStatus) {
      case 'active':
      case 'completed':
        return 'status-pill--success';
      case 'cancelled':
      case 'expired':
        return 'status-pill--danger';
      case 'pending':
        return 'status-pill--warning';
      default:
        return 'status-pill--neutral';
    }
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
        disabled: row.id.includes(':') && !this.canBlock(),
        command: () => this.selectedAction.set(row),
      },
      {
        label: this.translate.instant('CUSTOMER_OPERATIONS.AUDIT_HISTORY'),
        icon: 'pi pi-history',
        visible: this.canHistory(),
        command: () => this.selectedHistory.set(row),
      },
    ];
  }

  load(): void {
    const id = ++this.requestId;
    const pageSize = this.rows();
    this.loading.set(true);
    this.service
      .list(this.applied, Math.floor(this.first() / pageSize) + 1, pageSize)
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
    if (!this.canExport() || this.exporting() || !this.result()) return;
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

  formatOperationDate(value: string): string {
    const timezone = this.result()?.timezoneId;
    if (!timezone) return '—';
    return new Intl.DateTimeFormat(this.translate.currentLang() === 'ar' ? 'ar-EG' : 'en-GB', {
      dateStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value));
  }

  private applyDateFilter(): void {
    const invalid = this.isDateRangeInvalid();
    this.rangeError.set(invalid);
    if (invalid) return;
    this.applyFilters();
  }

  private normalizeDraftFilters(): void {
    this.draft.customer = this.draft.customer ?? '';
    this.draft.mobile = this.draft.mobile ?? '';
    this.draft.service = this.draft.service ?? '';
    this.draft.serviceType = this.draft.serviceType ?? '';
    this.draft.status = this.draft.status ?? '';
    this.draft.paymentType = this.draft.paymentType ?? '';
  }

  private syncDraftDates(): void {
    const from = this.draftFromDate();
    const to = this.draftToDate();
    this.draft.fromDate = from ? toDateKey(from) : '';
    this.draft.toDate = to ? toDateKey(to) : '';
  }

  private isDateRangeInvalid(): boolean {
    const from = this.draftFromDate();
    const to = this.draftToDate();
    return !!from && !!to && to < from;
  }

  private error(key: string, apiCode = false): void {
    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
      detail: this.translate.instant(`${apiCode ? 'ERRORS' : 'CUSTOMER_OPERATIONS'}.${key}`),
    });
  }
}
