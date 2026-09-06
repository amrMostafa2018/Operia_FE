import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { PermissionService } from '@core/services/permission.service';
import { LanguageService } from '@core/services/language.service';
import { Policies } from '@core/models/permissions.model';
import { BranchService } from '@app/features/branches/branch.service';
import { BookableEmployee, EmployeeService } from '@app/features/employees/employee.service';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { getPrevArrowIcon } from '@app/shared/utils/rtl.util';
import { resolveUploadUrl } from '@core/utils/resolve-upload-url';
import {
  addDays,
  AppointmentFilters,
  avatarColorFromId,
  BookingLineItem,
  BookingRecord,
  BranchOption,
  bookingBlockHeightPx,
  bookingBlockTopPx,
  BOOKING_OVERLAY_GAP_PX,
  buildSlotGrid,
  CalendarSlotCell,
  CalendarViewMode,
  cloneBookings,
  cloneClients,
  defaultFilters,
  defaultSelectedDate,
  EmployeeOption,
  filterEmployees,
  formatMinutesAsTime,
  formatTimeRange,
  generateBookingNumber,
  initialsFromName,
  MOCK_DURATIONS,
  MOCK_PACKAGES,
  parseTimeToMinutes,
  resolveEmployeeForFourDayView,
  SlotSelection,
  SLOT_INTERVAL_MINUTES,
  sumLineItemDuration,
  sumLineItemPrice,
  toDateKey,
  bookingHasPackage,
} from './models/booking.model';
import {
  BookAppointmentDialogComponent,
  BookAppointmentPayload,
} from './book-appointment-dialog.component';
import {
  BookingDetailsDialogComponent,
  BookingDetailsSavePayload,
} from './booking-details-dialog.component';
import { ConfirmPackageUsageDialogComponent } from './confirm-package-usage-dialog.component';
import { DurationMismatchDialogComponent } from './duration-mismatch-dialog.component';

interface PendingBookingDraft {
  selection: SlotSelection;
  clientName: string;
  clientMobile: string;
  clientId: string | null;
  lineItems: BookingLineItem[];
  paymentMethod: BookingRecord['paymentMethod'];
  discount: number;
  serviceDuration: number;
}

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    CalendarModule,
    ConfirmActionDialogComponent,
    BookAppointmentDialogComponent,
    BookingDetailsDialogComponent,
    ConfirmPackageUsageDialogComponent,
    DurationMismatchDialogComponent,
  ],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsComponent {
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly branchesApi = inject(BranchService);
  private readonly employeesApi = inject(EmployeeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly branches = signal<BranchOption[]>([]);
  readonly employees = signal<EmployeeOption[]>([]);
  readonly durations = MOCK_DURATIONS;
  readonly packages = MOCK_PACKAGES;

  readonly bookings = signal<BookingRecord[]>(cloneBookings());
  readonly clients = signal(cloneClients());

  readonly filters = signal<AppointmentFilters>(defaultFilters());
  readonly selectedDate = signal<Date>(defaultSelectedDate());
  readonly viewMode = signal<CalendarViewMode>('today');
  readonly selectedSlot = signal<SlotSelection | null>(null);

  readonly bookDialogVisible = signal(false);
  readonly detailsDialogVisible = signal(false);
  readonly packageUsageVisible = signal(false);
  readonly mismatchVisible = signal(false);
  readonly cancelConfirmVisible = signal(false);

  readonly activeBookingId = signal<string | null>(null);
  readonly pendingCloseBookingId = signal<string | null>(null);
  readonly pendingDraft = signal<PendingBookingDraft | null>(null);
  readonly mismatchServiceDuration = signal(0);
  readonly mismatchSlotDuration = signal(0);

  readonly canManage = computed(() => this.permissions.hasPermission(Policies.BookingsManage));

  readonly employeeOptions = computed(() => [
    { label: 'BOOKINGS.ALL_EMPLOYEES', value: null },
    ...this.employees().map(employee => ({
      label: employee.name,
      value: employee.id,
    })),
  ]);

  readonly visibleEmployees = computed(() =>
    filterEmployees(this.employees(), this.filters().employeeId)
  );

  readonly fourDayEmployee = computed(() =>
    resolveEmployeeForFourDayView(this.employees(), this.filters().employeeId)
  );

  readonly fourDayDates = computed(() => {
    const start = this.selectedDate();
    return [0, 1, 2, 3].map(offset => addDays(start, offset));
  });

  readonly columns = computed(() => {
    if (this.viewMode() === 'today') {
      return this.visibleEmployees().map(employee => ({
        id: employee.id,
        title: employee.name,
        subtitle: employee.specialty,
        employeeId: employee.id,
        employee,
        date: this.selectedDate(),
      }));
    }
    const employee = this.fourDayEmployee();
    if (!employee) {
      return [];
    }
    return this.fourDayDates().map(date => ({
      id: `${employee.id}-${toDateKey(date)}`,
      title: date.toLocaleDateString(this.languageService.currentLang(), {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      subtitle: employee.name,
      employeeId: employee.id,
      employee,
      date,
    }));
  });

  readonly slotRows = computed(() => {
    const rows: number[] = [];
    for (let minute = 8 * 60; minute < 18 * 60; minute += SLOT_INTERVAL_MINUTES) {
      rows.push(minute);
    }
    return rows;
  });

  readonly gridCells = computed(() => {
    const map = new Map<string, CalendarSlotCell[]>();
    for (const column of this.columns()) {
      const key = `${column.employeeId}|${toDateKey(column.date)}`;
      map.set(
        key,
        buildSlotGrid(
          this.bookings(),
          column.employeeId,
          column.date,
          this.filters().durationMinutes,
          column.employee.workingDays
        )
      );
    }
    return map;
  });

  readonly activeBooking = computed(() => {
    const id = this.activeBookingId();
    return this.bookings().find(booking => booking.id === id) ?? null;
  });

  readonly showFooterConfirm = computed(() => {
    const filters = this.filters();
    const slot = this.selectedSlot();
    return !!(
      slot &&
      this.canManage() &&
      this.isClientFirstReady() &&
      filters.clientName.trim() &&
      filters.clientMobile.trim()
    );
  });

  readonly selectedPackageName = computed(() => {
    const packageId = this.filters().packageId;
    if (!packageId) {
      return null;
    }
    return this.packages.find(item => item.id === packageId)?.name ?? null;
  });

  readonly formattedSelectedDate = computed(() =>
    this.selectedDate().toLocaleDateString(this.languageService.currentLang(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );

  readonly nextArrowIcon = computed(() =>
    this.languageService.currentLang() === 'ar' ? 'pi pi-arrow-left' : 'pi pi-arrow-right'
  );

  readonly prevArrowIcon = computed(() => getPrevArrowIcon(this.languageService.currentLang()));

  constructor() {
    this.loadBranches();
  }

  private loadBranches(): void {
    this.branchesApi
      .list({
        pageNumber: 1,
        pageSize: 100,
        search: '',
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          const items = result.items.map(branch => ({ id: branch.id, name: branch.name }));
          this.branches.set(items);
          const current = this.filters().branchId;
          const stillExists = items.some(branch => branch.id === current);
          if (!stillExists && items[0]) {
            this.updateFilter('branchId', items[0].id);
          } else if (this.filters().branchId) {
            this.loadEmployees(this.filters().branchId);
          }
        },
        error: () => {
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('BOOKINGS.TOAST.BRANCHES_LOAD_FAILED'),
          });
        },
      });
  }

  private selectedBranch(): BranchOption | null {
    const branchId = this.filters().branchId;
    const list = this.branches();
    return list.find(branch => branch.id === branchId) ?? list[0] ?? null;
  }

  updateFilter<K extends keyof AppointmentFilters>(key: K, value: AppointmentFilters[K]): void {
    this.filters.update(current => ({ ...current, [key]: value }));
    if (key === 'branchId') {
      this.selectedSlot.set(null);
      this.loadEmployees(typeof value === 'string' ? value : null);
      return;
    }
    if (key === 'employeeId') {
      const slot = this.selectedSlot();
      if (slot && value && slot.employeeId !== value) {
        this.selectedSlot.set(null);
      }
    }
    if (key === 'packageId' && typeof value === 'string' && value) {
      const packageOption = this.packages.find(item => item.id === value);
      if (packageOption) {
        this.filters.update(current => ({
          ...current,
          durationMinutes: packageOption.durationMinutes,
        }));
      }
    }
    if (key === 'durationMinutes' || key === 'packageId') {
      const slot = this.selectedSlot();
      if (slot) {
        this.selectedSlot.set({
          ...slot,
          slotDurationMinutes: this.filters().durationMinutes,
        });
      }
    }
  }

  private loadEmployees(branchId: string | null): void {
    if (!branchId) {
      this.employees.set([]);
      this.ensureEmployeeSelected([]);
      return;
    }

    this.employeesApi
      .listBookable(branchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: staff => {
          const mapped = staff.map(employee => this.toEmployeeOption(employee, branchId));
          this.employees.set(mapped);
          this.ensureEmployeeSelected(mapped);
        },
        error: () => {
          this.employees.set([]);
          this.ensureEmployeeSelected([]);
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('BOOKINGS.TOAST.EMPLOYEES_LOAD_FAILED'),
          });
        },
      });
  }

  private ensureEmployeeSelected(staff: EmployeeOption[] = this.employees()): void {
    const current = this.filters().employeeId;
    if (current && staff.some(employee => employee.id === current)) {
      return;
    }
    this.filters.update(filters => ({ ...filters, employeeId: staff[0]?.id ?? null }));
  }

  private toEmployeeOption(employee: BookableEmployee, branchId: string): EmployeeOption {
    return {
      id: employee.id,
      name: employee.fullName,
      specialty: employee.specialty || employee.jobTitle || '',
      branchId,
      avatarInitials: initialsFromName(employee.fullName),
      avatarColor: avatarColorFromId(employee.id),
      photoUrl: resolveUploadUrl(employee.photoUrl),
      workingDays: (employee.workingDays ?? []).map(day => ({
        day: day.day,
        enabled: day.enabled,
        fromMinutes: parseTimeToMinutes(day.fromTime),
        toMinutes: parseTimeToMinutes(day.toTime),
      })),
    };
  }

  setViewMode(mode: CalendarViewMode): void {
    this.viewMode.set(mode);
    if (mode === '4days' && !this.filters().employeeId) {
      this.ensureEmployeeSelected();
    }
  }

  shiftDate(days: number): void {
    this.selectedDate.update(current => addDays(current, days));
  }

  cellFor(
    column: { employeeId: string; date: Date },
    startMinutes: number
  ): CalendarSlotCell | undefined {
    const cells = this.gridCells().get(`${column.employeeId}|${toDateKey(column.date)}`);
    return cells?.find(cell => cell.startMinutes === startMinutes);
  }

  onSlotClick(
    column: { employeeId: string; date: Date; title: string },
    startMinutes: number
  ): void {
    const cell = this.cellFor(column, startMinutes);
    if (!cell) {
      return;
    }

    if (cell.visual === 'booked' || cell.visual === 'completed') {
      if (cell.booking) {
        this.activeBookingId.set(cell.booking.id);
        this.detailsDialogVisible.set(true);
      }
      return;
    }

    if (cell.visual !== 'available') {
      return;
    }

    this.selectAvailableSlot(column, startMinutes);
  }

  onBookingClick(booking: BookingRecord): void {
    this.activeBookingId.set(booking.id);
    this.detailsDialogVisible.set(true);
  }

  selectAvailableSlot(
    column: { employeeId: string; date: Date; title: string },
    startMinutes: number
  ): void {
    const employee = this.employees().find(item => item.id === column.employeeId);
    const branch = this.selectedBranch();
    const selection: SlotSelection = {
      employeeId: column.employeeId,
      employeeName: employee?.name ?? column.title,
      branchId: branch?.id ?? '',
      branchName: branch?.name ?? '',
      date: column.date,
      startMinutes,
      slotDurationMinutes: this.filters().durationMinutes,
    };

    this.selectedSlot.set(selection);

    if (this.isClientFirstReady()) {
      return;
    }

    this.bookDialogVisible.set(true);
  }

  isClientFirstReady(): boolean {
    const filters = this.filters();
    return !!(
      filters.clientName.trim() &&
      filters.clientMobile.trim() &&
      filters.durationMinutes > 0
    );
  }

  isSlotSelected(column: { employeeId: string; date: Date }, startMinutes: number): boolean {
    const slot = this.selectedSlot();
    if (!slot) {
      return false;
    }
    return (
      slot.employeeId === column.employeeId &&
      toDateKey(slot.date) === toDateKey(column.date) &&
      slot.startMinutes === startMinutes
    );
  }

  onMobileSearch(): void {
    const mobile = this.filters().clientMobile.trim();
    if (!mobile) {
      return;
    }
    const client = this.clients().find(item => item.mobile === mobile);
    if (client) {
      this.updateFilter('clientName', client.name);
    }
  }

  slotTimeLabel(startMinutes: number): string {
    return formatTimeRange(startMinutes, SLOT_INTERVAL_MINUTES);
  }

  footerSlotLabel(): string {
    const slot = this.selectedSlot();
    if (!slot) {
      return '';
    }
    const time = formatTimeRange(slot.startMinutes, slot.slotDurationMinutes);
    const date = slot.date.toLocaleDateString(this.languageService.currentLang(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${time}، ${date}`;
  }

  onFooterConfirm(): void {
    const slot = this.selectedSlot();
    const filters = this.filters();
    if (!slot || !this.canManage()) {
      return;
    }

    const packageOption = this.packages.find(item => item.id === filters.packageId);
    const duration = filters.durationMinutes;
    const lineItems: BookingLineItem[] = packageOption
      ? [
          {
            id: `line-${packageOption.id}`,
            name: packageOption.name,
            type: 'package',
            quantity: 1,
            price: 0,
            durationMinutes: duration,
            packageSessionLinked: true,
          },
        ]
      : [];

    const serviceDuration = duration;
    this.tryCreateBooking(
      {
        selection: slot,
        clientName: filters.clientName.trim(),
        clientMobile: filters.clientMobile.trim(),
        clientId: null,
        lineItems,
        paymentMethod: 'cash',
        discount: 0,
        serviceDuration,
      },
      'footer'
    );
  }

  onBookDialogConfirm(payload: BookAppointmentPayload): void {
    this.tryCreateBooking(payload, 'dialog');
  }

  private tryCreateBooking(payload: PendingBookingDraft, source: 'footer' | 'dialog'): void {
    if (payload.serviceDuration > payload.selection.slotDurationMinutes) {
      this.pendingDraft.set(payload);
      this.mismatchServiceDuration.set(payload.serviceDuration);
      this.mismatchSlotDuration.set(payload.selection.slotDurationMinutes);
      this.mismatchVisible.set(true);
      return;
    }
    this.commitBooking(payload, source);
  }

  onMismatchConfirm(): void {
    const draft = this.pendingDraft();
    if (!draft) {
      return;
    }
    this.commitBooking(draft, this.bookDialogVisible() ? 'dialog' : 'footer');
    this.pendingDraft.set(null);
    this.mismatchVisible.set(false);
  }

  onMismatchBack(): void {
    this.mismatchVisible.set(false);
    this.pendingDraft.set(null);
  }

  private commitBooking(payload: PendingBookingDraft, _source: 'footer' | 'dialog'): void {
    const total = sumLineItemPrice(payload.lineItems);
    const booking: BookingRecord = {
      id: `bk-${Date.now()}`,
      bookingNumber: generateBookingNumber(),
      status: 'booked',
      clientId: payload.clientId ?? `guest-${Date.now()}`,
      clientName: payload.clientName,
      clientMobile: payload.clientMobile,
      employeeId: payload.selection.employeeId,
      employeeName: payload.selection.employeeName,
      branchId: payload.selection.branchId,
      branchName: payload.selection.branchName,
      sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
      scheduledDate: new Date(payload.selection.date),
      startMinutes: payload.selection.startMinutes,
      slotDurationMinutes: payload.selection.slotDurationMinutes,
      lineItems: payload.lineItems,
      paymentMethod: payload.paymentMethod,
      totalAmount: Math.max(total - payload.discount, 0),
      paidAmount: 0,
      discount: payload.discount,
      createdAt: new Date(),
    };

    this.bookings.update(items => [...items, booking]);
    this.bookDialogVisible.set(false);
    this.selectedSlot.set(null);
    this.showToast('BOOKINGS.TOAST.BOOKED');
  }

  onDetailsSaved(payload: BookingDetailsSavePayload): void {
    this.bookings.update(items =>
      items.map(booking => {
        if (booking.id !== payload.bookingId) {
          return booking;
        }
        const totalAmount = sumLineItemPrice(payload.lineItems);
        return {
          ...booking,
          lineItems: payload.lineItems.map(item => ({ ...item })),
          paymentMethod: payload.paymentMethod,
          paidAmount: payload.paidAmount,
          totalAmount,
        };
      })
    );
    this.showToast('BOOKINGS.TOAST.SAVED');
  }

  onDetailsClose(bookingId: string): void {
    const booking = this.bookings().find(item => item.id === bookingId);
    if (!booking) {
      return;
    }
    if (bookingHasPackage(booking)) {
      this.pendingCloseBookingId.set(bookingId);
      this.packageUsageVisible.set(true);
      return;
    }
    this.completeBooking(bookingId);
  }

  onPackageUsageSubmit(): void {
    const bookingId = this.pendingCloseBookingId();
    if (!bookingId) {
      return;
    }
    this.clients.update(items =>
      items.map(client => ({
        ...client,
        packages: client.packages.map(pkg => ({
          ...pkg,
          usedSessions: Math.min(pkg.usedSessions + 1, pkg.totalSessions),
        })),
      }))
    );
    this.completeBooking(bookingId);
    this.packageUsageVisible.set(false);
    this.pendingCloseBookingId.set(null);
    this.detailsDialogVisible.set(false);
    this.showToast('BOOKINGS.TOAST.PACKAGE_USAGE');
  }

  private completeBooking(bookingId: string): void {
    this.bookings.update(items =>
      items.map(booking =>
        booking.id === bookingId ? { ...booking, status: 'completed' as const } : booking
      )
    );
    this.detailsDialogVisible.set(false);
    this.showToast('BOOKINGS.TOAST.CLOSED');
  }

  onDetailsCancelRequest(bookingId: string): void {
    this.activeBookingId.set(bookingId);
    this.cancelConfirmVisible.set(true);
  }

  onCancelConfirmed(): void {
    const bookingId = this.activeBookingId();
    if (!bookingId) {
      return;
    }
    this.bookings.update(items =>
      items.map(booking =>
        booking.id === bookingId ? { ...booking, status: 'cancelled' as const } : booking
      )
    );
    this.cancelConfirmVisible.set(false);
    this.detailsDialogVisible.set(false);
    this.showToast('BOOKINGS.TOAST.CANCELLED');
  }

  formatTime(minutes: number): string {
    return formatMinutesAsTime(minutes);
  }

  bookingTop(startMinutes: number): number {
    return bookingBlockTopPx(startMinutes) + BOOKING_OVERLAY_GAP_PX;
  }

  bookingHeight(durationMinutes: number): number {
    return bookingBlockHeightPx(durationMinutes) - BOOKING_OVERLAY_GAP_PX * 2;
  }

  bookingsForColumn(column: { employeeId: string; date: Date }): BookingRecord[] {
    return this.bookings().filter(
      booking =>
        booking.status !== 'cancelled' &&
        booking.employeeId === column.employeeId &&
        toDateKey(booking.scheduledDate) === toDateKey(column.date)
    );
  }

  showSlotCell(cell: CalendarSlotCell): boolean {
    return (
      !cell.isContinuation && cell.visual !== 'booked' && cell.visual !== 'completed'
    );
  }

  bookingTimeLabel(booking: BookingRecord): string {
    return formatTimeRange(booking.startMinutes, booking.slotDurationMinutes);
  }

  formatTimeRangeFor(startMinutes: number, durationMinutes: number): string {
    return formatTimeRange(startMinutes, durationMinutes);
  }

  formatSlotRange(selection: SlotSelection | null): string {
    if (!selection) {
      return '';
    }
    return formatTimeRange(selection.startMinutes, selection.slotDurationMinutes);
  }

  private showToast(key: string): void {
    this.toast.add({
      severity: 'success',
      summary: this.translate.instant(key),
    });
  }
}
