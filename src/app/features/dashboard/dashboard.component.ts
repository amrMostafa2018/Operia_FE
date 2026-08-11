import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { getPrevArrowIcon, getLeadingIconPos } from '@app/shared/utils/rtl.util';
import {
  bookingStatusKey,
  bookingStatusSeverity,
  TagSeverity,
} from '@app/shared/utils/status-tag.util';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { MessageService, MenuItem } from 'primeng/api';
import { Booking, BookingStatus } from '@app/features/bookings/models/booking.model';
import { BookingService } from '@app/features/bookings/booking.service';
import { InquiryBookingModalComponent } from '@app/features/bookings/inquiry-booking-modal/inquiry-booking-modal.component';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { MOCK_STATS, StatCard } from './models/dashboard.model';
import { BOOKING_STATUS_OPTIONS } from '@app/features/bookings/models/booking.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    DropdownModule,
    CalendarModule,
    MenuModule,
    DialogModule,
    FormsModule,
    InquiryBookingModalComponent,
    ConfirmActionDialogComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly languageService = inject(LanguageService);
  private readonly bookingService = inject(BookingService);
  private readonly permissions = inject(PermissionService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stats: StatCard[] = MOCK_STATS;
  readonly allBookings = signal<Booking[]>([]);
  readonly canManage = computed(() => this.permissions.hasPermission(Policies.BookingsManage));

  dateRange = signal<Date[] | null>(null);
  selectedEmployee = signal<string | null>(null);
  selectedStatus = signal<BookingStatus | null>(null);
  rows = signal(10);
  first = signal(0);
  inquiryOpen = signal(false);
  detailBooking = signal<Booking | null>(null);
  bookingPendingCancel = signal<Booking | null>(null);
  employees = signal<{ label: string; value: string | null }[]>([
    { label: 'DASHBOARD.ALL_EMPLOYEES', value: null },
  ]);

  readonly statusOptions = BOOKING_STATUS_OPTIONS.map(o => ({
    ...o,
    label: o.label,
  }));

  readonly rowOptions = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    { label: '500', value: 500 },
    { label: '1000', value: 1000 },
    { label: '2000', value: 2000 },
  ];

  readonly filteredBookings = computed(() => {
    let result = this.allBookings();
    const employee = this.selectedEmployee();
    const status = this.selectedStatus();

    if (employee) {
      result = result.filter(b => b.employeeId === employee);
    }
    if (status) {
      result = result.filter(b => b.status === status);
    }
    return result;
  });

  readonly prevIcon = computed(() => getPrevArrowIcon(this.languageService.currentLang()));
  readonly prevIconPos = computed(() => getLeadingIconPos(this.languageService.currentLang()));

  readonly today = computed(() =>
    new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  );

  constructor() {
    this.loadBookings();
    this.bookingService
      .getEmployees()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(emps => {
        this.employees.set([
          { label: 'DASHBOARD.ALL_EMPLOYEES', value: null },
          ...emps.map(e => ({ label: e.fullName, value: e.id })),
        ]);
      });
  }

  loadBookings(): void {
    this.bookingService
      .getTodayBookings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(bookings => this.allBookings.set(bookings));
  }

  statusSeverity(status: BookingStatus): TagSeverity {
    return bookingStatusSeverity(status);
  }

  statusKey(status: BookingStatus): string {
    return bookingStatusKey(status);
  }

  onRowsChange(val: number): void {
    this.rows.set(val);
    this.first.set(0);
  }

  exportReport(): void {
    this.bookingService.exportBookings({});
    this.toast.add({
      severity: 'info',
      summary: 'OPERIA',
      detail: 'Export will be available when the API is ready.',
    });
  }

  openInquiry(): void {
    this.inquiryOpen.set(true);
  }

  closeInquiry(): void {
    this.inquiryOpen.set(false);
    this.loadBookings();
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
          this.toast.add({ severity: 'success', summary: 'OPERIA', detail: 'Booking cancelled.' });
          this.cancelCancelRequest();
          this.loadBookings();
        },
      });
  }

  changeStatus(booking: Booking, status: BookingStatus): void {
    this.bookingService
      .changeStatus(booking.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'OPERIA', detail: 'Status updated.' });
          this.loadBookings();
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
