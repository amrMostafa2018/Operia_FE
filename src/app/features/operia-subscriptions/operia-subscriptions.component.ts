import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button, ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs';

import { FinanceService } from '@core/services/finance.service';
import { LanguageService } from '@core/services/language.service';
import { OnboardingService } from '@core/services/onboarding.service';
import { getLeadingIconPos } from '@app/shared/utils/rtl.util';
import {
  subscriptionStatusKey,
  subscriptionStatusSeverity,
  TagSeverity,
} from '@app/shared/utils/status-tag.util';
import {
  BillingPeriod,
  SUBSCRIPTION_STATUS_OPTIONS,
  SubscriptionExportFormat,
  SubscriptionFilters,
  SubscriptionRow,
  SubscriptionStatus,
} from './models/operia-subscriptions.model';

interface PlanFilterOption {
  labelKey?: string;
  label?: string;
  value: string | null;
}

interface ExportMenuOption {
  label: string;
  format: SubscriptionExportFormat;
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
    OverlayPanelModule,
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

  private readonly exportButton = viewChild<Button>('exportButton');
  private readonly exportPanel = viewChild<OverlayPanel>('exportPanel');

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
  readonly exportMenuOptions = computed<ExportMenuOption[]>(() => {
    this.languageService.currentLang();

    return [
      {
        label: this.translate.instant('OPERIA_SUBSCRIPTIONS.EXPORT_EXCEL'),
        format: 'excel',
      },
      {
        label: this.translate.instant('OPERIA_SUBSCRIPTIONS.EXPORT_PDF'),
        format: 'pdf',
      },
    ];
  });

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
    return subscriptionStatusSeverity(status);
  }

  statusKey(status: SubscriptionStatus): string {
    return subscriptionStatusKey(status);
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

  openExportMenu(event: Event): void {
    if (this.exportLoading()) {
      return;
    }

    const button = this.exportButton()?.el?.nativeElement as HTMLElement | undefined;
    this.exportPanel()?.toggle(event, button ?? event.currentTarget);
  }

  alignExportPanel(): void {
    queueMicrotask(() => {
      const panel = this.exportPanel();
      const button = this.exportButton()?.el?.nativeElement as HTMLElement | undefined;
      if (!panel || !button) {
        return;
      }

      panel.align();

      if (this.languageService.currentLang() !== 'ar') {
        return;
      }

      const panelElement = document.querySelector(
        '.export-menu-panel.p-overlaypanel',
      ) as HTMLElement | null;

      if (!panelElement) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      panelElement.style.left = `${buttonRect.right - panelElement.offsetWidth}px`;
      panelElement.style.top = `${buttonRect.bottom + 6}px`;
    });
  }

  selectExport(format: SubscriptionExportFormat): void {
    this.exportPanel()?.hide();
    this.exportReport(format);
  }

  exportReport(format: SubscriptionExportFormat = 'excel'): void {
    this.exportLoading.set(true);
    this.financeService
      .exportSubscriptions(this.currentFilters(), format)
      .pipe(
        finalize(() => this.exportLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(blob => {
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        this.downloadBlob(blob, `operia-subscriptions.${extension}`);
      });
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
