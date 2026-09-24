import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
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
import { PackageService } from '@app/features/packages/package.service';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { getPrevArrowIcon } from '@app/shared/utils/rtl.util';
import { resolveUploadUrl } from '@core/utils/resolve-upload-url';
import { extractApiFieldErrors, translateApiFieldErrors } from '@core/utils/api-error.util';
import {
  addDays,
  AppointmentAvailabilityBlock,
  AppointmentFilters,
  avatarColorFromId,
  BookingLineItem,
  BookingRecord,
  BranchOption,
  bookingBlockHeightPx,
  bookingBlockTopPx,
  BOOKING_OVERLAY_GAP_PX,
  SLOT_INTERVAL_MINUTES,
  buildAvailableSlots,
  buildSlotGrid,
  buildSlotRows,
  CalendarAvailableSlot,
  CalendarSlotCell,
  CalendarViewMode,
  calendarDayRange,
  CatalogCategoryTab,
  defaultFilters,
  defaultSelectedDate,
  displayedPackageUsedUnits,
  DurationOption,
  EmployeeOption,
  filterEmployees,
  formatMinutesAsTime,
  formatTimeRange,
  hoursForDate,
  initialsFromName,
  isSlotAvailableForBooking,
  PackageOption,
  parseTimeToMinutes,
  resolveEmployeeForFourDayView,
  ServiceCatalogItem,
  SlotSelection,
  mapBookingLineToApiItem,
  sumLineItemDuration,
  toDateKey,
  PaymentMethodId,
} from './models/booking.model';
import { AppointmentsApiService } from './appointments-api.service';
import { mapCalendarBooking } from './booking-record.mapper';
import { mapPackageToCatalogItem } from './booking-catalog.util';
import {
  BookAppointmentDialogComponent,
  BookAppointmentPayload,
} from './book-appointment-dialog.component';
import {
  BookingDetailsDialogComponent,
  BookingDetailsSavePayload,
} from './booking-details-dialog.component';
import { DurationMismatchDialogComponent } from './duration-mismatch-dialog.component';
import { SaleHandoffService, SaleHandoffDraft } from './sale-handoff.service';

/** Describes pending booking draft used by booking screens. */
interface PendingBookingDraft {
  selection: SlotSelection;
  clientName: string;
  clientMobile: string;
  clientId: string | null;
  lineItems: BookingLineItem[];
  serviceDuration: number;
  paymentMethod: PaymentMethodId | null;
}

/** Coordinates calendar availability and booking creation, editing, and cancellation. */
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
  private readonly packagesApi = inject(PackageService);
  private readonly saleHandoff = inject(SaleHandoffService);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly branches = signal<BranchOption[]>([]);
  readonly employees = signal<EmployeeOption[]>([]);
  readonly packages = signal<PackageOption[]>([]);
  readonly catalogItems = signal<ServiceCatalogItem[]>([]);
  readonly catalogCategories = signal<CatalogCategoryTab[]>([]);
  readonly catalogLoading = signal(false);
  readonly calendarLoading = signal(false);
  readonly calendarUnavailable = signal(false);

  readonly bookings = signal<BookingRecord[]>([]);
  readonly availabilityBlocks = signal<AppointmentAvailabilityBlock[]>([]);
  readonly clients = signal<import('./models/booking.model').ClientRecord[]>([]);

  readonly filters = signal<AppointmentFilters>(defaultFilters());
  readonly durations = computed<DurationOption[]>(() => {
    const selectedPackage = this.packages().find(pkg => pkg.id === this.filters().packageId);
    if (!selectedPackage || selectedPackage.durationMinutes <= 0) {
      return [];
    }
    return [
      { label: String(selectedPackage.durationMinutes), value: selectedPackage.durationMinutes },
    ];
  });
  readonly calendarDurationMinutes = computed(
    () => this.filters().durationMinutes || SLOT_INTERVAL_MINUTES
  );
  readonly selectedDate = signal<Date>(defaultSelectedDate());
  readonly viewMode = signal<CalendarViewMode>('today');
  readonly selectedSlot = signal<SlotSelection | null>(null);

  readonly bookDialogVisible = signal(false);
  readonly detailsDialogVisible = signal(false);
  readonly mismatchVisible = signal(false);
  readonly cancelConfirmVisible = signal(false);

  readonly activeBookingId = signal<string | null>(null);
  readonly pendingDraft = signal<PendingBookingDraft | null>(null);
  readonly pendingEdit = signal<BookingDetailsSavePayload | null>(null);
  readonly mismatchServiceDuration = signal(0);
  readonly mismatchSlotDuration = signal(0);
  readonly saleHandoffDraft = signal<SaleHandoffDraft | null>(null);
  readonly createRequestKey = signal<string | null>(null);
  private calendarRequestId = 0;
  private customerRequestId = 0;
  private holdRefreshTimer?: ReturnType<typeof setTimeout>;

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

  readonly calendarRange = computed(() => calendarDayRange(this.columns()));

  readonly slotRows = computed(() =>
    buildSlotRows(this.calendarRange().startMinutes, this.calendarRange().endMinutes)
  );

  readonly gridCells = computed(() => {
    const map = new Map<string, CalendarSlotCell[]>();
    const range = this.calendarRange();
    for (const column of this.columns()) {
      const key = `${column.employeeId}|${toDateKey(column.date)}`;
      map.set(
        key,
        buildSlotGrid(
          this.bookings(),
          column.employeeId,
          column.date,
          this.calendarDurationMinutes(),
          column.employee.workingDays,
          range.startMinutes,
          range.endMinutes,
          this.availabilityBlocks()
        )
      );
    }
    return map;
  });

  readonly availableSlots = computed(() => {
    const map = new Map<string, CalendarAvailableSlot[]>();
    for (const column of this.columns()) {
      map.set(
        `${column.employeeId}|${toDateKey(column.date)}`,
        buildAvailableSlots(
          this.bookings(),
          column.employeeId,
          column.date,
          this.calendarDurationMinutes(),
          column.employee.workingDays,
          this.availabilityBlocks()
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
    return this.packages().find(item => item.id === packageId)?.name ?? null;
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
    this.destroyRef.onDestroy(() => {
      if (this.holdRefreshTimer) {
        clearTimeout(this.holdRefreshTimer);
      }
    });
    this.loadBranches();
    this.applySaleHandoff();
  }

  /** Transfers a sale draft into the appointment customer and item selection. */
  private applySaleHandoff(): void {
    const draft = this.saleHandoff.consumeDraft();
    if (!draft) {
      return;
    }
    this.saleHandoffDraft.set(draft);
    this.filters.update(current => ({
      ...current,
      clientName: draft.clientName,
      clientMobile: draft.clientMobile,
    }));
    this.onMobileSearch();
    this.toast.add({
      severity: 'info',
      summary: 'OPERIA',
      detail: this.translate.instant('BOOKINGS.SELL.HANDOFF_HINT'),
    });
  }

  /** Loads only branches available to the signed-in user for booking. */
  private loadBranches(): void {
    this.branchesApi
      .listBookable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          const items = result.map(branch => ({ id: branch.id, name: branch.name }));
          this.branches.set(items);
          const current = this.filters().branchId;
          if (!items.length) {
            this.updateFilter('branchId', null);
            return;
          }
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

  onUnlistedPackageCreated(): void {
    this.loadCatalog();
  }

  private openBookDialog(): void {
    this.loadCatalog();
    this.bookDialogVisible.set(true);
  }

  private openDetailsDialog(bookingId: string): void {
    this.activeBookingId.set(bookingId);
    this.loadCatalog();
    this.detailsDialogVisible.set(true);
  }

  /** Loads catalog items and category choices when a booking dialog opens. */
  private loadCatalog(): void {
    if (!this.permissions.hasPermission(Policies.PackagesRead)) {
      return;
    }

    this.catalogLoading.set(true);
    forkJoin({
      packages: this.packagesApi.listAllActive(),
      categories: this.packagesApi.listServiceCategories(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ packages, categories }) => {
          this.catalogLoading.set(false);
          this.catalogCategories.set(
            categories.map(category => ({
              id: category.id,
              label: category.name,
            }))
          );
          this.catalogItems.set(packages.map(pkg => mapPackageToCatalogItem(pkg, categories)));
        },
        error: () => {
          this.catalogLoading.set(false);
          this.toast.add({
            severity: 'error',
            summary: this.translate.instant('BOOKINGS.TOAST.PACKAGES_LOAD_FAILED'),
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
    if (key === 'clientMobile' && value !== this.filters().clientMobile) {
      this.customerRequestId++;
      this.clients.set([]);
      this.packages.set([]);
      this.selectedSlot.set(null);
      this.filters.update(current => ({
        ...current,
        clientName: '',
        packageId: null,
        durationMinutes: 0,
      }));
    }
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
      this.loadBookings();
    }
    if (key === 'durationMinutes' || key === 'packageId') {
      this.selectedSlot.set(null);
    }
  }

  /** Sets the duration from the chosen owned Package or clears it when none is selected. */
  onPackageSelected(packageId: string | null): void {
    this.updateFilter('packageId', packageId);
    const selectedPackage = this.packages().find(pkg => pkg.id === packageId);
    this.updateFilter('durationMinutes', selectedPackage?.durationMinutes ?? 0);
  }

  /** Loads bookable employees for the selected branch and refreshes calendar selection. */
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
          this.loadBookings();
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

  /** Keeps the current employee if still bookable or chooses an allowed default. */
  private ensureEmployeeSelected(staff: EmployeeOption[] = this.employees()): void {
    const current = this.filters().employeeId;
    if (current && staff.some(employee => employee.id === current)) {
      return;
    }
    this.filters.update(filters => ({ ...filters, employeeId: staff[0]?.id ?? null }));
  }

  /** Converts an API employee and branch assignment into a calendar option. */
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
    this.loadBookings();
  }

  shiftDate(days: number): void {
    this.selectedDate.update(current => addDays(current, days));
    this.loadBookings();
  }

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this.loadBookings();
  }

  cellFor(
    column: { employeeId: string; date: Date },
    startMinutes: number
  ): CalendarSlotCell | undefined {
    const cells = this.gridCells().get(`${column.employeeId}|${toDateKey(column.date)}`);
    return cells?.find(cell => cell.startMinutes === startMinutes);
  }

  availableSlotsForColumn(column: { employeeId: string; date: Date }): CalendarAvailableSlot[] {
    return this.availableSlots().get(`${column.employeeId}|${toDateKey(column.date)}`) ?? [];
  }

  onBookingClick(booking: BookingRecord): void {
    this.openDetailsDialog(booking.id);
  }

  /** Refreshes availability after a conflict or failed calendar request. */
  retryAvailability(): void {
    this.loadBookings();
  }

  private isStartAvailableForDuration(
    employeeId: string,
    date: Date,
    startMinutes: number,
    durationMinutes: number
  ): boolean {
    const employee = this.employees().find(item => item.id === employeeId);
    const hours = hoursForDate(employee?.workingDays ?? [], date);
    return isSlotAvailableForBooking(
      this.bookings(),
      employeeId,
      date,
      startMinutes,
      durationMinutes,
      hours,
      this.availabilityBlocks()
    );
  }

  selectAvailableSlot(
    column: { employeeId: string; date: Date; title: string },
    startMinutes: number
  ): void {
    if (this.calendarLoading() || this.calendarUnavailable()) {
      return;
    }
    const effectiveDuration = this.calendarDurationMinutes();
    if (
      !this.isStartAvailableForDuration(
        column.employeeId,
        column.date,
        startMinutes,
        effectiveDuration
      )
    ) {
      this.notifyDurationBlocked(effectiveDuration);
      return;
    }

    const employee = this.employees().find(item => item.id === column.employeeId);
    const branch = this.selectedBranch();
    const selection: SlotSelection = {
      employeeId: column.employeeId,
      employeeName: employee?.name ?? column.title,
      branchId: branch?.id ?? '',
      branchName: branch?.name ?? '',
      date: column.date,
      startMinutes,
      slotDurationMinutes: effectiveDuration,
    };

    this.selectedSlot.set(selection);

    if (this.isClientFirstReady()) {
      return;
    }

    this.openBookDialog();
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

  /** Finds a registered customer and ignores responses for an older mobile search. */
  onMobileSearch(): void {
    const mobile = this.filters().clientMobile.trim();
    if (!mobile) {
      return;
    }
    const requestId = ++this.customerRequestId;
    this.appointmentsApi
      .findCustomer(mobile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(customer => {
        if (requestId !== this.customerRequestId || mobile !== this.filters().clientMobile.trim()) {
          return;
        }
        if (!customer) {
          this.updateFilter('clientName', '');
          this.clients.set([]);
          this.packages.set([]);
          this.onPackageSelected(null);
          return;
        }
        const client = {
          id: customer.id,
          name: customer.fullName,
          mobile: customer.mobileNumber,
          registered: true,
          packages: customer.packages.map(pkg => ({
            customerPackageId: pkg.customerPackageId,
            packageId: pkg.packageId,
            packageName: pkg.packageName,
            usedSessions: displayedPackageUsedUnits({
              ...pkg,
              offerType: pkg.offerType,
            }),
            totalSessions: pkg.totalSessions,
            expiryDate: pkg.expiresOn ?? '',
            offerType: pkg.offerType,
            sessionCount: pkg.sessionCount,
            pulseCount: pkg.pulseCount,
          })),
        };
        this.clients.set([client]);
        this.packages.set(
          customer.packages
            .filter(
              (pkg, index, all) => all.findIndex(item => item.packageId === pkg.packageId) === index
            )
            .map(pkg => ({
              id: pkg.packageId,
              name: pkg.packageName,
              durationMinutes: pkg.sessionDurationMinutes,
              serviceId: pkg.packageId,
            }))
        );
        this.updateFilter('clientName', client.name);
        const selectedPackageId = this.filters().packageId;
        this.onPackageSelected(
          selectedPackageId && this.packages().some(pkg => pkg.id === selectedPackageId)
            ? selectedPackageId
            : null
        );
      });
  }

  footerSlotTime(): string {
    const slot = this.selectedSlot();
    if (!slot) {
      return '';
    }
    return formatTimeRange(slot.startMinutes, slot.slotDurationMinutes);
  }

  footerSlotDate(): string {
    const slot = this.selectedSlot();
    if (!slot) {
      return '';
    }
    return slot.date.toLocaleDateString(this.languageService.currentLang(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  onFooterCancel(): void {
    this.selectedSlot.set(null);
  }

  onFooterConfirm(): void {
    const slot = this.selectedSlot();
    if (!slot || !this.canManage() || !this.isClientFirstReady()) {
      return;
    }

    this.openBookDialog();
  }

  onBookDialogConfirm(payload: BookAppointmentPayload): void {
    this.tryCreateBooking(payload);
  }

  /** Rechecks the chosen interval and opens duration mismatch confirmation when needed. */
  private tryCreateBooking(payload: PendingBookingDraft): void {
    if (
      !this.isStartAvailableForDuration(
        payload.selection.employeeId,
        payload.selection.date,
        payload.selection.startMinutes,
        payload.selection.slotDurationMinutes
      )
    ) {
      this.notifyDurationBlocked(payload.selection.slotDurationMinutes);
      return;
    }
    if (payload.serviceDuration > payload.selection.slotDurationMinutes) {
      this.pendingDraft.set(payload);
      this.mismatchServiceDuration.set(payload.serviceDuration);
      this.mismatchSlotDuration.set(payload.selection.slotDurationMinutes);
      this.mismatchVisible.set(true);
      return;
    }
    this.commitBooking(payload);
  }

  onMismatchConfirm(): void {
    const edit = this.pendingEdit();
    if (edit) {
      this.commitBookingEdit(edit);
      this.pendingEdit.set(null);
      this.mismatchVisible.set(false);
      return;
    }
    const draft = this.pendingDraft();
    if (!draft) {
      return;
    }
    this.commitBooking(draft);
    this.pendingDraft.set(null);
    this.mismatchVisible.set(false);
  }

  onMismatchBack(): void {
    this.mismatchVisible.set(false);
    this.pendingDraft.set(null);
    this.pendingEdit.set(null);
  }

  /** Sends a registered customer's booking with an idempotency key and current selections. */
  private commitBooking(payload: PendingBookingDraft): void {
    if (!payload.clientId) {
      this.showToast('BOOKINGS.BOOK.CUSTOMER_NOT_REGISTERED', 'error');
      return;
    }

    const items = payload.lineItems
      .filter(item => !!item.catalogPackageId)
      .map(item => mapBookingLineToApiItem(item, payload.lineItems));
    if (items.length !== payload.lineItems.length) {
      this.showToast('BOOKINGS.BOOK.INVALID_SELECTION', 'error');
      return;
    }

    const requestKey = this.createRequestKey() ?? crypto.randomUUID();
    this.createRequestKey.set(requestKey);
    this.appointmentsApi
      .create({
        idempotencyKey: requestKey,
        customerId: payload.clientId,
        branchId: payload.selection.branchId,
        employeeId: payload.selection.employeeId,
        scheduledDate: toDateKey(payload.selection.date),
        startMinutes: payload.selection.startMinutes,
        endMinutes: payload.selection.startMinutes + payload.selection.slotDurationMinutes,
        items,
        paymentMethod: payload.paymentMethod,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.createRequestKey.set(null);
          this.bookDialogVisible.set(false);
          this.selectedSlot.set(null);
          this.saleHandoffDraft.set(null);
          this.loadBookings();
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('BOOKINGS.TOAST.BOOKED'),
            detail: this.translate.instant('BOOKINGS.TOAST.BOOKED_NUMBER', {
              number: result.bookingNumber,
            }),
          });
        },
        error: error => this.handleMutationError(error),
      });
  }

  /** Loads visible bookings and holds, discarding stale calendar responses. */
  private loadBookings(): void {
    const requestId = ++this.calendarRequestId;
    this.calendarLoading.set(true);
    this.calendarUnavailable.set(false);
    this.clearHoldRefresh();
    const branchId = this.filters().branchId;
    if (!branchId) {
      this.bookings.set([]);
      this.availabilityBlocks.set([]);
      this.calendarLoading.set(false);
      return;
    }
    const from = this.selectedDate();
    const to = this.viewMode() === '4days' ? addDays(from, 3) : from;
    this.appointmentsApi
      .calendar(branchId, toDateKey(from), toDateKey(to), this.filters().employeeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (requestId !== this.calendarRequestId) {
            return;
          }
          this.calendarLoading.set(false);
          this.bookings.set(result.bookings.map(mapCalendarBooking));
          const holds = result.holds.map(hold => ({
            id: hold.id,
            employeeId: hold.employeeId,
            scheduledDate: new Date(`${hold.scheduledDate}T00:00:00`),
            startMinutes: hold.startMinutes,
            endMinutes: hold.endMinutes,
            expiresAtUtc: new Date(hold.expiresAtUtc),
          }));
          this.availabilityBlocks.set(holds);
          this.scheduleHoldRefresh(holds, new Date(result.serverNowUtc));
        },
        error: () => {
          if (requestId !== this.calendarRequestId) {
            return;
          }
          this.calendarLoading.set(false);
          this.calendarUnavailable.set(true);
          this.bookings.set([]);
          this.availabilityBlocks.set([]);
        },
      });
  }

  /** Checks an edited item's duration against the booking interval before saving. */
  onDetailsSaved(payload: BookingDetailsSavePayload): void {
    const booking = this.bookings().find(item => item.id === payload.bookingId);
    if (!booking?.version) {
      return;
    }
    const serviceDuration = sumLineItemDuration(payload.lineItems);
    if (serviceDuration > booking.slotDurationMinutes) {
      this.pendingEdit.set(payload);
      this.mismatchServiceDuration.set(serviceDuration);
      this.mismatchSlotDuration.set(booking.slotDurationMinutes);
      this.mismatchVisible.set(true);
      return;
    }
    this.commitBookingEdit(payload);
  }

  /** Sends item and payment changes using the booking's current version. */
  private commitBookingEdit(payload: BookingDetailsSavePayload): void {
    const booking = this.bookings().find(item => item.id === payload.bookingId);
    if (!booking?.version) {
      return;
    }
    if (payload.lineItems.length === 0) {
      this.toast.add({
        severity: 'error',
        summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
        detail: this.translate.instant('ERRORS.BookingItemsRequired'),
      });
      return;
    }
    const items = payload.lineItems
      .filter(item => !!item.catalogPackageId)
      .map(item => mapBookingLineToApiItem(item, payload.lineItems));
    if (items.length !== payload.lineItems.length) {
      this.showToast('BOOKINGS.BOOK.INVALID_SELECTION', 'error');
      return;
    }
    this.appointmentsApi
      .update(booking.id, booking.version, items, payload.paymentMethod)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadBookings();
          this.showToast('BOOKINGS.TOAST.SAVED');
        },
        error: error => this.handleMutationError(error),
      });
  }

  onDetailsDialogClosed(): void {
    this.detailsDialogVisible.set(false);
  }

  onDetailsBookingClosed(): void {
    this.detailsDialogVisible.set(false);
    this.loadBookings();
  }

  onDetailsCancelRequest(bookingId: string): void {
    this.activeBookingId.set(bookingId);
    this.cancelConfirmVisible.set(true);
  }

  /** Cancels the selected booking with its version and reloads calendar availability. */
  onCancelConfirmed(): void {
    const bookingId = this.activeBookingId();
    const booking = this.activeBooking();
    if (!bookingId || !booking?.version) {
      return;
    }
    this.appointmentsApi
      .cancel(bookingId, booking.version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelConfirmVisible.set(false);
          this.detailsDialogVisible.set(false);
          this.loadBookings();
          this.showToast('BOOKINGS.TOAST.CANCELLED');
        },
        error: error => this.handleMutationError(error),
      });
  }

  formatTime(minutes: number): string {
    return formatMinutesAsTime(minutes);
  }

  bookingTop(startMinutes: number): number {
    return (
      bookingBlockTopPx(startMinutes, this.calendarRange().startMinutes) + BOOKING_OVERLAY_GAP_PX
    );
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
    return cell.visual === 'closed' || cell.visual === 'held';
  }

  bookingTimeLabel(booking: BookingRecord): string {
    return formatTimeRange(booking.startMinutes, booking.slotDurationMinutes);
  }

  formatTimeRangeFor(startMinutes: number, durationMinutes: number): string {
    return formatTimeRange(startMinutes, durationMinutes);
  }

  private notifyDurationBlocked(durationMinutes: number): void {
    this.toast.add({
      severity: 'warn',
      summary: this.translate.instant('BOOKINGS.TOAST.SLOT_DURATION_BLOCKED', {
        duration: durationMinutes,
      }),
    });
  }

  /** Refreshes the calendar after a write failure and shows translated field errors. */
  private handleMutationError(error: unknown): void {
    this.loadBookings();
    if (!(error instanceof HttpErrorResponse) || ![400, 422].includes(error.status)) {
      return;
    }
    const translated = translateApiFieldErrors(extractApiFieldErrors(error), key =>
      this.translate.instant(key)
    );
    const detail = Object.values(translated).filter(Boolean).join(' ');
    if (detail) {
      this.toast.add({
        severity: 'error',
        summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
        detail,
      });
    }
  }

  /** Cancels a pending hold-expiry calendar refresh. */
  private clearHoldRefresh(): void {
    if (this.holdRefreshTimer) {
      clearTimeout(this.holdRefreshTimer);
      this.holdRefreshTimer = undefined;
    }
  }

  /** Reloads availability when the earliest visible hold should expire. */
  private scheduleHoldRefresh(holds: AppointmentAvailabilityBlock[], serverNowUtc: Date): void {
    this.clearHoldRefresh();
    const expiries = holds
      .map(hold => hold.expiresAtUtc?.getTime())
      .filter((value): value is number => value !== undefined && Number.isFinite(value));
    if (!expiries.length) {
      return;
    }
    const delay = Math.max(
      Math.min(Math.min(...expiries) - serverNowUtc.getTime() + 50, 2_147_483_647),
      0
    );
    this.holdRefreshTimer = setTimeout(() => this.loadBookings(), delay);
  }

  private showToast(key: string, severity: 'success' | 'error' = 'success'): void {
    this.toast.add({
      severity,
      summary: this.translate.instant(key),
    });
  }
}
