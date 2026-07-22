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
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs';

import { FinanceService } from '@core/services/finance.service';
import { LanguageService } from '@core/services/language.service';
import { OnboardingService } from '@core/services/onboarding.service';
import { getLeadingIconPos } from '@app/shared/utils/rtl.util';
import {
  BillingPeriod,
  SUBSCRIPTION_STATUS_OPTIONS,
  SubscriptionFilters,
  SubscriptionRow,
  SubscriptionStatus,
} from './models/operia-subscriptions.model';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

interface PlanFilterOption {
  labelKey?: string;
  label?: string;
  value: string | null;
}

@Component({
  selector: 'app-operia-subscriptions',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslatePipe,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    DropdownModule,
    CalendarModule,
  ],
  templateUrl: './operia-subscriptions.component.html',
  styleUrl: './operia-subscriptions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperiaSubscriptionsComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly leadingIconPos = computed(() =>
    getLeadingIconPos(this.languageService.currentLang()),
  );

  readonly subscriptions = signal<SubscriptionRow[]>([]);
  readonly loading = signal(false);
  readonly exportLoading = signal(false);
  readonly totalRecords = signal(0);

  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);
  selectedPlan = signal<string | null>(null);
  selectedStatus = signal<SubscriptionStatus | null>(null);
  rows = signal(10);
  first = signal(0);

  readonly statusOptions = SUBSCRIPTION_STATUS_OPTIONS;
  private readonly availablePlans = signal<{ name: string; code: string }[]>([]);
  readonly planOptions = computed<PlanFilterOption[]>(() => [
    { labelKey: 'OPERIA_SUBSCRIPTIONS.ALL_PLANS', value: null },
    ...this.availablePlans().map(plan => ({
      label: plan.name,
      value: plan.code,
    })),
  ]);
  readonly rowsPerPageOptions = [10, 20, 50];
  readonly pageReportTemplate = signal(
    this.translate.instant('OPERIA_SUBSCRIPTIONS.PAGE_REPORT'),
  );

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageReportTemplate.set(
          this.translate.instant('OPERIA_SUBSCRIPTIONS.PAGE_REPORT'),
        );
      });

    this.loadPlanOptions();
  }

  statusSeverity(status: SubscriptionStatus): TagSeverity {
    const map: Record<SubscriptionStatus, TagSeverity> = {
      active: 'success',
      expired: 'secondary',
      cancelled: 'danger',
      pending: 'warning',
    };
    return map[status];
  }

  statusKey(status: SubscriptionStatus): string {
    const map: Record<SubscriptionStatus, string> = {
      active: 'OPERIA_SUBSCRIPTIONS.STATUS.ACTIVE',
      expired: 'OPERIA_SUBSCRIPTIONS.STATUS.EXPIRED',
      cancelled: 'OPERIA_SUBSCRIPTIONS.STATUS.CANCELLED',
      pending: 'OPERIA_SUBSCRIPTIONS.STATUS.PENDING',
    };
    return map[status];
  }

  billingPeriodKey(period: BillingPeriod): string {
    return period === 'yearly'
      ? 'OPERIA_SUBSCRIPTIONS.BILLING.YEARLY'
      : 'OPERIA_SUBSCRIPTIONS.BILLING.MONTHLY';
  }

  currencyKey(currency: string): string {
    return `OPERIA_SUBSCRIPTIONS.CURRENCIES.${currency}`;
  }

  rowNumber(index: number): number {
    return this.first() + index + 1;
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();

    this.first.set(first);
    this.rows.set(rows);
    this.loadSubscriptions();
  }

  onSearch(): void {
    this.first.set(0);
    this.loadSubscriptions();
  }

  exportReport(): void {
    this.exportLoading.set(true);
    this.financeService
      .exportSubscriptions(this.currentFilters())
      .pipe(
        finalize(() => this.exportLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(blob => this.downloadBlob(blob, 'operia-subscriptions.xlsx'));
  }

  private loadPlanOptions(): void {
    this.onboardingService
      .getPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(plans => {
        this.availablePlans.set(
          plans.map(plan => ({
            name: plan.name,
            code: plan.code,
          })),
        );
      });
  }

  private loadSubscriptions(): void {
    const pageNumber = Math.floor(this.first() / this.rows()) + 1;

    this.loading.set(true);
    this.financeService
      .getSubscriptions(this.currentFilters(), pageNumber, this.rows())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        this.subscriptions.set(result.items);
        this.totalRecords.set(result.totalCount);
      });
  }

  private currentFilters(): SubscriptionFilters {
    return {
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      planCode: this.selectedPlan(),
      status: this.selectedStatus(),
    };
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
}
