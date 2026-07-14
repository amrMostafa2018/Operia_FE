import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { LanguageService } from '@core/services/language.service';
import { getPrevArrowIcon, getPrevIconPos } from '@app/shared/utils/rtl.util';

import {
  BillingPeriod,
  MOCK_SUBSCRIPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PaymentMethod,
  PLAN_OPTIONS,
  SUBSCRIPTION_STATUS_OPTIONS,
  SubscriptionRow,
  SubscriptionStatus,
} from './models/operia-subscriptions.model';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

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
export class OperiaSubscriptionsComponent {
  private readonly languageService = inject(LanguageService);

  readonly allSubscriptions: SubscriptionRow[] = MOCK_SUBSCRIPTIONS;

  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);
  selectedPlan = signal<string | null>(null);
  selectedStatus = signal<SubscriptionStatus | null>(null);
  selectedPaymentMethod = signal<PaymentMethod | null>(null);
  rows = signal(10);
  first = signal(0);

  readonly statusOptions = SUBSCRIPTION_STATUS_OPTIONS;
  readonly planOptions = PLAN_OPTIONS;
  readonly paymentMethodOptions = PAYMENT_METHOD_OPTIONS;

  readonly rowOptions = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
  ];

  readonly filteredSubscriptions = computed(() => {
    let result = this.allSubscriptions;
    const plan = this.selectedPlan();
    const status = this.selectedStatus();
    const paymentMethod = this.selectedPaymentMethod();

    if (plan) {
      result = result.filter(row => row.planCode === plan);
    }
    if (status) {
      result = result.filter(row => row.status === status);
    }
    if (paymentMethod) {
      result = result.filter(row => row.paymentMethod === paymentMethod);
    }

    return result;
  });

  readonly totalRecords = computed(() => this.filteredSubscriptions().length);

  readonly prevIcon = computed(() =>
    getPrevArrowIcon(this.languageService.currentLang())
  );

  readonly prevIconPos = computed(() =>
    getPrevIconPos(this.languageService.currentLang())
  );

  statusSeverity(status: SubscriptionStatus): TagSeverity {
    const map: Record<SubscriptionStatus, TagSeverity> = {
      active: 'success',
      expired: 'secondary',
      cancelled: 'danger',
    };
    return map[status];
  }

  statusKey(status: SubscriptionStatus): string {
    const map: Record<SubscriptionStatus, string> = {
      active: 'OPERIA_SUBSCRIPTIONS.STATUS.ACTIVE',
      expired: 'OPERIA_SUBSCRIPTIONS.STATUS.EXPIRED',
      cancelled: 'OPERIA_SUBSCRIPTIONS.STATUS.CANCELLED',
    };
    return map[status];
  }

  billingPeriodKey(period: BillingPeriod): string {
    return period === 'yearly'
      ? 'OPERIA_SUBSCRIPTIONS.BILLING.YEARLY'
      : 'OPERIA_SUBSCRIPTIONS.BILLING.MONTHLY';
  }

  paymentMethodKey(method: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = {
      bank_transfer: 'OPERIA_SUBSCRIPTIONS.PAYMENT_METHODS.BANK_TRANSFER',
      instapay: 'OPERIA_SUBSCRIPTIONS.PAYMENT_METHODS.INSTAPAY',
      visa: 'OPERIA_SUBSCRIPTIONS.PAYMENT_METHODS.VISA',
    };
    return map[method];
  }

  paymentMethodIcon(method: PaymentMethod): string | null {
    const map: Record<PaymentMethod, string | null> = {
      bank_transfer: 'pi pi-building',
      instapay: 'pi pi-wallet',
      visa: 'pi pi-credit-card',
    };
    return map[method];
  }

  onRowsChange(val: number): void {
    this.rows.set(val);
    this.first.set(0);
  }

  onSearch(): void {
    // Client-side filtering is reactive via computed; placeholder for future API call.
  }

  exportReport(): void {
    // placeholder — real export wired when API is ready
  }

  onViewInvoice(row: SubscriptionRow): void {
    void row;
    // placeholder — invoice view wired when API is ready
  }
}
