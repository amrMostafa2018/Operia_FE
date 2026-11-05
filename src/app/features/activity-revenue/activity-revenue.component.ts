import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Policies } from '@core/models/permissions.model';
import { extractApiFieldErrors } from '@core/utils/api-error.util';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
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
  imports: [TranslatePipe],
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

  readonly report = signal<RevenueReport | null>(null);
  readonly branches = signal<RevenueBranch[]>([]);
  readonly services = signal<RevenueService[]>([]);
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly branchId = signal('');
  readonly serviceId = signal('');
  readonly pageSize = signal(10);
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
    forkJoin({ branches: this.service.branches(), services: this.service.services() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.branches.set(result.branches);
          this.services.set(result.services);
        },
        error: () => this.notify('LOAD_ERROR'),
      });
    this.load(1);
  }

  canReview(): boolean {
    return this.permissions.hasPermission(Policies.RevenueReview);
  }

  canExport(): boolean {
    return this.permissions.hasPermission(Policies.RevenueExport);
  }

  search(): void {
    this.serviceError.set(false);
    this.rangeError.set(!!this.fromDate() && !!this.toDate() && this.fromDate() > this.toDate());
    if (this.rangeError()) return;
    this.applied = {
      fromDate: this.fromDate() || null,
      toDate: this.toDate() || null,
      branchId: this.branchId() || null,
      serviceId: this.serviceId() || null,
    };
    this.load(1);
  }

  reset(): void {
    this.fromDate.set('');
    this.toDate.set('');
    this.branchId.set('');
    this.serviceId.set('');
    this.pageSize.set(10);
    this.rangeError.set(false);
    this.serviceError.set(false);
    this.applied = { fromDate: null, toDate: null, branchId: null, serviceId: null };
    this.load(1);
  }

  load(page: number): void {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.error.set(false);
    this.report.set(null);
    this.service
      .report(this.applied, page, this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (version !== this.requestVersion) return;
          this.report.set(result);
          if (!this.applied.fromDate) {
            this.applied = { ...this.applied, fromDate: result.fromDate };
            this.fromDate.set(result.fromDate);
          }
          if (!this.applied.toDate) {
            this.applied = { ...this.applied, toDate: result.toDate };
            this.toDate.set(result.toDate);
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

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.load(1);
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
          this.load(this.report()?.page ?? 1);
        },
        error: () => {
          this.acting.set(false);
          this.action.set(null);
          this.report.set(null);
          this.error.set(true);
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
    const result = this.report();
    return result ? (result.page - 1) * result.pageSize + index + 1 : index + 1;
  }

  pageCount(): number {
    const result = this.report();
    return result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  }

  canAct(row: RevenueTransaction): boolean {
    return row.status === 'UnderReview' && !!row.paymentId && this.canReview();
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat(this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
    }).format(amount);
  }

  formatDate(value: string): string {
    const locale = this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-GB';
    const timezone = this.report()?.timezoneId;
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: timezone || 'UTC',
      }).format(new Date(value));
    } catch {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(value));
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
