import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { MenuModule } from 'primeng/menu';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Policies } from '@core/models/permissions.model';
import { extractApiFieldErrors } from '@core/utils/api-error.util';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { getLeadingIconPos } from '@app/shared/utils/rtl.util';
import { paymentTypePillClass } from '@app/shared/utils/status-tag.util';
import { toDateKey } from '../bookings/models/booking.model';
import { ActivityRevenueService } from './activity-revenue.service';
import {
  RevenueBranch,
  RevenuePaymentHistory,
  RevenueReport,
  RevenueReportFilters,
  RevenueService,
  RevenueTransaction,
} from './models/installment-revenue.model';

@Component({
  selector: 'app-activity-revenue',
  standalone: true,
  imports: [
    ButtonModule,
    CalendarModule,
    DropdownModule,
    FormsModule,
    MenuModule,
    TableModule,
    TranslatePipe,
  ],
  templateUrl: './activity-revenue.component.html',
  styleUrl: './activity-revenue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityRevenueComponent implements OnInit {
  private readonly service = inject(ActivityRevenueService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = inject(CurrencyService);

  readonly report = signal<RevenueReport | null>(null);
  readonly branches = signal<RevenueBranch[]>([]);
  readonly services = signal<RevenueService[]>([]);
  readonly dateFrom = signal<Date | null>(null);
  readonly dateTo = signal<Date | null>(null);
  readonly branchId = signal<string | null>(null);
  readonly serviceId = signal<string | null>(null);
  readonly branchOptions = computed(() =>
    this.branches().map(branch => ({ label: branch.name, value: branch.id }))
  );
  readonly serviceOptions = computed(() =>
    this.services().map(service => ({ label: service.name, value: service.id }))
  );
  readonly rowsPerPageOptions = [5, 10, 25, 50, 100];
  readonly rows = signal(5);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(this.translate.instant('ACTIVITY_REVENUE.PAGE_REPORT'));
  readonly leadingIconPos = computed(() => getLeadingIconPos(this.language.currentLang()));
  readonly paymentPillClass = paymentTypePillClass;
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal(false);
  readonly rangeError = signal(false);
  readonly serviceError = signal(false);
  readonly action = signal<{ paymentId: string; confirm: boolean } | null>(null);
  readonly acting = signal(false);
  readonly history = signal<RevenuePaymentHistory[] | null>(null);
  readonly proofUrl = signal<string | null>(null);
  private applied: RevenueReportFilters = {
    fromDate: null,
    toDate: null,
    branchId: null,
    serviceId: null,
  };
  private requestVersion = 0;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.closeProof());
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('ACTIVITY_REVENUE.PAGE_REPORT'));
    });
    forkJoin({ branches: this.service.branches(), services: this.service.services() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.branches.set(result.branches);
          this.services.set(result.services);
        },
        error: () => this.notify('LOAD_ERROR'),
      });
  }

  canReview(): boolean {
    return this.permissions.hasPermission(Policies.RevenueReview);
  }

  canExport(): boolean {
    return this.permissions.hasPermission(Policies.RevenueExport);
  }

  onDateFromChange(date: Date | null): void {
    this.dateFrom.set(date);
    this.applyFilters();
  }

  onDateToChange(date: Date | null): void {
    this.dateTo.set(date);
    this.applyFilters();
  }

  onBranchChange(branchId: string | null): void {
    this.branchId.set(branchId);
    this.applyFilters();
  }

  onServiceChange(serviceId: string | null): void {
    this.serviceId.set(serviceId);
    this.applyFilters();
  }

  clearFilters(): void {
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.branchId.set(null);
    this.serviceId.set(null);
    this.rangeError.set(false);
    this.serviceError.set(false);
    this.applied = { fromDate: null, toDate: null, branchId: null, serviceId: null };
    this.first.set(0);
    this.load();
  }

  private applyFilters(): void {
    const from = this.dateFrom();
    const to = this.dateTo();
    const invalid = !!from && !!to && toDateKey(from) > toDateKey(to);
    this.rangeError.set(invalid);
    this.serviceError.set(false);
    if (invalid) return;
    this.applied = {
      fromDate: from ? toDateKey(from) : null,
      toDate: to ? toDateKey(to) : null,
      branchId: this.branchId() || null,
      serviceId: this.serviceId() || null,
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
    const version = ++this.requestVersion;
    const pageSize = this.rows();
    const page = Math.floor(this.first() / pageSize) + 1;
    this.loading.set(true);
    this.error.set(false);
    this.service
      .report(this.applied, page, pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (version !== this.requestVersion) return;
          this.report.set(result);
          if (!this.applied.fromDate && result.fromDate) {
            this.applied = { ...this.applied, fromDate: result.fromDate };
            if (!this.dateFrom()) this.dateFrom.set(parseDateKey(result.fromDate));
          }
          if (!this.applied.toDate && result.toDate) {
            this.applied = { ...this.applied, toDate: result.toDate };
            if (!this.dateTo()) this.dateTo.set(parseDateKey(result.toDate));
          }
          this.loading.set(false);
        },
        error: (failure: HttpErrorResponse) => {
          if (version !== this.requestVersion) return;
          this.loading.set(false);
          this.error.set(true);
          const fields = Object.values(extractApiFieldErrors(failure));
          if (fields.includes('RevenueDateRangeInvalid')) this.rangeError.set(true);
          if (fields.includes('RevenueServiceInvalid')) this.serviceError.set(true);
          this.notify('LOAD_ERROR');
        },
      });
  }

  export(): void {
    if (!this.canExport() || this.exporting() || !this.report()) return;
    this.exporting.set(true);
    this.service
      .exportReport(this.applied)
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

  chooseAction(paymentId: string, confirm: boolean): void {
    if (this.canReview()) this.action.set({ paymentId, confirm });
  }

  applyAction(): void {
    const selected = this.action();
    if (!selected || this.acting()) return;
    this.acting.set(true);
    this.service
      .review(selected.paymentId, selected.confirm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.action.set(null);
          this.acting.set(false);
          this.load();
        },
        error: () => {
          this.acting.set(false);
          this.action.set(null);
          this.notify('ACTION_ERROR');
        },
      });
  }

  showProof(paymentId: string): void {
    this.closeProof();
    this.service
      .proof(paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => this.proofUrl.set(URL.createObjectURL(blob)),
        error: () => this.notify('PROOF_ERROR'),
      });
  }

  closeProof(): void {
    const url = this.proofUrl();
    if (url) URL.revokeObjectURL(url);
    this.proofUrl.set(null);
  }

  showHistory(paymentId: string | null): void {
    if (!paymentId) return;
    this.history.set(null);
    this.service
      .history(paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rows => this.history.set(rows),
        error: () => this.notify('HISTORY_ERROR'),
      });
  }

  rowNumber(index: number): number {
    return this.first() + index + 1;
  }

  statusPillClass(row: RevenueTransaction): string {
    if (
      row.kind === 'Refund' ||
      row.status === 'Refunded' ||
      row.status === 'Failed' ||
      row.status === 'Cancelled'
    ) {
      return 'status-pill--danger';
    }
    if (row.status === 'UnderReview') {
      return 'status-pill--warning';
    }
    if (row.status === 'Paid') return 'status-pill--success';
    return 'status-pill--neutral';
  }

  getRowMenu(row: RevenueTransaction): MenuItem[] {
    return [
      {
        label: this.translate.instant('ACTIVITY_REVENUE.VIEW_PROOF'),
        icon: 'pi pi-image',
        visible: row.hasProof && !!row.paymentId,
        command: () => {
          if (row.paymentId) this.showProof(row.paymentId);
        },
      },
      {
        label: this.translate.instant('ACTIVITY_REVENUE.CONFIRM_PAYMENT'),
        icon: 'pi pi-check',
        visible: this.canAct(row),
        command: () => {
          if (row.paymentId) this.chooseAction(row.paymentId, true);
        },
      },
      {
        label: this.translate.instant('ACTIVITY_REVENUE.CANCEL_PAYMENT'),
        icon: 'pi pi-times',
        visible: this.canAct(row),
        command: () => {
          if (row.paymentId) this.chooseAction(row.paymentId, false);
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

  canAct(row: RevenueTransaction): boolean {
    return row.status === 'UnderReview' && !!row.paymentId && this.canReview();
  }

  formatMoney(amount: number): string {
    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(amount);
    const label = this.currency.currencyLabel();
    return label ? `${formatted} ${label}` : formatted;
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(amount);
  }

  showChangePercent(value: number | null | undefined): boolean {
    return value != null;
  }

  formatChange(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${Math.abs(Math.round(value))}%`;
  }

  trendDirection(value: number | null | undefined): 'up' | 'down' | 'flat' {
    if (value == null || value === 0) {
      return 'flat';
    }

    return value > 0 ? 'up' : 'down';
  }

  formatDate(value: string): string {
    return this.formatZoned(value, { dateStyle: 'short', timeStyle: 'short' });
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

  private notify(key: string): void {
    this.toast.add({
      severity: 'error',
      summary: 'OPERIA',
      detail: this.translate.instant(`ACTIVITY_REVENUE.${key}`),
    });
  }
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
