import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Policies } from '@core/models/permissions.model';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { getLeadingIconPos } from '@app/shared/utils/rtl.util';
import { paymentTypePillClass } from '@app/shared/utils/status-tag.util';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { toDateKey } from '../bookings/models/booking.model';
import { EmployeeService } from '../employees/employee.service';
import { ActivityRevenueService } from '../activity-revenue/activity-revenue.service';
import {
  RevenuePaymentHistory,
  RevenueReport,
  RevenueReportFilters,
  RevenueTransaction,
} from '../activity-revenue/models/installment-revenue.model';

interface RevenueTableFilters {
  status: string | null;
  employeeId: string | null;
  mobile: string;
  customerName: string;
}

@Component({
  selector: 'app-dashboard-revenue-table',
  standalone: true,
  imports: [
    ButtonModule,
    ConfirmActionDialogComponent,
    DialogModule,
    DropdownModule,
    FormsModule,
    InputTextModule,
    MenuModule,
    TableModule,
    TranslatePipe,
  ],
  templateUrl: './dashboard-revenue-table.component.html',
  styleUrl: './dashboard-revenue-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardRevenueTableComponent {
  private readonly revenue = inject(ActivityRevenueService);
  private readonly employeesApi = inject(EmployeeService);
  private readonly permissions = inject(PermissionService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = inject(CurrencyService);

  readonly dateFrom = input<Date | null>(null);
  readonly dateTo = input<Date | null>(null);

  readonly report = signal<RevenueReport | null>(null);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal(false);
  readonly rows = signal(5);
  readonly first = signal(0);
  readonly mobileSearch = signal('');
  readonly nameSearch = signal('');
  readonly selectedEmployee = signal<string | null>(null);
  readonly selectedStatus = signal<string | null>(null);
  readonly showEmployeeFilter = signal(false);
  readonly employees = signal<{ label: string; value: string | null }[]>([
    { label: 'DASHBOARD.ALL_EMPLOYEES', value: null },
  ]);
  readonly pendingAction = signal<{ paymentId: string; confirm: boolean } | null>(null);
  readonly acting = signal(false);
  readonly historyOpen = signal(false);
  readonly historyLoading = signal(false);
  readonly history = signal<RevenuePaymentHistory[]>([]);
  readonly proofUrl = signal<string | null>(null);
  readonly thumbs = signal<Record<string, string>>({});
  readonly pageReportTemplate = signal(this.translate.instant('ACTIVITY_REVENUE.PAGE_REPORT'));
  readonly rowsPerPageOptions = [5, 10, 25, 50, 100];
  readonly statusOptions = [
    { label: 'DASHBOARD.ALL_STATUS', value: null },
    { label: 'ACTIVITY_REVENUE.STATES.Paid', value: 'Paid' },
    { label: 'ACTIVITY_REVENUE.STATES.UnderReview', value: 'UnderReview' },
    { label: 'ACTIVITY_REVENUE.STATES.Failed', value: 'Failed' },
    { label: 'ACTIVITY_REVENUE.STATES.Cancelled', value: 'Cancelled' },
    { label: 'ACTIVITY_REVENUE.STATES.Refunded', value: 'Refunded' },
  ];

  readonly leadingIconPos = computed(() => getLeadingIconPos(this.language.currentLang()));
  readonly actionHeaderKey = computed(() =>
    this.pendingAction()?.confirm === false
      ? 'ACTIVITY_REVENUE.CANCEL_PAYMENT'
      : 'ACTIVITY_REVENUE.CONFIRM_PAYMENT'
  );
  readonly rangeLabel = computed(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    if (from && to && toDateKey(from) === toDateKey(to)) {
      return this.formatDay(from);
    }
    if (from && to) {
      return `${this.formatDay(from)} - ${this.formatDay(to)}`;
    }
    return this.formatDay(from ?? to ?? new Date());
  });

  private readonly thumbUrls = new Map<string, string>();
  private applied: RevenueTableFilters = {
    status: null,
    employeeId: null,
    mobile: '',
    customerName: '',
  };
  private requestVersion = 0;
  private proofObjectUrl: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.releaseProofs());
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('ACTIVITY_REVENUE.PAGE_REPORT'));
    });
    this.loadEmployees();
    effect(() => {
      this.dateFrom();
      this.dateTo();
      untracked(() => {
        this.first.set(0);
        this.load();
      });
    });
  }

  canExport(): boolean {
    return this.permissions.hasPermission(Policies.RevenueExport);
  }

  canReview(): boolean {
    return this.permissions.hasPermission(Policies.RevenueReview);
  }

  applyFilters(): void {
    this.applied = {
      status: this.selectedStatus(),
      employeeId: this.selectedEmployee(),
      mobile: this.mobileSearch().trim(),
      customerName: this.nameSearch().trim(),
    };
    this.first.set(0);
    this.load();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.first.set(event.first ?? 0);
    this.rows.set(event.rows ?? this.rows());
    this.load();
  }

  load(): void {
    const from = this.dateFrom();
    const to = this.dateTo();
    if (from && to && toDateKey(from) > toDateKey(to)) {
      return;
    }

    const version = ++this.requestVersion;
    const pageSize = this.rows();
    const page = Math.floor(this.first() / pageSize) + 1;
    this.loading.set(true);
    this.error.set(false);
    this.revenue
      .report(this.reportFilters(), page, pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (version !== this.requestVersion) {
            return;
          }
          this.report.set(result);
          this.loading.set(false);
          this.loadThumbs(result.items);
        },
        error: () => {
          if (version !== this.requestVersion) {
            return;
          }
          this.loading.set(false);
          this.error.set(true);
          this.notify('LOAD_ERROR');
        },
      });
  }

  exportReport(): void {
    if (!this.canExport() || this.exporting()) {
      return;
    }
    this.exporting.set(true);
    this.revenue
      .exportReport(this.reportFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'activity-revenue.xlsx';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.exporting.set(false);
        },
        error: () => {
          this.exporting.set(false);
          this.notify('EXPORT_ERROR');
        },
      });
  }

  rowNumber(index: number): number {
    return this.first() + index + 1;
  }

  formatMoney(amount: number): string {
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount);
    const label = this.currency.currencyLabel();
    return label ? `${formatted} ${label}` : formatted;
  }

  formatWhen(value: string): string {
    return this.formatZoned(value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatHistoryDate(value: string): string {
    return this.formatZoned(value, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatHistoryTime(value: string): string {
    return this.formatZoned(value, { hour: 'numeric', minute: '2-digit' });
  }

  actorInitial(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      return '';
    }

    return Array.from(trimmed)[0].toLocaleUpperCase(this.language.currentLang());
  }

  historyStatusClass(status: string): string {
    if (status === 'Refunded' || status === 'Failed' || status === 'Cancelled') {
      return 'status-pill--danger';
    }
    if (status === 'UnderReview' || status === 'Pending') {
      return 'status-pill--warning';
    }
    if (status === 'Paid') {
      return 'status-pill--success';
    }
    return 'status-pill--neutral';
  }

  historyEventClass(action: string): string {
    switch (action) {
      case 'InstallmentCollected':
      case 'PackageInstallmentCollected':
      case 'SalePaymentConfirmed':
      case 'RevenuePaymentConfirmed':
        return 'history-event--success';
      case 'RevenuePaymentCancelled':
      case 'RefundPosted':
        return 'history-event--danger';
      case 'SaleCollectionAttempted':
        return 'history-event--warning';
      default:
        return 'history-event--neutral';
    }
  }

  methodLabel(method: string): string {
    if (!method) {
      return '—';
    }
    const key = `CUSTOMER_INQUIRY.METHOD.${method.toUpperCase()}`;
    const label = this.translate.instant(key);
    return label === key ? method : label;
  }

  methodClass(method: string): string {
    return paymentTypePillClass(method);
  }

  statusClass(row: RevenueTransaction): string {
    if (
      row.kind === 'Refund' ||
      row.status === 'Refunded' ||
      row.status === 'Failed' ||
      row.status === 'Cancelled'
    ) {
      return 'status-pill status-pill--danger';
    }
    if (row.status === 'UnderReview') {
      return 'status-pill status-pill--warning';
    }
    if (row.status === 'Paid') {
      return 'status-pill status-pill--success';
    }
    return 'status-pill status-pill--neutral';
  }

  getRowMenu(row: RevenueTransaction): MenuItem[] {
    return [
      {
        label: this.translate.instant('ACTIVITY_REVENUE.VIEW_PROOF'),
        icon: 'pi pi-image',
        visible: row.hasProof && !!row.paymentId,
        command: () => {
          if (row.paymentId) {
            this.showProof(row.paymentId);
          }
        },
      },
      {
        label: this.translate.instant('ACTIVITY_REVENUE.CONFIRM_PAYMENT'),
        icon: 'pi pi-check',
        visible: this.canAct(row),
        command: () => {
          if (row.paymentId) {
            this.pendingAction.set({ paymentId: row.paymentId, confirm: true });
          }
        },
      },
      {
        label: this.translate.instant('ACTIVITY_REVENUE.CANCEL_PAYMENT'),
        icon: 'pi pi-times',
        visible: this.canAct(row),
        command: () => {
          if (row.paymentId) {
            this.pendingAction.set({ paymentId: row.paymentId, confirm: false });
          }
        },
      },
      {
        label: this.translate.instant('ACTIVITY_REVENUE.HISTORY'),
        icon: 'pi pi-history',
        visible: !!(row.paymentId || row.refundId),
        command: () => this.showHistory(row.paymentId || row.refundId),
      },
    ];
  }

  showProof(paymentId: string): void {
    const thumb = this.thumbUrls.get(paymentId);
    if (thumb) {
      this.proofUrl.set(thumb);
      return;
    }
    this.revenue
      .proof(paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.revokeDialogProof();
          this.proofObjectUrl = URL.createObjectURL(blob);
          this.proofUrl.set(this.proofObjectUrl);
        },
        error: () => this.notify('PROOF_ERROR'),
      });
  }

  onProofVisible(visible: boolean): void {
    if (!visible) {
      this.closeProof();
    }
  }

  closeProof(): void {
    this.revokeDialogProof();
    this.proofUrl.set(null);
  }

  showHistory(paymentId: string | null): void {
    if (!paymentId) {
      return;
    }
    this.historyOpen.set(true);
    this.historyLoading.set(true);
    this.history.set([]);
    this.revenue
      .history(paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rows => {
          this.history.set(rows);
          this.historyLoading.set(false);
        },
        error: () => {
          this.historyLoading.set(false);
          this.historyOpen.set(false);
          this.notify('HISTORY_ERROR');
        },
      });
  }

  onHistoryVisible(visible: boolean): void {
    if (!visible) {
      this.historyOpen.set(false);
    }
  }

  applyAction(): void {
    const selected = this.pendingAction();
    if (!selected || this.acting()) {
      return;
    }
    this.acting.set(true);
    this.revenue
      .review(selected.paymentId, selected.confirm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingAction.set(null);
          this.acting.set(false);
          this.load();
        },
        error: () => {
          this.acting.set(false);
          this.pendingAction.set(null);
          this.notify('ACTION_ERROR');
        },
      });
  }

  cancelAction(): void {
    if (!this.acting()) {
      this.pendingAction.set(null);
    }
  }

  private canAct(row: RevenueTransaction): boolean {
    return row.status === 'UnderReview' && !!row.paymentId && this.canReview();
  }

  private loadEmployees(): void {
    if (!this.permissions.hasPermission(Policies.EmployeesRead)) {
      return;
    }
    this.employeesApi
      .list({ pageNumber: 1, pageSize: 50, isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.employees.set([
            { label: 'DASHBOARD.ALL_EMPLOYEES', value: null },
            ...result.items.map(employee => ({ label: employee.fullName, value: employee.id })),
          ]);
          this.showEmployeeFilter.set(true);
        },
      });
  }

  private reportFilters(): RevenueReportFilters {
    const from = this.dateFrom();
    const to = this.dateTo();
    return {
      fromDate: from ? toDateKey(from) : null,
      toDate: to ? toDateKey(to) : null,
      branchId: null,
      serviceId: null,
      status: this.applied.status,
      mobile: this.applied.mobile || null,
      customerName: this.applied.customerName || null,
      employeeId: this.applied.employeeId,
    };
  }

  private loadThumbs(items: RevenueTransaction[]): void {
    const visible = new Set(
      items.filter(row => row.hasProof && row.paymentId).map(row => row.paymentId as string)
    );
    for (const [paymentId, url] of this.thumbUrls) {
      if (!visible.has(paymentId)) {
        if (this.proofUrl() === url) {
          this.proofUrl.set(null);
        }
        URL.revokeObjectURL(url);
        this.thumbUrls.delete(paymentId);
      }
    }
    this.thumbs.set(Object.fromEntries(this.thumbUrls));
    for (const paymentId of visible) {
      if (this.thumbUrls.has(paymentId)) {
        continue;
      }
      this.revenue
        .proof(paymentId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: blob => {
            if (!blob.type.startsWith('image/')) {
              return;
            }
            const current = this.report()?.items ?? [];
            const stillVisible = current.some(row => row.paymentId === paymentId && row.hasProof);
            if (!stillVisible || this.thumbUrls.has(paymentId)) {
              return;
            }
            this.thumbUrls.set(paymentId, URL.createObjectURL(blob));
            this.thumbs.set(Object.fromEntries(this.thumbUrls));
          },
        });
    }
  }

  private formatZoned(value: string, options: Intl.DateTimeFormatOptions): string {
    const locale = this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-GB';
    const timezone = this.report()?.timezoneId || 'UTC';
    const instant = new Date(value);
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(instant);
    } catch {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(instant);
    }
  }

  private formatDay(date: Date): string {
    const locale = this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-GB';
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  private revokeDialogProof(): void {
    if (this.proofObjectUrl) {
      URL.revokeObjectURL(this.proofObjectUrl);
      this.proofObjectUrl = null;
    }
  }

  private releaseProofs(): void {
    this.revokeDialogProof();
    for (const url of this.thumbUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.thumbUrls.clear();
  }

  private notify(key: string): void {
    this.toast.add({
      severity: 'error',
      summary: 'OPERIA',
      detail: this.translate.instant(`ACTIVITY_REVENUE.${key}`),
    });
  }
}
