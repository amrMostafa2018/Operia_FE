import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, of, shareReplay } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  SettingsActivityService,
  WorkingDayDto,
  WorkingDaysSettingsDto,
} from '@app/features/settings-activity/services/settings-activity.service';
import { AvailabilitySlot } from './models/booking.model';
import { formatTime, parseTimeToMinutes } from './bookings-calendar/bookings-calendar.utils';

const DEFAULT_WORKING_DAYS: WorkingDayDto[] = [
  { day: 'fri', enabled: false, fromTime: '09:00', toTime: '21:00' },
  { day: 'sat', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'sun', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'mon', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'tue', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'wed', enabled: true, fromTime: '09:00', toTime: '21:00' },
  { day: 'thu', enabled: true, fromTime: '09:00', toTime: '21:00' },
];

const DEFAULT_SETTINGS: WorkingDaysSettingsDto = {
  days: DEFAULT_WORKING_DAYS,
  allowBookingOutsideWorkingHours: false,
};

export interface DayWorkingBounds {
  enabled: boolean;
  fromTime: string;
  toTime: string;
  fromMinutes: number;
  toMinutes: number;
  startHour: number;
  endHour: number;
}

@Injectable({ providedIn: 'root' })
export class WorkingHoursService {
  private readonly settingsActivity = inject(SettingsActivityService);
  private readonly settingsState = signal<WorkingDaysSettingsDto>(DEFAULT_SETTINGS);
  private refreshInFlight?: Observable<WorkingDaysSettingsDto>;

  /** Read in calendar computeds so the UI reacts when settings load from the API. */
  readonly settings = this.settingsState.asReadonly();

  constructor() {
    this.refresh().subscribe();
  }

  refresh(): Observable<WorkingDaysSettingsDto> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.settingsActivity.getWorkingDays().pipe(
        catchError(() => of(DEFAULT_SETTINGS)),
        tap(nextSettings => this.settingsState.set(this.normalizeSettings(nextSettings))),
        finalize(() => {
          this.refreshInFlight = undefined;
        }),
        shareReplay(1)
      );
    }
    return this.refreshInFlight;
  }

  snapshot(): WorkingDaysSettingsDto {
    return this.settingsState();
  }

  allowBookingOutsideWorkingHours(): boolean {
    return this.snapshot().allowBookingOutsideWorkingHours;
  }

  getDayForDate(date: Date): WorkingDayDto | undefined {
    const dayCode = dayCodeFromDate(date);
    return this.snapshot().days.find(d => d.day.toLowerCase() === dayCode);
  }

  getDayBounds(date: Date): DayWorkingBounds {
    const day = this.getDayForDate(date);
    if (!day?.enabled) {
      return {
        enabled: false,
        fromTime: '00:00',
        toTime: '00:00',
        fromMinutes: 0,
        toMinutes: 0,
        startHour: 0,
        endHour: 0,
      };
    }

    const fromTime = normalizeTime(day.fromTime);
    const toTime = normalizeTime(day.toTime);
    const fromMinutes = parseTimeToMinutes(fromTime);
    const toMinutes = parseTimeToMinutes(toTime);

    return {
      enabled: true,
      fromTime,
      toTime,
      fromMinutes,
      toMinutes,
      startHour: Math.floor(fromMinutes / 60),
      endHour: Math.ceil(toMinutes / 60),
    };
  }

  isWorkingDay(date: Date): boolean {
    return this.getDayBounds(date).enabled;
  }

  getGridBounds(): { startHour: number; endHour: number } {
    const enabledDays = this.snapshot().days.filter(d => d.enabled);
    if (enabledDays.length === 0) {
      return { startHour: 9, endHour: 21 };
    }

    const fromMinutes = Math.min(...enabledDays.map(d => parseTimeToMinutes(normalizeTime(d.fromTime))));
    const toMinutes = Math.max(...enabledDays.map(d => parseTimeToMinutes(normalizeTime(d.toTime))));

    return {
      startHour: Math.floor(fromMinutes / 60),
      endHour: Math.ceil(toMinutes / 60),
    };
  }

  isWithinWorkingHours(date: Date, startTime: string, endTime: string): boolean {
    if (this.allowBookingOutsideWorkingHours()) return true;
    const bounds = this.getDayBounds(date);
    if (!bounds.enabled) return false;
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    return start >= bounds.fromMinutes && end <= bounds.toMinutes;
  }

  generateAvailabilitySlots(
    dateIso: string,
    sessionDurationMinutes: number,
    booked: { startTime: string; endTime: string }[]
  ): AvailabilitySlot[] {
    const date = new Date(dateIso + 'T12:00:00');
    const bounds = this.getDayBounds(date);
    if (!bounds.enabled) return [];

    const slots: AvailabilitySlot[] = [];
    for (
      let start = bounds.fromMinutes;
      start + sessionDurationMinutes <= bounds.toMinutes;
      start += sessionDurationMinutes
    ) {
      const end = start + sessionDurationMinutes;
      const startStr = formatTime(Math.floor(start / 60), start % 60);
      const endStr = formatTime(Math.floor(end / 60), end % 60);
      const collision = booked.some(b => {
        const bStart = parseTimeToMinutes(b.startTime);
        const bEnd = parseTimeToMinutes(b.endTime);
        return start < bEnd && end > bStart;
      });
      slots.push({ start: startStr, end: endStr, isAvailable: !collision });
    }
    return slots;
  }

  private normalizeSettings(settings: WorkingDaysSettingsDto): WorkingDaysSettingsDto {
    return {
      allowBookingOutsideWorkingHours: settings.allowBookingOutsideWorkingHours,
      days: settings.days.map(day => ({
        ...day,
        day: day.day.toLowerCase(),
        fromTime: normalizeTime(day.fromTime),
        toTime: normalizeTime(day.toTime),
      })),
    };
  }
}

export function dayCodeFromDate(dateStrOrDate: string | Date): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const date =
    typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate + 'T12:00:00') : dateStrOrDate;
  return days[date.getDay()];
}

function normalizeTime(time: string): string {
  if (!time) return '00:00';
  return time.length >= 5 ? time.slice(0, 5) : time;
}
