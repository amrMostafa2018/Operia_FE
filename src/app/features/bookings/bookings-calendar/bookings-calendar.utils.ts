export type CalendarViewMode = 'day' | 'week';

export const CALENDAR_HOUR_START = 8;
export const CALENDAR_HOUR_END = 21;
/** Pixels per hour — 15 minutes ≈ 24px so short slots stay readable. */
export const CALENDAR_SLOT_HEIGHT_PX = 96;

export interface CalendarDayCell {
  date: Date;
  iso: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export interface CalendarHourLane {
  hour: number;
  label24: string;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type CalendarSlotDuration = 15 | 30 | 45 | 60 | 90 | 120;

export const CALENDAR_SLOT_DURATION_OPTIONS: CalendarSlotDuration[] = [15, 30, 45, 60, 90, 120];

export interface CalendarSlotSelection {
  date: Date;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: CalendarSlotDuration;
}

export interface CalendarBookingDraft {
  slot: CalendarSlotSelection;
  mobile: string;
  employeeId: string;
}

export function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function snapTimeFromClick(
  offsetY: number,
  rangeStartMinutes: number,
  rangeEndMinutes: number,
  slotHeight = CALENDAR_SLOT_HEIGHT_PX,
  durationMinutes: CalendarSlotDuration = 30
): { start: string; end: string } {
  const minutesFromStart = (offsetY / slotHeight) * 60;
  const total = rangeStartMinutes + minutesFromStart;
  const snapped = Math.floor(total / durationMinutes) * durationMinutes;
  const maxStart = rangeEndMinutes - durationMinutes;
  const clamped = Math.max(rangeStartMinutes, Math.min(snapped, maxStart));
  const endTotal = clamped + durationMinutes;
  return {
    start: formatTime(Math.floor(clamped / 60), clamped % 60),
    end: formatTime(Math.floor(endTotal / 60), endTotal % 60),
  };
}

export function hasSlotCollision(
  dateIso: string,
  startTime: string,
  endTime: string,
  bookings: { date: string; startTime: string; endTime: string; status: string; employeeId?: string }[],
  employeeId?: string
): boolean {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return bookings
    .filter(
      b =>
        b.date === dateIso &&
        b.status !== 'cancelled' &&
        (!employeeId || b.employeeId === employeeId)
    )
    .some(b => start < parseTimeToMinutes(b.endTime) && end > parseTimeToMinutes(b.startTime));
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function startHourFromTime(time: string): number {
  return Math.floor(parseTimeToMinutes(time) / 60);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  return addDays(d, -day);
}

export function buildWeekDays(anchor: Date, selected: Date): CalendarDayCell[] {
  const weekStart = startOfWeek(anchor);
  const todayIso = toIsoDate(new Date());
  const selectedIso = toIsoDate(selected);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const iso = toIsoDate(date);
    return {
      date,
      iso,
      inCurrentMonth: true,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    };
  });
}

export function formatPeriodTitle(date: Date, mode: CalendarViewMode, locale = 'en-US'): string {
  if (mode === 'day') {
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  if (mode === 'week') {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startFmt = start.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: sameMonth ? undefined : 'numeric',
    });
    const endFmt = end.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startFmt} – ${endFmt}`;
  }
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function hourLabels(start = CALENDAR_HOUR_START, end = CALENDAR_HOUR_END): string[] {
  return buildHourLanes(start, end).map(lane => lane.label24);
}

export function buildHourLanes(start = CALENDAR_HOUR_START, end = CALENDAR_HOUR_END): CalendarHourLane[] {
  const lanes: CalendarHourLane[] = [];
  for (let h = start; h <= end; h++) {
    lanes.push({
      hour: h,
      label24: `${String(h).padStart(2, '0')}:00`,
    });
  }
  return lanes;
}

export function hourLaneHeight(_bookingCount = 0): number {
  return CALENDAR_SLOT_HEIGHT_PX;
}

export function bookingsInHour<T extends { startTime: string; endTime: string }>(
  bookings: T[],
  hour: number
): T[] {
  const hourStart = hour * 60;
  const hourEnd = hourStart + 60;
  return bookings
    .filter(
      b => parseTimeToMinutes(b.startTime) < hourEnd && parseTimeToMinutes(b.endTime) > hourStart
    )
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
}

/** Position/size of a time range inside one hour lane (clipped to that hour). */
export function rectInHour(
  startTime: string,
  endTime: string,
  hour: number,
  laneHeight = CALENDAR_SLOT_HEIGHT_PX
): { top: number; height: number } | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  const hourStart = hour * 60;
  const hourEnd = hourStart + 60;
  const overlapStart = Math.max(start, hourStart);
  const overlapEnd = Math.min(end, hourEnd);
  if (overlapStart >= overlapEnd) return null;

  const top = ((overlapStart - hourStart) / 60) * laneHeight;
  const height = ((overlapEnd - overlapStart) / 60) * laneHeight;
  return { top, height };
}

export function bookingTopOffset(startTime: string, hourStart = CALENDAR_HOUR_START): number {
  const minutes = parseTimeToMinutes(startTime) - hourStart * 60;
  return (minutes / 60) * CALENDAR_SLOT_HEIGHT_PX;
}

export function bookingHeight(startTime: string, endTime: string): number {
  const duration = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return (duration / 60) * CALENDAR_SLOT_HEIGHT_PX;
}
