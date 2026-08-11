import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/services/language.service';
import { getNextChevronIcon, getPrevChevronIcon } from '@app/shared/utils/rtl.util';
import { formatAppTimeString, getAppDateLocale } from '@app/shared/utils/time-format.util';
import { bookingStatusKey } from '@app/shared/utils/status-tag.util';
import { Booking, BookingStatus } from '../models/booking.model';
import {
  buildWeekDays,
  buildHourLanes,
  bookingsInHour,
  CalendarSlotDuration,
  CalendarSlotSelection,
  CALENDAR_SLOT_DURATION_OPTIONS,
  CALENDAR_SLOT_HEIGHT_PX,
  CalendarViewMode,
  formatPeriodTitle,
  rectInHour,
  addDays,
  toIsoDate,
  snapTimeFromClick,
  hasSlotCollision,
  formatTime,
  parseTimeToMinutes,
} from './bookings-calendar.utils';
import { WorkingHoursService } from '../working-hours.service';

export interface DisplayHourLane {
  hour: number;
  label: string;
  height: number;
  bookings: Booking[];
}

@Component({
  selector: 'app-bookings-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './bookings-calendar.component.html',
  styleUrl: './bookings-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingsCalendarComponent {
  private readonly workingHours = inject(WorkingHoursService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly bookings = input<Booking[]>([]);
  readonly loading = input(false);
  readonly canManage = input(false);

  readonly bookingSelected = output<Booking>();
  readonly addBookingRequested = output<CalendarSlotSelection>();
  readonly refreshRequested = output<void>();

  readonly viewMode = signal<CalendarViewMode>('day');
  readonly currentDate = signal(new Date());
  readonly searchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly selectedSlot = signal<CalendarSlotSelection | null>(null);
  readonly slotError = signal('');
  readonly slotDuration = signal<CalendarSlotDuration>(30);

  readonly durationOptions = CALENDAR_SLOT_DURATION_OPTIONS;

  readonly prevChevronIcon = computed(() =>
    getPrevChevronIcon(this.languageService.currentLang())
  );

  readonly nextChevronIcon = computed(() =>
    getNextChevronIcon(this.languageService.currentLang())
  );

  readonly gridBounds = computed(() => {
    this.workingHours.settings();
    return this.workingHours.getGridBounds();
  });

  readonly dayBounds = computed(() => {
    this.workingHours.settings();
    return this.workingHours.getDayBounds(this.currentDate());
  });

  readonly hourRange = computed(() => {
    const mode = this.viewMode();
    if (mode === 'day') {
      const bounds = this.dayBounds();
      if (!bounds.enabled) return { startHour: 0, endHour: -1 };
      return { startHour: bounds.startHour, endHour: bounds.endHour };
    }
    const { startHour, endHour } = this.gridBounds();
    return { startHour, endHour };
  });

  readonly filteredBookings = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.bookings();
    if (!q) return all;
    return all.filter(
      b =>
        b.customerName.toLowerCase().includes(q) ||
        b.customerPhone.includes(q) ||
        b.bookingNumber.includes(q) ||
        b.employeeName.toLowerCase().includes(q)
    );
  });

  readonly weekDays = computed(() => buildWeekDays(this.currentDate(), this.currentDate()));

  readonly dayBookings = computed(() =>
    this.filteredBookings().filter(b => b.date === toIsoDate(this.currentDate()))
  );

  readonly dayHourLanes = computed((): DisplayHourLane[] => {
    const lang = this.languageService.currentLang();
    const { startHour, endHour } = this.hourRange();
    const bookings = this.dayBookings();
    return buildHourLanes(startHour, endHour).map(lane => ({
      hour: lane.hour,
      label: formatAppTimeString(lane.label24, lang),
      height: CALENDAR_SLOT_HEIGHT_PX,
      bookings: bookingsInHour(bookings, lane.hour),
    }));
  });

  readonly weekHourLanes = computed((): DisplayHourLane[] => {
    const lang = this.languageService.currentLang();
    const { startHour, endHour } = this.hourRange();
    return buildHourLanes(startHour, endHour).map(lane => ({
      hour: lane.hour,
      label: formatAppTimeString(lane.label24, lang),
      height: CALENDAR_SLOT_HEIGHT_PX,
      bookings: [],
    }));
  });

  readonly isClosedDay = computed(
    () => this.viewMode() === 'day' && !this.dayBounds().enabled
  );

  readonly workingHoursLabel = computed(() => {
    const bounds = this.dayBounds();
    if (!bounds.enabled) return '';
    return `${bounds.fromTime} – ${bounds.toTime}`;
  });

  readonly workingHoursFrom = computed(() =>
    formatAppTimeString(this.dayBounds().fromTime, this.languageService.currentLang())
  );

  readonly workingHoursTo = computed(() =>
    formatAppTimeString(this.dayBounds().toTime, this.languageService.currentLang())
  );

  readonly periodTitle = computed(() =>
    formatPeriodTitle(
      this.currentDate(),
      this.viewMode(),
      getAppDateLocale(this.languageService.currentLang())
    )
  );

  readonly weekdayHeaders = computed(() => {
    const locale = getAppDateLocale(this.languageService.currentLang());
    const weekStart = addDays(this.currentDate(), -this.currentDate().getDay());
    return Array.from({ length: 7 }, (_, i) =>
      addDays(weekStart, i).toLocaleDateString(locale, { weekday: 'short' })
    );
  });

  setView(mode: CalendarViewMode): void {
    this.viewMode.set(mode);
  }

  goToday(): void {
    this.currentDate.set(new Date());
  }

  goPrev(): void {
    const step = this.viewMode() === 'day' ? 1 : 7;
    this.currentDate.set(addDays(this.currentDate(), -step));
  }

  goNext(): void {
    const step = this.viewMode() === 'day' ? 1 : 7;
    this.currentDate.set(addDays(this.currentDate(), step));
  }

  onHourLaneClick(event: MouseEvent, date: Date, hour: number): void {
    if (!this.canManage()) return;
    const bounds = this.workingHours.getDayBounds(date);
    if (!bounds.enabled) {
      this.slotError.set('BOOKINGS.CALENDAR.CLOSED_DAY');
      return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const duration = this.slotDuration();
    const hourStartMinutes = hour * 60;
    const hourEndMinutes = Math.min((hour + 1) * 60, bounds.toMinutes);
    if (hourStartMinutes >= bounds.toMinutes || hourEndMinutes <= bounds.fromMinutes) {
      this.slotError.set('BOOKINGS.CALENDAR.OUTSIDE_HOURS');
      return;
    }

    const { start, end } = snapTimeFromClick(
      offsetY,
      Math.max(hourStartMinutes, bounds.fromMinutes),
      bounds.toMinutes,
      CALENDAR_SLOT_HEIGHT_PX,
      duration
    );
    const iso = toIsoDate(date);
    if (hasSlotCollision(iso, start, end, this.filteredBookings())) {
      this.slotError.set('BOOKINGS.CALENDAR.SLOT_TAKEN');
      return;
    }
    this.selectedSlot.set({ date, startTime: start, endTime: end, durationMinutes: duration });
    this.slotError.set('');
    this.currentDate.set(date);
  }

  bookingsForHourOnDay(iso: string, hour: number): Booking[] {
    return bookingsInHour(
      this.filteredBookings().filter(b => b.date === iso),
      hour
    );
  }

  selectionRectForHour(
    date: Date,
    lane: DisplayHourLane
  ): { top: number; height: number } | null {
    const slot = this.selectedSlot();
    if (!slot?.startTime || !slot.endTime) return null;
    if (toIsoDate(slot.date) !== toIsoDate(date)) return null;
    return rectInHour(slot.startTime, slot.endTime, lane.hour, lane.height);
  }

  bookingRectInHour(
    booking: Booking,
    lane: DisplayHourLane
  ): { top: number; height: number } | null {
    return rectInHour(booking.startTime, booking.endTime, lane.hour, lane.height);
  }

  isShortBlock(height: number): boolean {
    return height < 28;
  }

  selectionLabel(): string {
    const slot = this.selectedSlot();
    if (!slot) return '';
    const locale = getAppDateLocale(this.languageService.currentLang());
    const dateStr = slot.date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (slot.startTime && slot.endTime) {
      const lang = this.languageService.currentLang();
      const start = formatAppTimeString(slot.startTime, lang);
      const end = formatAppTimeString(slot.endTime, lang);
      return `${dateStr} · ${start} – ${end} (${slot.durationMinutes} ${this.durationUnitLabel()})`;
    }
    return `${dateStr} · ${slot.durationMinutes} ${this.durationUnitLabel()}`;
  }

  durationUnitLabel(): string {
    return 'min';
  }

  setSlotDuration(minutes: CalendarSlotDuration): void {
    this.slotDuration.set(minutes);
    const slot = this.selectedSlot();
    if (!slot?.startTime) return;

    const startMinutes = parseTimeToMinutes(slot.startTime);
    const endMinutes = startMinutes + minutes;
    const endTime = formatTime(Math.floor(endMinutes / 60), endMinutes % 60);
    const iso = toIsoDate(slot.date);
    const bounds = this.workingHours.getDayBounds(slot.date);

    if (endMinutes > bounds.toMinutes) {
      this.slotError.set('BOOKINGS.CALENDAR.OUTSIDE_HOURS');
      return;
    }

    if (hasSlotCollision(iso, slot.startTime, endTime, this.filteredBookings())) {
      this.slotError.set('BOOKINGS.CALENDAR.SLOT_TAKEN');
      return;
    }

    this.selectedSlot.set({ ...slot, endTime, durationMinutes: minutes });
    this.slotError.set('');
  }

  durationLabel(minutes: CalendarSlotDuration): string {
    return `${minutes}`;
  }

  clearSelection(): void {
    this.selectedSlot.set(null);
    this.slotError.set('');
  }

  requestAddBooking(): void {
    const slot = this.selectedSlot();
    if (!slot || !this.canManage()) return;
    if (!slot.startTime || !slot.endTime) {
      this.slotError.set('BOOKINGS.CALENDAR.ADD_DIALOG.SLOT_REQUIRED');
      return;
    }
    this.addBookingRequested.emit(slot);
  }

  eventLabel(booking: Booking): string {
    const lang = this.languageService.currentLang();
    return `${formatAppTimeString(booking.startTime, lang)} – ${formatAppTimeString(booking.endTime, lang)}`;
  }

  statusClass(status: string): string {
    return `event-block--${status}`;
  }

  statusKey(status: BookingStatus): string {
    return bookingStatusKey(status);
  }

  isCancelled(booking: Booking): boolean {
    return booking.status === 'cancelled';
  }

  onEventClick(booking: Booking, event: Event): void {
    event.stopPropagation();
    this.bookingSelected.emit(booking);
  }

  toggleSearch(): void {
    this.searchOpen.update(v => !v);
    if (!this.searchOpen()) this.searchQuery.set('');
  }

  onRefresh(): void {
    this.workingHours.refresh().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.refreshRequested.emit();
  }

  isWorkingDay(date: Date): boolean {
    this.workingHours.settings();
    return this.workingHours.isWorkingDay(date);
  }
}
