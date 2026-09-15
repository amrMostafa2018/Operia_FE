import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  BookingRegisterRow,
  MOCK_BOOKING_REGISTER_EMPLOYEES,
  MOCK_BOOKING_REGISTER_ROWS,
  buildRegisterHistory,
  computeRegisterSummary,
  filterRegisterRows,
  registerServiceTypeKey,
  registerStatusKey,
  registerStatusSeverity,
} from './models/booking-register.model';
import { BookingRegisterDetailsDialogComponent } from './booking-register-details-dialog/booking-register-details-dialog.component';
import { ChangeHistoryDialogComponent } from './change-history-dialog/change-history-dialog.component';

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
    BookingRegisterDetailsDialogComponent,
    ChangeHistoryDialogComponent,
  ],
  templateUrl: './booking-register.component.html',
  styleUrl: './booking-register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRegisterComponent {
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canRead = computed(() => this.permissions.hasPermission(Policies.BookingsRead));
  readonly leadingIconPos = computed(() => getLeadingIconPos(this.languageService.currentLang()));

  readonly rowsPerPageOptions = BOOKING_REGISTER_PAGE_SIZES;
  readonly statusOptions = BOOKING_REGISTER_STATUS_OPTIONS;
  readonly employees = MOCK_BOOKING_REGISTER_EMPLOYEES;

  readonly draftDateFrom = signal<Date | null>(new Date(2025, 5, 1));
  readonly draftDateTo = signal<Date | null>(new Date(2025, 5, 10));
  readonly draftMobile = signal('');
  readonly draftCustomerName = signal('');
  readonly draftEmployeeId = signal<string | null>(null);
  readonly draftStatus = signal<(typeof BOOKING_REGISTER_STATUS_OPTIONS)[number]['value']>(null);

  readonly appliedFilters = signal<BookingRegisterFilters>(this.buildFiltersFromDraft());

  readonly allRows = signal<BookingRegisterRow[]>(
    MOCK_BOOKING_REGISTER_ROWS.map(row => ({ ...row }))
  );

  readonly filteredRows = computed(() =>
    filterRegisterRows(this.allRows(), this.appliedFilters())
  );

  readonly summary = computed(() => computeRegisterSummary(this.filteredRows()));

  readonly rows = signal(5);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(this.translate.instant('BOOKING_REGISTER.TABLE.PAGE_REPORT'));

  readonly detailsOpen = signal(false);
  readonly historyOpen = signal(false);
  readonly selectedBooking = signal<BookingRegisterRow | null>(null);
  readonly historyEvents = computed(() => {
    const booking = this.selectedBooking();
    return booking ? buildRegisterHistory(booking) : [];
  });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('BOOKING_REGISTER.TABLE.PAGE_REPORT'));
    });
  }

  employeeOptions(): { label: string; value: string | null }[] {
    return [
      { label: 'BOOKING_REGISTER.FILTER.ALL_EMPLOYEES', value: null },
      ...this.employees.map(employee => ({ label: employee.fullName, value: employee.id })),
    ];
  }

  applyFilters(): void {
    this.appliedFilters.set(this.buildFiltersFromDraft());
    this.first.set(0);
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
    this.draftDateFrom.set(new Date(2025, 5, 1));
    this.draftDateTo.set(new Date(2025, 5, 10));
    this.draftMobile.set('');
    this.draftCustomerName.set('');
    this.draftEmployeeId.set(null);
    this.draftStatus.set(null);
    this.applyFilters();
  }

  rowNumber(index: number): number {
    return this.first() + index + 1;
  }

  exportReport(): void {
    this.toast.add({
      severity: 'info',
      summary: 'OPERIA',
      detail: this.translate.instant('BOOKING_REGISTER.EXPORT_PENDING'),
      life: 4000,
    });
  }

  onPageChange(event: { first?: number; rows?: number | null }): void {
    if (event.first != null) {
      this.first.set(event.first);
    }
    if (event.rows != null) {
      this.rows.set(event.rows);
    }
  }

  openDetails(booking: BookingRegisterRow): void {
    this.selectedBooking.set(booking);
    this.detailsOpen.set(true);
  }

  closeDetails(): void {
    this.detailsOpen.set(false);
    this.selectedBooking.set(null);
  }

  openHistory(booking: BookingRegisterRow): void {
    this.selectedBooking.set(booking);
    this.historyOpen.set(true);
  }

  closeHistory(): void {
    this.historyOpen.set(false);
    this.selectedBooking.set(null);
  }

  onStatusConfirmed(bookingId: string): void {
    this.allRows.update(rows =>
      rows.map(row => (row.id === bookingId ? { ...row, status: 'confirm' } : row))
    );
    const selected = this.selectedBooking();
    if (selected?.id === bookingId) {
      this.selectedBooking.set({ ...selected, status: 'confirm' });
    }
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
}
