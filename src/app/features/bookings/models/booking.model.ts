import {
  PAYMENT_METHOD_ICON_CLASSES,
  PAYMENT_METHOD_ICONS,
} from '@app/shared/constants/payment-method-icons';

export type BookingWordStatus = 'booked' | 'completed' | 'cancelled';
export type SlotVisualState = 'available' | 'booked' | 'completed' | 'closed';
export type CalendarViewMode = 'today' | '4days';
export type ServiceCategory = 'all' | 'services' | 'laser' | 'peeling' | 'skin' | 'other';
export type PaymentMethodId = 'cash' | 'bank_transfer' | 'instapay' | 'e_wallet' | 'fawry';

export const DAY_START_MINUTES = 8 * 60;
export const DAY_END_MINUTES = 18 * 60;
export const SLOT_INTERVAL_MINUTES = 30;
export const SLOT_SNAP_MINUTES = 15;
export const SLOT_ROW_HEIGHT_PX = 58;
export const BOOKING_OVERLAY_GAP_PX = 2;

export interface SelectOption<T = string> {
  label: string;
  value: T;
}

export interface EmployeeWorkingHours {
  day: string;
  enabled: boolean;
  fromMinutes: number | null;
  toMinutes: number | null;
}

export interface EmployeeOption {
  id: string;
  name: string;
  specialty: string;
  branchId: string;
  avatarInitials: string;
  avatarColor: string;
  photoUrl?: string | null;
  workingDays: EmployeeWorkingHours[];
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface DurationOption {
  label: string;
  value: number;
}

export interface PackageOption {
  id: string;
  name: string;
  durationMinutes: number;
  serviceId: string;
}

export interface ClientPackage {
  packageId: string;
  packageName: string;
  usedSessions: number;
  totalSessions: number;
  expiryDate: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  mobile: string;
  registered: boolean;
  packages: ClientPackage[];
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  nameKey?: string;
  category: string;
  durationMinutes: number;
  price: number;
  icon: string;
  type: 'package' | 'session';
}

export interface CatalogCategoryTab {
  id: string;
  label?: string;
  labelKey?: string;
}

export interface BookingLineItem {
  id: string;
  name: string;
  type: 'package' | 'session' | 'unlisted';
  quantity: number;
  price: number;
  durationMinutes: number;
  packageSessionLinked?: boolean;
}

export interface BookingRecord {
  id: string;
  bookingNumber: string;
  status: BookingWordStatus;
  clientId: string;
  clientName: string;
  clientMobile: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  sourceKey: string;
  scheduledDate: Date;
  startMinutes: number;
  slotDurationMinutes: number;
  lineItems: BookingLineItem[];
  paymentMethod: PaymentMethodId;
  totalAmount: number;
  paidAmount: number;
  discount: number;
  createdAt: Date;
}

export interface CalendarSlotCell {
  key: string;
  employeeId: string;
  date: Date;
  dateKey: string;
  startMinutes: number;
  endMinutes: number;
  visual: SlotVisualState;
  selectable: boolean;
  recommended: boolean;
  booking?: BookingRecord;
  isRangeStart: boolean;
  isContinuation: boolean;
  offsetStartMinutes: number | null;
  offsetRecommended: boolean;
  offsetBooking?: BookingRecord;
}

export interface SlotSelection {
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  date: Date;
  startMinutes: number;
  slotDurationMinutes: number;
}

export interface AppointmentFilters {
  employeeId: string | null;
  branchId: string | null;
  durationMinutes: number;
  packageId: string | null;
  clientName: string;
  clientMobile: string;
}

export const MOCK_EMPLOYEES: EmployeeOption[] = [
  {
    id: 'emp-1',
    name: 'د. هدى جمال',
    specialty: 'أخصائية بشرة',
    branchId: 'branch-1',
    avatarInitials: 'هج',
    avatarColor: '#7c3aed',
    workingDays: [],
  },
  {
    id: 'emp-2',
    name: 'د. أحمد علي',
    specialty: 'أخصائي ليزر',
    branchId: 'branch-1',
    avatarInitials: 'أع',
    avatarColor: '#2563eb',
    workingDays: [],
  },
  {
    id: 'emp-3',
    name: 'د. عمرو ياسر',
    specialty: 'أخصائي تجميل',
    branchId: 'branch-2',
    avatarInitials: 'عي',
    avatarColor: '#0891b2',
    workingDays: [],
  },
  {
    id: 'emp-4',
    name: 'د. سارة محمود',
    specialty: 'أخصائية بشرة',
    branchId: 'branch-1',
    avatarInitials: 'سم',
    avatarColor: '#db2777',
    workingDays: [],
  },
  {
    id: 'emp-5',
    name: 'د. كريم حسن',
    specialty: 'أخصائي ليزر',
    branchId: 'branch-1',
    avatarInitials: 'كه',
    avatarColor: '#ea580c',
    workingDays: [],
  },
];

export const MOCK_DURATIONS: DurationOption[] = [
  { label: '15', value: 15 },
  { label: '30', value: 30 },
  { label: '45', value: 45 },
  { label: '60', value: 60 },
  { label: '90', value: 90 },
];

export const MOCK_PACKAGES: PackageOption[] = [
  { id: 'pkg-1', name: 'باقة ليزر جسم كامل', durationMinutes: 60, serviceId: 'svc-4' },
  { id: 'pkg-2', name: 'باقة تنظيف بشرة', durationMinutes: 45, serviceId: 'svc-3' },
];

export const MOCK_CLIENTS: ClientRecord[] = [
  {
    id: 'client-1',
    name: 'أحمد محمد علي',
    mobile: '01012345678',
    registered: true,
    packages: [
      {
        packageId: 'pkg-1',
        packageName: 'باقة ليزر جسم كامل',
        usedSessions: 3,
        totalSessions: 6,
        expiryDate: '2026-09-30',
      },
    ],
  },
  {
    id: 'client-2',
    name: 'ريم علي',
    mobile: '01098765432',
    registered: true,
    packages: [],
  },
  {
    id: 'client-3',
    name: 'أسماء محمد',
    mobile: '01055556666',
    registered: true,
    packages: [
      {
        packageId: 'pkg-2',
        packageName: 'باقة تنظيف بشرة',
        usedSessions: 1,
        totalSessions: 4,
        expiryDate: '2026-12-01',
      },
    ],
  },
];

export const MOCK_SERVICES: ServiceCatalogItem[] = [
  {
    id: 'svc-1',
    name: 'إزالة شعر الوجه',
    category: 'laser',
    durationMinutes: 30,
    price: 250,
    icon: 'pi pi-sun',
    type: 'session',
  },
  {
    id: 'svc-2',
    name: 'تقشير كربوني',
    category: 'peeling',
    durationMinutes: 45,
    price: 350,
    icon: 'pi pi-sparkles',
    type: 'session',
  },
  {
    id: 'svc-3',
    name: 'تنظيف بشرة عميق',
    category: 'skin',
    durationMinutes: 45,
    price: 400,
    icon: 'pi pi-heart',
    type: 'session',
  },
  {
    id: 'svc-4',
    name: 'باقة ليزر جسم كامل',
    category: 'services',
    durationMinutes: 60,
    price: 1200,
    icon: 'pi pi-box',
    type: 'package',
  },
  {
    id: 'svc-5',
    name: 'جلسة ليزر منطقة صغيرة',
    category: 'laser',
    durationMinutes: 20,
    price: 180,
    icon: 'pi pi-bolt',
    type: 'session',
  },
  {
    id: 'svc-6',
    name: 'خدمة أخرى',
    category: 'other',
    durationMinutes: 30,
    price: 200,
    icon: 'pi pi-ellipsis-h',
    type: 'session',
  },
];

export const SERVICE_CATEGORY_TABS: { key: ServiceCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'BOOKINGS.SERVICE_TABS.ALL' },
  { key: 'services', labelKey: 'BOOKINGS.SERVICE_TABS.SERVICES' },
  { key: 'laser', labelKey: 'BOOKINGS.SERVICE_TABS.LASER' },
  { key: 'peeling', labelKey: 'BOOKINGS.SERVICE_TABS.PEELING' },
  { key: 'skin', labelKey: 'BOOKINGS.SERVICE_TABS.SKIN' },
  { key: 'other', labelKey: 'BOOKINGS.SERVICE_TABS.OTHER' },
];

export const PAYMENT_METHODS: {
  id: PaymentMethodId;
  labelKey: string;
  icon: string;
  iconClass: string;
}[] = [
  {
    id: 'cash',
    labelKey: 'BOOKINGS.PAYMENT.CASH',
    icon: PAYMENT_METHOD_ICONS.cash,
    iconClass: PAYMENT_METHOD_ICON_CLASSES.cash,
  },
  {
    id: 'bank_transfer',
    labelKey: 'BOOKINGS.PAYMENT.BANK_TRANSFER',
    icon: PAYMENT_METHOD_ICONS.bankTransfer,
    iconClass: PAYMENT_METHOD_ICON_CLASSES.bankTransfer,
  },
  {
    id: 'instapay',
    labelKey: 'BOOKINGS.PAYMENT.INSTAPAY',
    icon: PAYMENT_METHOD_ICONS.instapay,
    iconClass: PAYMENT_METHOD_ICON_CLASSES.instapay,
  },
  {
    id: 'e_wallet',
    labelKey: 'BOOKINGS.PAYMENT.E_WALLET',
    icon: PAYMENT_METHOD_ICONS.wallet,
    iconClass: PAYMENT_METHOD_ICON_CLASSES.wallet,
  },
  {
    id: 'fawry',
    labelKey: 'BOOKINGS.PAYMENT.FAWRY',
    icon: PAYMENT_METHOD_ICONS.fawry,
    iconClass: PAYMENT_METHOD_ICON_CLASSES.fawry,
  },
];

const CLOSED_SLOT_KEYS = new Set([
  'emp-1|2026-08-18|540',
  'emp-1|2026-08-18|570',
  'emp-2|2026-08-18|720',
  'emp-2|2026-08-18|750',
  'emp-3|2026-08-18|600',
]);

function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function createInitialBookings(): BookingRecord[] {
  const scheduled = createDate(2026, 8, 18);
  return [
    {
      id: 'bk-1',
      bookingNumber: 'OP-250826-0154',
      status: 'booked',
      clientId: 'client-1',
      clientName: 'أحمد محمد علي',
      clientMobile: '01012345678',
      employeeId: 'emp-2',
      employeeName: 'د. أحمد علي',
      branchId: 'branch-1',
      branchName: 'فرع مدينة نصر',
      sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
      scheduledDate: scheduled,
      startMinutes: 9 * 60 + 15,
      slotDurationMinutes: 60,
      lineItems: [
        {
          id: 'li-1',
          name: 'باقة ليزر جسم كامل',
          type: 'package',
          quantity: 1,
          price: 400,
          durationMinutes: 60,
          packageSessionLinked: true,
        },
        {
          id: 'li-2',
          name: 'تنظيف بشرة عميق',
          type: 'session',
          quantity: 1,
          price: 400,
          durationMinutes: 45,
        },
      ],
      paymentMethod: 'cash',
      totalAmount: 800,
      paidAmount: 400,
      discount: 0,
      createdAt: createDate(2025, 8, 20),
    },
    {
      id: 'bk-2',
      bookingNumber: 'OP-250818-0091',
      status: 'booked',
      clientId: 'client-2',
      clientName: 'ريم علي',
      clientMobile: '01098765432',
      employeeId: 'emp-1',
      employeeName: 'د. هدى جمال',
      branchId: 'branch-1',
      branchName: 'فرع مدينة نصر',
      sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
      scheduledDate: scheduled,
      startMinutes: 10 * 60,
      slotDurationMinutes: 30,
      lineItems: [
        {
          id: 'li-3',
          name: 'إزالة شعر الوجه',
          type: 'session',
          quantity: 1,
          price: 250,
          durationMinutes: 30,
        },
      ],
      paymentMethod: 'instapay',
      totalAmount: 250,
      paidAmount: 250,
      discount: 0,
      createdAt: createDate(2026, 8, 17),
    },
    {
      id: 'bk-3',
      bookingNumber: 'OP-250818-0044',
      status: 'completed',
      clientId: 'client-3',
      clientName: 'أسماء محمد',
      clientMobile: '01055556666',
      employeeId: 'emp-3',
      employeeName: 'د. عمرو ياسر',
      branchId: 'branch-2',
      branchName: 'فرع التجمع الخامس',
      sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
      scheduledDate: scheduled,
      startMinutes: 11 * 60,
      slotDurationMinutes: 60,
      lineItems: [
        {
          id: 'li-4',
          name: 'تقشير كربوني',
          type: 'session',
          quantity: 1,
          price: 350,
          durationMinutes: 45,
        },
      ],
      paymentMethod: 'cash',
      totalAmount: 350,
      paidAmount: 350,
      discount: 0,
      createdAt: createDate(2026, 8, 16),
    },
  ];
}

export function cloneBookings(): BookingRecord[] {
  return createInitialBookings().map(booking => ({
    ...booking,
    scheduledDate: new Date(booking.scheduledDate),
    createdAt: new Date(booking.createdAt),
    lineItems: booking.lineItems.map(item => ({ ...item })),
  }));
}

export function cloneClients(): ClientRecord[] {
  return MOCK_CLIENTS.map(client => ({
    ...client,
    packages: client.packages.map(pkg => ({ ...pkg })),
  }));
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function bookingBlockHeightPx(durationMinutes: number): number {
  return (durationMinutes / SLOT_INTERVAL_MINUTES) * SLOT_ROW_HEIGHT_PX;
}

export function bookingBlockTopPx(
  startMinutes: number,
  dayStartMinutes: number = DAY_START_MINUTES
): number {
  return ((startMinutes - dayStartMinutes) / SLOT_INTERVAL_MINUTES) * SLOT_ROW_HEIGHT_PX;
}

export function formatTimeRange(startMinutes: number, durationMinutes: number): string {
  return `${formatMinutesAsTime(startMinutes)} - ${formatMinutesAsTime(startMinutes + durationMinutes)}`;
}

export function slotKey(employeeId: string, date: Date, startMinutes: number): string {
  return `${employeeId}|${toDateKey(date)}|${startMinutes}`;
}

export function generateBookingNumber(): string {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = String(Math.floor(Math.random() * 9000) + 1000);
  return `OP-${stamp}-${random}`;
}

export function findClientByMobile(mobile: string, clients: ClientRecord[]): ClientRecord | null {
  const normalized = mobile.replace(/\s+/g, '');
  return clients.find(client => client.mobile.replace(/\s+/g, '') === normalized) ?? null;
}

export function bookingOverlapsSlot(
  booking: BookingRecord,
  employeeId: string,
  date: Date,
  startMinutes: number
): boolean {
  if (booking.employeeId !== employeeId || toDateKey(booking.scheduledDate) !== toDateKey(date)) {
    return false;
  }
  const end = booking.startMinutes + booking.slotDurationMinutes;
  const slotEnd = startMinutes + SLOT_INTERVAL_MINUTES;
  return startMinutes < end && slotEnd > booking.startMinutes;
}

export function bookingAtSlotStart(
  booking: BookingRecord,
  employeeId: string,
  date: Date,
  startMinutes: number
): boolean {
  return (
    booking.employeeId === employeeId &&
    toDateKey(booking.scheduledDate) === toDateKey(date) &&
    booking.startMinutes === startMinutes
  );
}

export function bookingStartsInRow(
  booking: BookingRecord,
  employeeId: string,
  date: Date,
  rowStartMinutes: number
): boolean {
  return (
    booking.employeeId === employeeId &&
    toDateKey(booking.scheduledDate) === toDateKey(date) &&
    booking.startMinutes >= rowStartMinutes &&
    booking.startMinutes < rowStartMinutes + SLOT_INTERVAL_MINUTES
  );
}

const WEEKDAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const AVATAR_COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#db2777', '#ea580c', '#16a34a'];

export function weekdayCode(date: Date): string {
  return WEEKDAY_CODES[date.getDay()];
}

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parts = value.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

export function hoursForDate(
  workingDays: EmployeeWorkingHours[],
  date: Date
): EmployeeWorkingHours | null {
  const day = workingDays.find(item => item.day === weekdayCode(date));
  if (!day || !day.enabled || day.fromMinutes === null || day.toMinutes === null) {
    return null;
  }
  return day;
}

export function isWithinWorkingHours(
  hours: EmployeeWorkingHours | null,
  startMinutes: number,
  durationMinutes: number = SLOT_INTERVAL_MINUTES
): boolean {
  if (!hours || hours.fromMinutes === null || hours.toMinutes === null) {
    return false;
  }
  return startMinutes >= hours.fromMinutes && startMinutes + durationMinutes <= hours.toMinutes;
}

export function bookingOverlapsRange(
  booking: BookingRecord,
  employeeId: string,
  date: Date,
  startMinutes: number,
  durationMinutes: number
): boolean {
  if (booking.employeeId !== employeeId || toDateKey(booking.scheduledDate) !== toDateKey(date)) {
    return false;
  }
  const bookingEnd = booking.startMinutes + booking.slotDurationMinutes;
  const rangeEnd = startMinutes + durationMinutes;
  return startMinutes < bookingEnd && rangeEnd > booking.startMinutes;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return `${parts[0][0]}${parts[1][0]}`;
}

export function avatarColorFromId(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

export function floorToSlot(minutes: number): number {
  return Math.floor(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
}

export function ceilToSlot(minutes: number): number {
  return Math.ceil(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
}

export function calendarDayRange(columns: { employee: EmployeeOption; date: Date }[]): {
  startMinutes: number;
  endMinutes: number;
} {
  let earliestStart: number | null = null;
  let latestEnd: number | null = null;

  for (const column of columns) {
    const hours = hoursForDate(column.employee.workingDays, column.date);
    if (!hours || hours.fromMinutes === null || hours.toMinutes === null) {
      continue;
    }
    earliestStart =
      earliestStart === null ? hours.fromMinutes : Math.min(earliestStart, hours.fromMinutes);
    latestEnd = latestEnd === null ? hours.toMinutes : Math.max(latestEnd, hours.toMinutes);
  }

  if (earliestStart === null || latestEnd === null || latestEnd <= earliestStart) {
    return { startMinutes: DAY_START_MINUTES, endMinutes: DAY_END_MINUTES };
  }

  const startMinutes = floorToSlot(earliestStart);
  let endMinutes = ceilToSlot(latestEnd);
  if (endMinutes <= startMinutes) {
    endMinutes = startMinutes + SLOT_INTERVAL_MINUTES;
  }

  return { startMinutes, endMinutes };
}

export function buildSlotRows(startMinutes: number, endMinutes: number): number[] {
  const rows: number[] = [];
  for (let minute = startMinutes; minute < endMinutes; minute += SLOT_INTERVAL_MINUTES) {
    rows.push(minute);
  }
  return rows;
}

export function isSlotClosed(employeeId: string, date: Date, startMinutes: number): boolean {
  return CLOSED_SLOT_KEYS.has(slotKey(employeeId, date, startMinutes));
}

export function isSlotAvailableForBooking(
  bookings: BookingRecord[],
  employeeId: string,
  date: Date,
  startMinutes: number,
  durationMinutes: number,
  hours: EmployeeWorkingHours | null
): boolean {
  if (!isWithinWorkingHours(hours, startMinutes, durationMinutes)) {
    return false;
  }
  return !bookings.some(
    booking =>
      booking.status !== 'cancelled' &&
      bookingOverlapsRange(booking, employeeId, date, startMinutes, durationMinutes)
  );
}

export function findRecommendedStart(
  bookings: BookingRecord[],
  employeeId: string,
  date: Date,
  durationMinutes: number,
  hours: EmployeeWorkingHours | null
): number | null {
  const searchStart = hours?.fromMinutes ?? DAY_START_MINUTES;
  const searchEnd = hours?.toMinutes ?? DAY_END_MINUTES;
  const alignedStart = Math.ceil(searchStart / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES;

  for (let start = alignedStart; start + durationMinutes <= searchEnd; start += SLOT_SNAP_MINUTES) {
    if (isSlotAvailableForBooking(bookings, employeeId, date, start, durationMinutes, hours)) {
      return start;
    }
  }
  return null;
}

export function buildSlotGrid(
  bookings: BookingRecord[],
  employeeId: string,
  date: Date,
  durationMinutes: number,
  workingDays: EmployeeWorkingHours[] = [],
  rangeStartMinutes: number = DAY_START_MINUTES,
  rangeEndMinutes: number = DAY_END_MINUTES
): CalendarSlotCell[] {
  const hours = hoursForDate(workingDays, date);
  const recommendedStart = findRecommendedStart(bookings, employeeId, date, durationMinutes, hours);
  const cells: CalendarSlotCell[] = [];

  for (let start = rangeStartMinutes; start < rangeEndMinutes; start += SLOT_INTERVAL_MINUTES) {
    const key = slotKey(employeeId, date, start);
    const overlapping = bookings.filter(
      booking =>
        booking.status !== 'cancelled' && bookingOverlapsSlot(booking, employeeId, date, start)
    );
    const bookingAtStart = bookings.find(
      booking =>
        booking.status !== 'cancelled' && bookingAtSlotStart(booking, employeeId, date, start)
    );
    const offsetBooking = bookings.find(
      booking =>
        booking.status !== 'cancelled' &&
        bookingStartsInRow(booking, employeeId, date, start) &&
        booking.startMinutes !== start
    );

    let visual: SlotVisualState = 'available';
    let booking: BookingRecord | undefined;

    if (!isWithinWorkingHours(hours, start, SLOT_INTERVAL_MINUTES)) {
      visual = 'closed';
    } else if (overlapping.length > 0) {
      const primary = bookingAtStart ?? offsetBooking ?? overlapping[0];
      booking = primary;
      visual = primary.status === 'completed' ? 'completed' : 'booked';
    }

    const selectable =
      visual === 'available' &&
      isSlotAvailableForBooking(bookings, employeeId, date, start, durationMinutes, hours);

    const offsetStart = start + SLOT_SNAP_MINUTES;
    const offsetAvailable =
      !offsetBooking &&
      isSlotAvailableForBooking(bookings, employeeId, date, offsetStart, durationMinutes, hours);
    const showOffset = offsetAvailable && visual !== 'available';

    cells.push({
      key,
      employeeId,
      date: new Date(date),
      dateKey: toDateKey(date),
      startMinutes: start,
      endMinutes: start + SLOT_INTERVAL_MINUTES,
      visual,
      selectable,
      recommended: recommendedStart === start && selectable,
      booking,
      isRangeStart: !!bookingAtStart,
      isContinuation: overlapping.length > 0 && !bookingAtStart && !offsetBooking,
      offsetStartMinutes: showOffset ? offsetStart : null,
      offsetRecommended: showOffset && recommendedStart === offsetStart,
      offsetBooking,
    });
  }

  return cells;
}

export function sumLineItemDuration(items: BookingLineItem[]): number {
  return items.reduce((total, item) => total + item.durationMinutes * item.quantity, 0);
}

export function sumLineItemPrice(items: BookingLineItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function bookingHasPackage(booking: BookingRecord): boolean {
  return booking.lineItems.some(item => item.type === 'package' || item.packageSessionLinked);
}

export function filterEmployees(
  employees: EmployeeOption[],
  employeeId: string | null
): EmployeeOption[] {
  if (!employeeId) {
    return employees;
  }
  return employees.filter(employee => employee.id === employeeId);
}

export function resolveEmployeeForFourDayView(
  employees: EmployeeOption[],
  employeeId: string | null
): EmployeeOption | null {
  const filtered = filterEmployees(employees, employeeId);
  return filtered[0] ?? null;
}

export function defaultSelectedDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function defaultFilters(): AppointmentFilters {
  return {
    employeeId: null,
    branchId: null,
    durationMinutes: 60,
    packageId: 'pkg-1',
    clientName: 'أسماء محمد',
    clientMobile: '01012345678',
  };
}
