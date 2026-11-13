import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { CurrencyService } from '@core/services/currency.service';
import { Policies } from '@core/models/permissions.model';
import {
  getPrevArrowIcon,
  getLeadingIconPos,
  getSubmitArrowIcon,
} from '@app/shared/utils/rtl.util';
import {
  bookingStatusKey,
  bookingStatusSeverity,
  statusPillClass,
  TagSeverity,
} from '@app/shared/utils/status-tag.util';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService, MenuItem } from 'primeng/api';
import {
  Booking,
  BookingFilters,
  BookingStatus,
  BOOKING_STATUS_OPTIONS,
} from '@app/features/bookings/models/booking.model';
import { BookingService } from '@app/features/bookings/booking.service';
import { SaleBuilderDialogComponent } from '@app/features/sales/sale-builder-dialog.component';
import { ConfirmSaleResult } from '@app/features/sales/sale.service';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { CustomerInquiryDialogComponent } from './customer-inquiry-dialog/customer-inquiry-dialog.component';
import { MOCK_STATS, StatCard } from './models/dashboard.model';
import { DashboardRevenueService, DashboardSummary } from './dashboard-revenue.service';
import { DashboardRevenueTableComponent } from './dashboard-revenue-table.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    TableModule,
    ButtonModule,
    DropdownModule,
    CalendarModule,
    MenuModule,
    DialogModule,
    InputTextModule,
    FormsModule,
    CustomerInquiryDialogComponent,
    SaleBuilderDialogComponent,
    ConfirmActionDialogComponent,
    DashboardRevenueTableComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly languageService = inject(LanguageService);
  private readonly permissions = inject(PermissionService);
  private readonly bookingService = inject(BookingService);
  private readonly revenueService = inject(DashboardRevenueService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currencyService = inject(CurrencyService);

  readonly canSell = computed(() => this.permissions.hasPermission(Policies.PackagesSell));
  readonly canInquiry = computed(() => this.permissions.hasPermission(Policies.CustomersRead));
  readonly canBookings = computed(() => this.permissions.hasPermission(Policies.BookingsRead));
  readonly canExport = computed(() => this.permissions.hasPermission(Policies.DashboardExport));
  readonly canReadRevenue = computed(() => this.permissions.hasPermission(Policies.RevenueRead));
  readonly canManage = computed(() => this.permissions.hasPermission(Policies.BookingsManage));
  /** Today's bookings still use sample rows, so the table stays a Coming Soon panel. */
  readonly bookingsComingSoon = true;

  readonly stats = signal<StatCard[]>(
    MOCK_STATS.map(stat => ({
      ...stat,
      value: stat.isCurrency ? 0 : stat.value,
    }))
  );
  readonly allBookings = signal<Booking[]>([]);

  readonly dateFrom = signal<Date | null>(new Date());
  readonly dateTo = signal<Date | null>(new Date());
  readonly quickSearch = signal('');
  readonly mobileSearch = signal('');
  readonly nameSearch = signal('');
  readonly selectedEmployee = signal<string | null>(null);
  readonly selectedStatus = signal<BookingStatus | null>(null);
  readonly rows = signal(5);
  readonly first = signal(0);

  readonly customerInquiryOpen = signal(false);
  readonly sellOpen = signal(false);
  readonly detailBooking = signal<Booking | null>(null);
  readonly bookingPendingCancel = signal<Booking | null>(null);

  readonly employees = signal<{ label: string; value: string | null }[]>([
    { label: 'DASHBOARD.ALL_EMPLOYEES', value: null },
  ]);

  readonly statusOptions = [
    { label: 'DASHBOARD.ALL_STATUS', value: null },
    ...BOOKING_STATUS_OPTIONS.filter(option => option.value !== null),
  ];

  readonly rowOptions = [5, 10, 25, 50, 100];

  readonly pageReportTemplate = signal(this.translate.instant('DASHBOARD.PAGE_REPORT'));

  readonly filteredBookings = computed(() => {
    let result = this.allBookings();
    const employee = this.selectedEmployee();
    const status = this.selectedStatus();
    const quick = this.quickSearch().trim().toLowerCase();
    const mobile = this.mobileSearch().trim();
    const name = this.nameSearch().trim().toLowerCase();

    if (employee) {
      result = result.filter(b => b.employeeId === employee);
    }
    if (status) {
      result = result.filter(b => b.status === status);
    }
    if (mobile) {
      result = result.filter(b => b.customerPhone.includes(mobile));
    }
    if (name) {
      result = result.filter(b => b.customerName.toLowerCase().includes(name));
    }
    if (quick) {
      result = result.filter(
        b =>
          b.customerName.toLowerCase().includes(quick) ||
          b.customerPhone.includes(quick) ||
          b.bookingNumber.includes(quick) ||
          b.service.toLowerCase().includes(quick) ||
          b.employeeName.toLowerCase().includes(quick)
      );
    }
    return result;
  });

  readonly prevIcon = computed(() => getPrevArrowIcon(this.languageService.currentLang()));
  readonly nextIcon = computed(() => getSubmitArrowIcon(this.languageService.currentLang()));
  readonly prevIconPos = computed(() => getLeadingIconPos(this.languageService.currentLang()));
  readonly nextIconPos = computed(() =>
    this.languageService.currentLang() === 'ar' ? 'left' : 'right'
  );
  readonly leadingIconPos = computed(() => getLeadingIconPos(this.languageService.currentLang()));

  readonly today = computed(() => {
    const locale = this.languageService.currentLang() === 'ar' ? 'ar-EG' : 'en-GB';
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  });

  constructor() {
    this.loadSummary();

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('DASHBOARD.PAGE_REPORT'));
    });
  }

  private loadSummary(): void {
    this.revenueService
      .summary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: summary =>
          this.stats.update(stats =>
            stats.map(stat => ({
              ...stat,
              value: this.summaryValueForCard(stat.labelKey, summary),
            }))
          ),
      });
  }

  private summaryValueForCard(labelKey: string, summary: DashboardSummary): number {
    switch (labelKey) {
      case 'DASHBOARD.NEW_CUSTOMERS_MONTH':
        return summary.newCustomersMonth;
      case 'DASHBOARD.TODAY_BOOKINGS':
        return summary.todayBookings;
      case 'DASHBOARD.MONTHLY_BOOKINGS_TOTAL':
        return summary.monthlyBookings;
      case 'DASHBOARD.TODAY_REVENUE':
        return summary.todayRevenue;
      case 'DASHBOARD.MONTHLY_REVENUE_TOTAL':
        return summary.monthlyRevenue;
      default:
        return 0;
    }
  }

  formatStatValue(stat: StatCard): string {
    if (stat.isCurrency) {
      const formatted = new Intl.NumberFormat('en-US').format(stat.value);
      const label = this.currencyService.currencyLabel();
      return label ? `${formatted} ${label}` : formatted;
    }
    return String(stat.value);
  }

  loadBookings(): void {
    this.bookingService
      .getTodayBookings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(bookings => this.allBookings.set(bookings));
  }

  onDateFromChange(value: Date | null): void {
    const to = this.dateTo();
    if (value && to && value > to) {
      this.dateTo.set(value);
    }
    this.dateFrom.set(value);
  }

  onDateToChange(value: Date | null): void {
    const from = this.dateFrom();
    if (value && from && value < from) {
      this.dateFrom.set(value);
    }
    this.dateTo.set(value);
  }

  applyTableFilters(): void {
    this.first.set(0);
  }

  rowNumber(index: number): number {
    return this.first() + index + 1;
  }

  customerInitial(name: string): string {
    return name.trim().charAt(0) || '?';
  }

  statusSeverity(status: BookingStatus): TagSeverity {
    return bookingStatusSeverity(status);
  }

  readonly statusPillClass = statusPillClass;

  statusKey(status: BookingStatus): string {
    return bookingStatusKey(status);
  }

  onRowsChange(val: number): void {
    this.rows.set(val);
    this.first.set(0);
  }

  onPageChange(event: { first?: number; rows?: number | null }): void {
    if (event.first != null) {
      this.first.set(event.first);
    }
    if (event.rows != null) {
      this.rows.set(event.rows);
    }
  }

  private buildExportFilters(): BookingFilters {
    return {
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      search: this.quickSearch(),
      employeeId: this.selectedEmployee(),
      status: this.selectedStatus(),
      customerMobile: this.mobileSearch(),
      customerName: this.nameSearch(),
    };
  }

  exportReport(): void {
    this.bookingService.exportBookings(this.buildExportFilters());
    this.toast.add({
      severity: 'info',
      summary: 'OPERIA',
      detail: this.translate.instant('DASHBOARD.EXPORT_PENDING'),
    });
  }

  openCustomerInquiry(): void {
    this.customerInquiryOpen.set(true);
  }

  closeCustomerInquiry(): void {
    this.customerInquiryOpen.set(false);
  }

  openSellDialog(): void {
    this.sellOpen.set(true);
  }

  closeSellDialog(): void {
    this.sellOpen.set(false);
  }

  onSaleConfirmed(result: ConfirmSaleResult): void {
    this.loadSummary();
    this.toast.add({
      severity: 'success',
      summary: 'OPERIA',
      detail:
        this.translate.instant(
          result.status === 'Booked'
            ? 'SALE_BUILDER.BOOKED'
            : result.status === 'Closed'
              ? 'SALE_BUILDER.CLOSED'
              : result.dueNow === 0
                ? 'SALE_BUILDER.SAVED_SALE'
                : 'SALE_BUILDER.CONFIRMED'
        ) + (result.status === 'ReadyToBook' ? ` ${result.saleId}` : ''),
    });
    this.closeSellDialog();
  }

  viewBooking(booking: Booking): void {
    this.detailBooking.set(booking);
  }

  closeDetail(): void {
    this.detailBooking.set(null);
  }

  requestCancel(booking: Booking): void {
    this.bookingPendingCancel.set(booking);
  }

  cancelCancelRequest(): void {
    this.bookingPendingCancel.set(null);
  }

  confirmCancel(): void {
    const booking = this.bookingPendingCancel();
    if (!booking) return;
    this.bookingService
      .cancelBooking(booking.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            summary: 'OPERIA',
            detail: this.translate.instant('BOOKINGS.TOAST.CANCELLED'),
          });
          this.cancelCancelRequest();
          this.loadBookings();
          this.loadSummary();
        },
      });
  }

  changeStatus(booking: Booking, status: BookingStatus): void {
    this.bookingService
      .changeStatus(booking.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            summary: 'OPERIA',
            detail: this.translate.instant('BOOKINGS.TOAST.SAVED'),
          });
          this.loadBookings();
          this.loadSummary();
        },
      });
  }

  getRowMenu(booking: Booking): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: this.translate.instant('BOOKINGS.ACTIONS.VIEW'),
        icon: 'pi pi-eye',
        command: () => this.viewBooking(booking),
      },
    ];
    if (this.canManage()) {
      if (booking.status === 'pending') {
        items.push({
          label: this.translate.instant('BOOKINGS.ACTIONS.COMPLETE'),
          icon: 'pi pi-check',
          command: () => this.changeStatus(booking, 'completed'),
        });
      }
      if (booking.status !== 'cancelled') {
        items.push({
          label: this.translate.instant('BOOKINGS.ACTIONS.CANCEL'),
          icon: 'pi pi-times',
          command: () => this.requestCancel(booking),
        });
      }
    }
    return items;
  }
}
