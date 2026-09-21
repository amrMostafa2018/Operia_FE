import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MenuItem, MessageService } from 'primeng/api';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { LanguageService } from '@core/services/language.service';
import { getLeadingIconPos } from '@app/shared/utils/rtl.util';
import {
  BOOKING_REGISTER_PAGE_SIZES,
  BOOKING_REGISTER_STATUS_OPTIONS,
  BookingRegisterFilters,
  BookingRegisterHistoryEvent,
  BookingRegisterRow,
  registerServiceTypeKey,
  registerStatusKey,
  registerStatusSeverity,
} from './models/booking-register.model';
import { AppointmentsApiService, BookingListItemDto } from '../bookings/appointments-api.service';
import { formatMinutesAsTime, toDateKey } from '../bookings/models/booking.model';
import { ChangeHistoryDialogComponent } from './change-history-dialog/change-history-dialog.component';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import {
  BookingDetailsDialogComponent,
  BookingDetailsSavePayload,
} from '../bookings/booking-details-dialog.component';
import { DurationMismatchDialogComponent } from '../bookings/duration-mismatch-dialog.component';
import { PackageService } from '../packages/package.service';
import { BranchService } from '../branches/branch.service';
import { EmployeeService } from '../employees/employee.service';
import { extractApiFieldErrors, translateApiFieldErrors } from '@core/utils/api-error.util';
import { mapPackageToCatalogItem } from '../bookings/booking-catalog.util';
import { mapCalendarBooking } from '../bookings/booking-record.mapper';
import {
  BookingRecord,
  CatalogCategoryTab,
  ServiceCatalogItem,
  sumLineItemDuration,
} from '../bookings/models/booking.model';

/** Loads the booking register and coordinates filtering, export, details, history, and cancellation. */
@Component({
  selector: 'app-booking-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    InputTextModule,
    MenuModule,
    TableModule,
    TagModule,
    BookingDetailsDialogComponent,
    DurationMismatchDialogComponent,
    ChangeHistoryDialogComponent,
    ConfirmActionDialogComponent,
  ],
  templateUrl: './booking-register.component.html',
  styleUrl: './booking-register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRegisterComponent {
  private readonly permissions = inject(PermissionService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly toast = inject(MessageService);
  private readonly packagesApi = inject(PackageService);
  private readonly branchesApi = inject(BranchService);
  private readonly employeesApi = inject(EmployeeService);
  private rowsRequestId = 0;

  readonly canRead = computed(() => this.permissions.hasPermission(Policies.BookingsRead));
  readonly leadingIconPos = computed(() => getLeadingIconPos(this.languageService.currentLang()));

  readonly rowsPerPageOptions = BOOKING_REGISTER_PAGE_SIZES;
  readonly statusOptions = BOOKING_REGISTER_STATUS_OPTIONS;
  readonly employees = signal<{ id: string; fullName: string }[]>([]);

  readonly draftDateFrom = signal<Date | null>(this.monthStart());
  readonly draftDateTo = signal<Date | null>(new Date());
  readonly draftMobile = signal('');
  readonly draftCustomerName = signal('');
  readonly draftEmployeeId = signal<string | null>(null);
  readonly draftStatus = signal<(typeof BOOKING_REGISTER_STATUS_OPTIONS)[number]['value']>(null);

  readonly appliedFilters = signal<BookingRegisterFilters>(this.buildFiltersFromDraft());

  readonly filteredRows = signal<BookingRegisterRow[]>([]);
  readonly summary = signal({ total: 0, cancelled: 0, completed: 0, booked: 0 });
  readonly totalRecords = signal(0);

  readonly rows = signal(5);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(
    this.translate.instant('BOOKING_REGISTER.TABLE.PAGE_REPORT')
  );

  readonly detailsOpen = signal(false);
  readonly historyOpen = signal(false);
  readonly cancelConfirmOpen = signal(false);
  readonly selectedBooking = signal<BookingRegisterRow | null>(null);
  readonly selectedBookingRecord = signal<BookingRecord | null>(null);
  readonly historyEvents = signal<BookingRegisterHistoryEvent[]>([]);
  readonly catalogItems = signal<ServiceCatalogItem[]>([]);
  readonly catalogCategories = signal<CatalogCategoryTab[]>([]);
  readonly pendingEdit = signal<BookingDetailsSavePayload | null>(null);
  readonly mismatchOpen = signal(false);
  readonly mismatchServiceDuration = signal(0);
  readonly mismatchSlotDuration = signal(0);

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('BOOKING_REGISTER.TABLE.PAGE_REPORT'));
    });
    if (this.permissions.hasPermission(Policies.PackagesRead)) {
      this.loadCatalog();
    }
    this.loadEmployeeOptions();
    this.loadRows();
  }

  employeeOptions(): { label: string; value: string | null }[] {
    return [
      { label: 'BOOKING_REGISTER.FILTER.ALL_EMPLOYEES', value: null },
      ...this.employees().map(employee => ({ label: employee.fullName, value: employee.id })),
    ];
  }

  applyFilters(): void {
    this.appliedFilters.set(this.buildFiltersFromDraft());
    this.first.set(0);
    this.loadRows();
  }

  onDateFromChange(value: Date | null): void {
    this.draftDateFrom.set(value);
    this.applyFilters();
  }

  onDateToChange(value: Date | null): void {
    this.draftDateTo.set(value);
    this.applyFilters();
  }

  onMobileChange(value: string): void {
    this.draftMobile.set(value);
    this.applyFilters();
  }

  onCustomerChange(value: string): void {
    this.draftCustomerName.set(value);
    this.applyFilters();
  }

  onEmployeeChange(value: string | null): void {
    this.draftEmployeeId.set(value);
    this.applyFilters();
  }

  onStatusChange(value: (typeof BOOKING_REGISTER_STATUS_OPTIONS)[number]['value']): void {
    this.draftStatus.set(value);
    this.applyFilters();
  }

  clearFilters(): void {
    this.draftDateFrom.set(this.monthStart());
    this.draftDateTo.set(new Date());
    this.draftMobile.set('');
    this.draftCustomerName.set('');
    this.draftEmployeeId.set(null);
    this.draftStatus.set(null);
    this.applyFilters();
  }

  rowNumber(index: number): number {
    return this.first() + index + 1;
  }

  /** Exports the currently applied register filters as a CSV download. */
  exportReport(): void {
    const filters = this.appliedFilters();
    if (!filters.dateFrom || !filters.dateTo || filters.dateTo < filters.dateFrom) {
      return;
    }
    const fromDate = toDateKey(filters.dateFrom);
    const toDate = toDateKey(filters.dateTo);
    this.appointmentsApi
      .export({
        fromDate,
        toDate,
        customerMobile: filters.mobile.trim(),
        customerName: filters.customerName.trim(),
        employeeId: filters.employeeId,
        status: filters.status,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(blob => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `bookings-${fromDate}-${toDate}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
      });
  }

  onPageChange(event: { first?: number; rows?: number | null }): void {
    if (event.first != null) {
      this.first.set(event.first);
    }
    if (event.rows != null) {
      this.rows.set(event.rows);
    }
    this.loadRows();
  }

  /** Loads the full booking record for the selected register row. */
  openDetails(booking: BookingRegisterRow): void {
    this.selectedBooking.set(booking);
    const date = toDateKey(booking.scheduledDate);
    this.appointmentsApi
      .calendar(booking.branchId, date, date, booking.employeeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        const record = result.bookings.find(item => item.id === booking.id);
        if (!record || this.selectedBooking()?.id !== booking.id) {
          return;
        }
        this.selectedBookingRecord.set(mapCalendarBooking(record));
        this.detailsOpen.set(true);
      });
  }

  closeDetails(): void {
    this.detailsOpen.set(false);
    this.selectedBooking.set(null);
    this.selectedBookingRecord.set(null);
  }

  /** Opens cancellation confirmation only for the selected Booked record. */
  requestCancellation(bookingId: string): void {
    const booking = this.selectedBooking();
    if (booking?.id === bookingId && booking.status === 'booked') {
      this.cancelConfirmOpen.set(true);
    }
  }

  /** Cancels the selected register booking using its current version. */
  confirmCancellation(): void {
    const booking = this.selectedBookingRecord();
    if (!booking?.version || booking.status !== 'booked') {
      this.cancelConfirmOpen.set(false);
      return;
    }
    this.appointmentsApi
      .cancel(booking.id, booking.version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelConfirmOpen.set(false);
          this.closeDetails();
          this.loadRows();
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('BOOKING_REGISTER.DETAILS.CANCELLED'),
          });
        },
        error: error => {
          this.showApiFieldErrors(error);
          this.loadRows();
        },
      });
  }

  /** Checks an edited item's duration against the booking interval before saving. */
  onDetailsSaved(payload: BookingDetailsSavePayload): void {
    const booking = this.selectedBookingRecord();
    if (!booking?.version || booking.id !== payload.bookingId) {
      return;
    }
    const serviceDuration = sumLineItemDuration(payload.lineItems);
    if (serviceDuration > booking.slotDurationMinutes) {
      this.pendingEdit.set(payload);
      this.mismatchServiceDuration.set(serviceDuration);
      this.mismatchSlotDuration.set(booking.slotDurationMinutes);
      this.mismatchOpen.set(true);
      return;
    }
    this.commitBookingEdit(payload);
  }

  confirmMismatchEdit(): void {
    const edit = this.pendingEdit();
    if (edit) {
      this.commitBookingEdit(edit);
    }
    this.clearMismatchEdit();
  }

  clearMismatchEdit(): void {
    this.mismatchOpen.set(false);
    this.pendingEdit.set(null);
  }

  onCatalogChanged(): void {
    this.loadCatalog();
  }

  /** Loads recorded booking changes for the selected register row. */
  openHistory(booking: BookingRegisterRow): void {
    this.selectedBooking.set(booking);
    this.appointmentsApi
      .history(booking.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(events => {
        this.historyEvents.set(
          events.map(event => ({
            id: event.id,
            type:
              event.action === 'Created'
                ? 'created'
                : event.action === 'Cancelled'
                  ? 'cancelled'
                  : 'updated',
            actorName: event.changedByDisplayName ?? '—',
            timestamp: new Date(event.occurredAt),
            ...this.historyDescription(event.action, event.changesJson),
            markerClass:
              event.action === 'Created' ? 'history-marker--created' : 'history-marker--status',
          }))
        );
        this.historyOpen.set(true);
      });
  }

  closeHistory(): void {
    this.historyOpen.set(false);
    this.historyEvents.set([]);
    this.selectedBooking.set(null);
  }

  getRowMenu(booking: BookingRegisterRow): MenuItem[] {
    if (!this.canRead()) {
      return [];
    }

    return [
      {
        label: this.translate.instant('BOOKING_REGISTER.MENU.DETAILS'),
        icon: 'pi pi-eye',
        command: () => this.openDetails(booking),
      },
      {
        label: this.translate.instant('BOOKING_REGISTER.MENU.HISTORY'),
        icon: 'pi pi-history',
        command: () => this.openHistory(booking),
      },
    ];
  }

  customerInitial(name: string): string {
    return name.trim().charAt(0) || '?';
  }

  statusKey = registerStatusKey;
  statusSeverity = registerStatusSeverity;
  serviceTypeKey = registerServiceTypeKey;

  /** Normalizes the register filter controls into an applied API filter set. */
  private buildFiltersFromDraft(): BookingRegisterFilters {
    return {
      dateFrom: this.draftDateFrom(),
      dateTo: this.draftDateTo(),
      mobile: this.draftMobile(),
      customerName: this.draftCustomerName(),
      employeeId: this.draftEmployeeId(),
      status: this.draftStatus(),
    };
  }

  /** Loads filtered register rows and summary from the booking API. */
  private loadRows(): void {
    const requestId = ++this.rowsRequestId;
    const filters = this.appliedFilters();
    if (!filters.dateFrom || !filters.dateTo || filters.dateTo < filters.dateFrom) {
      this.filteredRows.set([]);
      this.totalRecords.set(0);
      this.summary.set({ total: 0, booked: 0, completed: 0, cancelled: 0 });
      return;
    }
    this.appointmentsApi
      .list({
        fromDate: toDateKey(filters.dateFrom),
        toDate: toDateKey(filters.dateTo),
        pageNumber: Math.floor(this.first() / this.rows()) + 1,
        pageSize: this.rows(),
        customerMobile: filters.mobile.trim(),
        customerName: filters.customerName.trim(),
        employeeId: filters.employeeId,
        status: filters.status,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (requestId !== this.rowsRequestId) {
            return;
          }
          const rows = result.items.map((item, index) =>
            this.toRegisterRow(item, (result.pageNumber - 1) * result.pageSize + index + 1)
          );
          this.filteredRows.set(rows);
          this.totalRecords.set(result.totalCount);
          this.summary.set(result.summary);
        },
        error: error => {
          if (requestId !== this.rowsRequestId) {
            return;
          }
          this.filteredRows.set([]);
          this.totalRecords.set(0);
          this.showApiFieldErrors(error);
        },
      });
  }

  /** Sends item and payment changes using the booking's current version. */
  private commitBookingEdit(payload: BookingDetailsSavePayload): void {
    const booking = this.selectedBookingRecord();
    if (!booking?.version || booking.id !== payload.bookingId) {
      return;
    }
    const items = payload.lineItems
      .filter(item => !!item.catalogPackageId)
      .map(item => ({
        packageId: item.catalogPackageId!,
        customerPackageId: item.customerPackageId ?? null,
        quantity: item.quantity,
      }));
    if (items.length !== payload.lineItems.length) {
      return;
    }
    this.appointmentsApi
      .update(booking.id, booking.version, items, payload.paymentMethod)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closeDetails();
          this.loadRows();
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('BOOKINGS.TOAST.SAVED'),
          });
        },
        error: error => {
          this.showApiFieldErrors(error);
          this.loadRows();
        },
      });
  }

  /** Loads current catalog items and category choices for booking edits. */
  private loadCatalog(): void {
    forkJoin({
      packages: this.packagesApi.listAllActive(),
      categories: this.packagesApi.listServiceCategories(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ packages, categories }) => {
        this.catalogCategories.set(
          categories.map(category => ({ id: category.id, label: category.name }))
        );
        this.catalogItems.set(packages.map(pkg => mapPackageToCatalogItem(pkg, categories)));
      });
  }

  private loadEmployeeOptions(): void {
    this.branchesApi
      .listBookable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(branches => {
        if (!branches.length) {
          this.employees.set([]);
          return;
        }
        forkJoin(branches.map(branch => this.employeesApi.listBookable(branch.id)))
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(results => {
            const employees = new Map<string, { id: string; fullName: string }>();
            for (const result of results) {
              for (const employee of result) {
                employees.set(employee.id, { id: employee.id, fullName: employee.fullName });
              }
            }
            this.employees.set(
              [...employees.values()].sort((left, right) =>
                left.fullName.localeCompare(right.fullName)
              )
            );
          });
      });
  }

  private historyDescription(
    action: string,
    changesJson: string | null
  ): Pick<BookingRegisterHistoryEvent, 'descriptionKey' | 'descriptionParams'> {
    if (action === 'Created') {
      return { descriptionKey: 'BOOKING_REGISTER.HISTORY.CREATED_DESC' };
    }
    if (action === 'Cancelled') {
      return { descriptionKey: 'BOOKING_REGISTER.HISTORY.CANCELLED_DESC' };
    }
    try {
      const changes = JSON.parse(changesJson ?? '{}') as {
        Before?: { Name?: string; Quantity?: number }[];
        After?: { Name?: string; Quantity?: number }[];
      };
      const format = (items: { Name?: string; Quantity?: number }[] | undefined) =>
        items?.map(item => `${item.Name ?? '—'} ×${item.Quantity ?? 0}`).join(', ') || '—';
      return {
        descriptionKey: 'BOOKING_REGISTER.HISTORY.UPDATED_DESC',
        descriptionParams: {
          from: format(changes.Before),
          to: format(changes.After),
        },
      };
    } catch {
      return { descriptionKey: 'BOOKING_REGISTER.HISTORY.UPDATED_DESC_FALLBACK' };
    }
  }

  /** Shows localized validation messages returned by the booking API. */
  private showApiFieldErrors(error: unknown): void {
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

  /** Maps an API booking row into the register's display model. */
  private toRegisterRow(item: BookingListItemDto, rowNumber: number): BookingRegisterRow {
    return {
      id: item.id,
      rowNumber,
      bookingCode: item.bookingNumber,
      customerPhone: item.customerMobile,
      customerName: item.customerName,
      serviceName: item.service,
      serviceType:
        item.serviceType === 'PackageSession'
          ? 'package'
          : item.serviceType === 'UnlistedService'
            ? 'unlisted'
            : 'session',
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      branchId: item.branchId,
      branchName: item.branchName,
      scheduledDate: new Date(`${item.scheduledDate}T00:00:00`),
      startTime: formatMinutesAsTime(item.startMinutes),
      endTime: formatMinutesAsTime(item.endMinutes),
      durationMinutes: item.endMinutes - item.startMinutes,
      status: item.status.toLowerCase() as BookingRegisterRow['status'],
      paymentMethodKey: item.paymentMethod
        ? `BOOKINGS.PAYMENT.${item.paymentMethod.toUpperCase()}`
        : 'BOOKINGS.PAYMENT.CASH',
      paidAmount: item.paidAmount,
      discountAmount: item.discountAmount,
      totalAmount: item.totalAmount,
      notesCount: 0,
      version: item.version,
    };
  }

  private monthStart(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
}
