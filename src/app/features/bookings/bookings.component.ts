import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService, MenuItem } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import {
  bookingStatusKey,
  bookingStatusSeverity,
  TagSeverity,
} from '@app/shared/utils/status-tag.util';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { BookingService } from './booking.service';
import {
  Booking,
  BookingStatus,
  BookingSummary,
  BOOKING_PAGE_SIZES,
  BOOKING_STATUS_OPTIONS,
} from './models/booking.model';
import { InquiryBookingModalComponent } from './inquiry-booking-modal/inquiry-booking-modal.component';
import { CalendarAddBookingDialogComponent } from './calendar-add-booking-dialog/calendar-add-booking-dialog.component';
import { BookingsCalendarComponent } from './bookings-calendar/bookings-calendar.component';
import {
  CalendarBookingDraft,
  CalendarSlotSelection,
} from './bookings-calendar/bookings-calendar.utils';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    DialogModule,
    InputTextModule,
    MenuModule,
    TableModule,
    TagModule,
    ConfirmActionDialogComponent,
    InquiryBookingModalComponent,
    CalendarAddBookingDialogComponent,
    BookingsCalendarComponent,
  ],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingsComponent implements AfterViewInit {
  @ViewChild(BookingsCalendarComponent)
  private calendar?: BookingsCalendarComponent;

  private readonly bookingService = inject(BookingService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManage = computed(() => this.permissions.hasPermission(Policies.BookingsManage));
  readonly displayMode = signal<'calendar' | 'table'>('calendar');
  readonly calendarBookings = signal<Booking[]>([]);
  readonly bookings = signal<Booking[]>([]);
  readonly summary = signal<BookingSummary>({ total: 0, completed: 0, pending: 0, cancelled: 0 });
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly dateRange = signal<Date[] | null>(null);
  readonly search = signal('');
  readonly selectedEmployee = signal<string | null>(null);
  readonly selectedStatus = signal<BookingStatus | null>(null);
  readonly inquiryOpen = signal(false);
  readonly calendarAddOpen = signal(false);
  readonly calendarSlot = signal<CalendarSlotSelection | null>(null);
  readonly inquiryDraft = signal<CalendarBookingDraft | null>(null);
  readonly detailBooking = signal<Booking | null>(null);
  readonly bookingPendingCancel = signal<Booking | null>(null);
  readonly reassignBooking = signal<Booking | null>(null);
  readonly reassignEmployeeId = signal<string | null>(null);
  readonly employees = signal<{ id: string; fullName: string }[]>([]);

  page = 1;
  pageSize = 10;

  readonly pageSizes = BOOKING_PAGE_SIZES.map(v => ({ label: String(v), value: v }));
  readonly statusOptions = BOOKING_STATUS_OPTIONS;

  ngAfterViewInit(): void {
    this.bookingService
      .getEmployees()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(emps => this.employees.set(emps.map(e => ({ id: e.id, fullName: e.fullName }))));
    this.load();
    this.loadCalendar();
  }

  load(): void {
    this.loading.set(true);
    const filters = this.buildFilters();
    this.bookingService
      .list(filters, this.page, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.bookings.set(result.items);
          this.total.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    this.bookingService
      .summary(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(s => this.summary.set(s));
  }

  loadCalendar(): void {
    this.bookingService
      .listAll(this.buildCalendarFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => this.calendarBookings.set(items));
  }

  setDisplayMode(mode: 'calendar' | 'table'): void {
    this.displayMode.set(mode);
    if (mode === 'calendar') {
      this.loadCalendar();
    }
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  clearFilters(): void {
    this.dateRange.set(null);
    this.search.set('');
    this.selectedEmployee.set(null);
    this.selectedStatus.set(null);
    this.applyFilters();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.load();
  }

  openInquiry(): void {
    this.inquiryDraft.set(null);
    this.inquiryOpen.set(true);
  }

  openCalendarAddBooking(slot: CalendarSlotSelection): void {
    this.calendarSlot.set(slot);
    this.calendarAddOpen.set(true);
  }

  closeCalendarAddBooking(): void {
    this.calendarAddOpen.set(false);
    this.calendarSlot.set(null);
  }

  onCalendarAddContinue(draft: CalendarBookingDraft): void {
    this.calendarAddOpen.set(false);
    this.calendarSlot.set(null);
    this.inquiryDraft.set(draft);
    this.inquiryOpen.set(true);
  }

  closeInquiry(): void {
    this.inquiryOpen.set(false);
    this.inquiryDraft.set(null);
    this.clearCalendarSelection();
    this.load();
  }

  onBookingCreated(): void {
    this.clearCalendarSelection();
    this.load();
    this.loadCalendar();
  }

  private clearCalendarSelection(): void {
    this.calendar?.clearSelection();
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
          this.load();
          this.loadCalendar();
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
          this.load();
          this.loadCalendar();
        },
      });
  }

  openReassign(booking: Booking): void {
    this.reassignBooking.set(booking);
    this.reassignEmployeeId.set(booking.employeeId);
  }

  closeReassign(): void {
    this.reassignBooking.set(null);
    this.reassignEmployeeId.set(null);
  }

  confirmReassign(): void {
    const booking = this.reassignBooking();
    const employeeId = this.reassignEmployeeId();
    if (!booking || !employeeId) return;
    this.bookingService
      .reassignEmployee(booking.id, employeeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: 'OPERIA', detail: 'Employee reassigned.' });
          this.closeReassign();
          this.load();
          this.loadCalendar();
        },
      });
  }

  exportBookings(): void {
    this.bookingService.exportBookings(this.buildFilters());
    this.toast.add({
      severity: 'info',
      summary: 'OPERIA',
      detail: 'Export will be available when the API is ready.',
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
        items.push(
          {
            label: this.translate.instant('BOOKINGS.ACTIONS.CANCEL'),
            icon: 'pi pi-times',
            command: () => this.requestCancel(booking),
          },
          {
            label: this.translate.instant('BOOKINGS.ACTIONS.REASSIGN'),
            icon: 'pi pi-user-edit',
            command: () => this.openReassign(booking),
          }
        );
      }
    }
    return items;
  }

  statusSeverity(status: BookingStatus): TagSeverity {
    return bookingStatusSeverity(status);
  }

  statusKey(status: BookingStatus): string {
    return bookingStatusKey(status);
  }

  employeeOptions(): { label: string; value: string | null }[] {
    return [
      { label: 'BOOKINGS.ALL_EMPLOYEES', value: null },
      ...this.employees().map(e => ({ label: e.fullName, value: e.id })),
    ];
  }

  private buildFilters() {
    const range = this.dateRange();
    return {
      dateFrom: range?.[0] ?? null,
      dateTo: range?.[1] ?? null,
      search: this.search(),
      employeeId: this.selectedEmployee(),
      status: this.selectedStatus(),
    };
  }

  private buildCalendarFilters() {
    return {
      employeeId: this.selectedEmployee(),
      status: this.selectedStatus(),
    };
  }
}
