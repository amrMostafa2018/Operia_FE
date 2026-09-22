import {
  PAYMENT_METHOD_ICON_CLASSES,
  PAYMENT_METHOD_ICONS,
} from '@app/shared/constants/payment-method-icons';

/** Lifecycle status returned by the booking API and shown in Appointments. */
export type BookingWordStatus = 'booked' | 'completed' | 'cancelled';
/** Status used by older local booking fixtures. */
export type BookingStatus = 'pending' | 'completed' | 'cancelled';
/** Describes slot visual state used by the booking UI. */
export type SlotVisualState = 'available' | 'booked' | 'completed' | 'held' | 'closed';
/** Describes calendar view mode used by booking screens. */
export type CalendarViewMode = 'today' | '4days';
/** Describes service category used by booking screens. */
export type ServiceCategory = 'all' | 'services' | 'laser' | 'peeling' | 'skin' | 'other';
/** Identifier of a payment method enabled in business settings. */
export type PaymentMethodId = 'cash' | 'bank_transfer' | 'instapay' | 'e_wallet' | 'fawry';

export const BOOKING_PAGE_SIZES = [10, 25, 50, 100, 500, 1000, 2000] as const;

export const BOOKING_STATUS_OPTIONS: { label: string; value: BookingStatus | null }[] = [
  { label: 'BOOKINGS.ALL_STATUS', value: null },
  { label: 'BOOKING_STATUS.PENDING', value: 'pending' },
  { label: 'BOOKING_STATUS.COMPLETED', value: 'completed' },
  { label: 'BOOKING_STATUS.CANCELLED', value: 'cancelled' },
];

/** Describes booking used by booking screens. */
export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  packageId: string;
  packageName: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  service: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

/** Describes booking summary used by booking screens. */
export interface BookingSummary {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
}

/** Describes booking filters used by the booking UI. */
export interface BookingFilters {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  search?: string;
  employeeId?: string | null;
  status?: BookingStatus | null;
  customerMobile?: string;
  customerName?: string;
}

/** Describes booking list result exchanged with the API. */
export interface BookingListResult {
  items: Booking[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

/** Describes availability slot used by booking screens. */
export interface AvailabilitySlot {
  start: string;
  end: string;
  isAvailable: boolean;
}

/** Describes create booking payload used by the booking UI. */
export interface CreateBookingPayload {
  customerId: string;
  packageId: string;
  branchId: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
}

/** Describes update booking payload used by the booking UI. */
export interface UpdateBookingPayload {
  branchId?: string;
  employeeId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export const DAY_START_MINUTES = 8 * 60;
export const DAY_END_MINUTES = 18 * 60;
export const SLOT_INTERVAL_MINUTES = 30;
export const SLOT_SNAP_MINUTES = 15;
export const SLOT_ROW_HEIGHT_PX = 58;
export const BOOKING_OVERLAY_GAP_PX = 2;

/** Describes select option used by booking screens. */
export interface SelectOption<T = string> {
  label: string;
  value: T;
}

/** Describes employee working hours used by booking screens. */
export interface EmployeeWorkingHours {
  day: string;
  enabled: boolean;
  fromMinutes: number | null;
  toMinutes: number | null;
}

/** Describes employee option used by booking screens. */
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

/** Describes branch option used by booking screens. */
export interface BranchOption {
  id: string;
  name: string;
}

/** Describes duration option used by booking screens. */
export interface DurationOption {
  label: string;
  value: number;
}

/** Describes package option used by booking screens. */
export interface PackageOption {
  id: string;
  name: string;
  durationMinutes: number;
  serviceId: string;
}

/** Describes client package used by booking screens. */
export interface ClientPackage {
  customerPackageId: string;
  packageId: string;
  packageName: string;
  usedSessions: number;
  totalSessions: number;
  expiryDate: string;
  offerType?: 'package' | 'session';
  sessionCount?: number | null;
  pulseCount?: number | null;
}

/** True when the package master defines a pulse balance (Package.PulseCount has a value). */
export function packageUsesPulses(pkg: Pick<ClientPackage, 'pulseCount'>): boolean {
  return pkg.pulseCount != null && pkg.pulseCount > 0;
}

/** True when remaining balance ignores reserved slots (pulse package offers only). */
export function packageBalanceIgnoresReservedSessions(
  pkg: Pick<ClientPackage, 'offerType' | 'pulseCount'>
): boolean {
  return pkg.offerType === 'package' && packageUsesPulses(pkg);
}

/**
 * Units shown as المستخدم.
 * Pulse package offers use Used only. Single-session and session packages also count reserved slots.
 */
export function displayedPackageUsedUnits(pkg: {
  usedSessions: number;
  reservedSessions: number;
  pulseCount?: number | null;
  offerType?: ClientPackage['offerType'];
}): number {
  return packageBalanceIgnoresReservedSessions(pkg)
    ? pkg.usedSessions
    : pkg.usedSessions + pkg.reservedSessions;
}

/**
 * Units shown as المتبقي.
 * Pulse packages: Total − Used.
 * Single-session and session packages: Total − Used − ReservedSessions.
 */
export function displayedPackageRemainingUnits(pkg: {
  totalSessions: number;
  usedSessions: number;
  reservedSessions?: number;
  pulseCount?: number | null;
  offerType?: ClientPackage['offerType'];
}): number {
  if (packageBalanceIgnoresReservedSessions(pkg)) {
    return Math.max(0, pkg.totalSessions - pkg.usedSessions);
  }

  if (pkg.reservedSessions === undefined) {
    // ClientPackage.usedSessions already includes reserved slots for session and single-session packages.
    return Math.max(0, pkg.totalSessions - pkg.usedSessions);
  }

  return Math.max(0, pkg.totalSessions - pkg.usedSessions - pkg.reservedSessions);
}

/** True when the package master defines a session balance (Package.SessionCount has a value). */
export function packageUsesSessions(pkg: Pick<ClientPackage, 'sessionCount'>): boolean {
  return pkg.sessionCount != null && pkg.sessionCount > 0;
}

const BOOKING_ITEM_MAX_QUANTITY = 100;

/** True when this catalog package is the one selected for the booking session. */
export function bookAppointmentIsBookingPackage(
  service: Pick<ServiceCatalogItem, 'type' | 'id'>,
  bookingPackageId: string | null
): boolean {
  return service.type === 'package' && !!bookingPackageId && service.id === bookingPackageId;
}

/** Units consumed from an owned package balance on this booking (0 or 1). */
export function bookAppointmentOwnedReuseUnits(
  ownedPackage: ClientPackage | null,
  isBookingPackage: boolean
): number {
  if (!isBookingPackage || !ownedPackage) {
    return 0;
  }

  const remaining = displayedPackageRemainingUnits(ownedPackage);
  return remaining > 0 ? 1 : 0;
}

/** Units that create new customer-package purchases and are charged at catalog price. */
export function bookAppointmentNewPurchaseUnits(
  service: Pick<ServiceCatalogItem, 'type'>,
  quantity: number,
  ownedPackage: ClientPackage | null,
  isBookingPackage: boolean
): number {
  if (quantity <= 0) {
    return 0;
  }

  if (service.type !== 'package') {
    return ownedPackage != null && quantity === 1 ? 0 : quantity;
  }

  if (!isBookingPackage) {
    // Purchase-only package line: first owned copy is not billed again.
    return ownedPackage != null ? Math.max(0, quantity - 1) : quantity;
  }

  return Math.max(0, quantity - bookAppointmentOwnedReuseUnits(ownedPackage, true));
}

/** True when a catalog package line belongs in payments and the create-booking payload. */
export function bookAppointmentIncludeLineItem(
  service: Pick<ServiceCatalogItem, 'type'>,
  isBookingPackage: boolean,
  newPurchaseUnits: number
): boolean {
  return !(
    service.type === 'package' &&
    !isBookingPackage &&
    newPurchaseUnits === 0
  );
}

export function bookAppointmentMaxQuantity(_service: Pick<ServiceCatalogItem, 'type'>): number {
  return BOOKING_ITEM_MAX_QUANTITY;
}

/** Unit price stored on a booking line item before new-purchase calculation. */
export function bookAppointmentCatalogUnitPrice(
  service: Pick<ServiceCatalogItem, 'type' | 'price'>,
  ownedPackage: ClientPackage | null,
  quantity: number
): number {
  if (service.type === 'package') {
    return service.price;
  }

  return ownedPackage != null && quantity === 1 ? 0 : service.price;
}

/** Billable amount for one booking line item. */
export function bookAppointmentLineTotal(
  item: Pick<BookingLineItem, 'type' | 'price' | 'quantity' | 'newPurchaseUnits'>
): number {
  if (item.type === 'package') {
    return item.price * (item.newPurchaseUnits ?? 0);
  }

  return item.price * item.quantity;
}

/** Calendar duration contributed by one catalog line. */
export function bookAppointmentLineDuration(
  service: Pick<ServiceCatalogItem, 'type' | 'durationMinutes'>,
  quantity: number,
  isBookingPackage: boolean
): number {
  if (service.type === 'package') {
    return isBookingPackage && quantity > 0 ? service.durationMinutes : 0;
  }

  return service.durationMinutes * quantity;
}

/** Resolves the owned customer package to link when booking this catalog item. */
export function bookAppointmentCustomerPackageId(
  service: Pick<ServiceCatalogItem, 'type'>,
  ownedPackage: ClientPackage | null,
  isBookingPackage: boolean
): string | null {
  if (!ownedPackage || !isBookingPackage || service.type !== 'package') {
    return null;
  }

  return bookAppointmentOwnedReuseUnits(ownedPackage, true) > 0
    ? ownedPackage.customerPackageId
    : null;
}

/** Maps a booking line item to the API item type. */
export function bookAppointmentApiItemType(item: BookingLineItem): string {
  if (item.type === 'package' && !item.packageSessionLinked) {
    return 'packagePurchase';
  }

  return item.type;
}

/** Describes client record used by booking screens. */
export interface ClientRecord {
  id: string;
  name: string;
  mobile: string;
  registered: boolean;
  packages: ClientPackage[];
}

/** Describes service catalog item used by booking screens. */
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

/** Describes catalog category tab used by booking screens. */
export interface CatalogCategoryTab {
  id: string;
  label?: string;
  labelKey?: string;
}

/** Saved service or Package line, including its catalog and customer-purchase links. */
export interface BookingLineItem {
  id: string;
  name: string;
  type: 'package' | 'session' | 'unlisted';
  quantity: number;
  price: number;
  durationMinutes: number;
  packageSessionLinked?: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  catalogPackageId?: string | null;
  customerPackageId?: string | null;
  packageRemainingSessions?: number | null;
  packagePulseCount?: number | null;
  /** Package units billed as new customer-package purchases. */
  newPurchaseUnits?: number;
}

export const EMPTY_UNLISTED_FORM = {
  name: '',
  serviceCategoryId: null as string | null,
  offerType: 'singleSession' as const,
  durationMinutes: 30,
  sessionDurationUnit: 'minute' as const,
  price: 0,
};

export const UNLISTED_OFFER_TYPE_OPTIONS: {
  label: string;
  value: 'package' | 'singleSession';
}[] = [
  { label: 'PACKAGES.CREATE.OFFER_TYPE_SINGLE', value: 'singleSession' },
  { label: 'PACKAGES.CREATE.OFFER_TYPE_PACKAGE', value: 'package' },
];

export const UNLISTED_DURATION_UNIT_OPTIONS: {
  label: string;
  value: 'minute';
}[] = [{ label: 'PACKAGES.CREATE.DURATION_UNIT_MINUTE', value: 'minute' }];

/** Booking details shared by the calendar, register, and edit dialog. */
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
  paymentMethod: PaymentMethodId | null;
  totalAmount: number;
  paidAmount: number;
  discount: number;
  createdAt: Date;
  version?: string;
}

/** Temporary hold that prevents another booking from selecting its interval. */
export interface AppointmentAvailabilityBlock {
  id: string;
  employeeId: string;
  scheduledDate: Date;
  startMinutes: number;
  endMinutes: number;
  expiresAtUtc?: Date;
}

/** Describes calendar slot cell used by booking screens. */
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

/** Full selectable interval for the chosen session duration. */
export interface CalendarAvailableSlot {
  startMinutes: number;
  endMinutes: number;
}

/** Branch, employee, date, and interval selected before booking confirmation. */
export interface SlotSelection {
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  date: Date;
  startMinutes: number;
  slotDurationMinutes: number;
}

/** Customer, Package, branch, employee, and duration selection for Appointments. */
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
    name: 'د. سارة محمود',
    specialty: 'أخصائية ليزر',
    branchId: 'branch-1',
    avatarInitials: 'سم',
    avatarColor: '#7c3aed',
    workingDays: [],
  },
  {
    id: 'emp-2',
    name: 'آية الله يوحنا',
    specialty: 'أخصائية بشرة',
    branchId: 'branch-1',
    avatarInitials: 'آي',
    avatarColor: '#2563eb',
    workingDays: [],
  },
  {
    id: 'emp-3',
    name: 'ليلى اللوز',
    specialty: 'أخصائية جسم',
    branchId: 'branch-2',
    avatarInitials: 'لل',
    avatarColor: '#0891b2',
    workingDays: [],
  },
  {
    id: 'emp-4',
    name: 'جهاد محمد',
    specialty: 'أخصائية ليزر',
    branchId: 'branch-1',
    avatarInitials: 'جه',
    avatarColor: '#db2777',
    workingDays: [],
  },
  {
    id: 'emp-5',
    name: 'نورا حسين',
    specialty: 'أخصائية بشرة',
    branchId: 'branch-1',
    avatarInitials: 'نح',
    avatarColor: '#ea580c',
    workingDays: [],
  },
];

export const MOCK_PACKAGES: PackageOption[] = [
  {
    id: 'pkg-1',
    name: 'إزالة الشعر بالليزر - الجسم الكامل',
    durationMinutes: 60,
    serviceId: 'svc-4',
  },
  { id: 'pkg-2', name: 'تنظيف البشرة المتقدم', durationMinutes: 45, serviceId: 'svc-3' },
];

export const MOCK_CLIENTS: ClientRecord[] = [
  {
    id: 'client-1',
    name: 'أحمد علي محمد',
    mobile: '01012345678',
    registered: true,
    packages: [
      {
        customerPackageId: 'customer-package-1',
        packageId: 'pkg-1',
        packageName: 'إزالة الشعر بالليزر - الجسم الكامل',
        usedSessions: 3,
        totalSessions: 6,
        expiryDate: '2026-09-30',
      },
    ],
  },
  {
    id: 'client-2',
    name: 'مها سعد',
    mobile: '01098765432',
    registered: true,
    packages: [],
  },
  {
    id: 'client-3',
    name: 'جيهان علي',
    mobile: '01055556666',
    registered: true,
    packages: [
      {
        customerPackageId: 'customer-package-2',
        packageId: 'pkg-2',
        packageName: 'تنظيف البشرة المتقدم',
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
    name: 'جلسة ليزر نور',
    category: 'laser',
    durationMinutes: 30,
    price: 250,
    icon: 'pi pi-sun',
    type: 'session',
  },
  {
    id: 'svc-2',
    name: 'تقشير كيميائي',
    category: 'peeling',
    durationMinutes: 45,
    price: 350,
    icon: 'pi pi-sparkles',
    type: 'session',
  },
  {
    id: 'svc-3',
    name: 'تنظيف البشرة العميق',
    category: 'skin',
    durationMinutes: 45,
    price: 400,
    icon: 'pi pi-heart',
    type: 'session',
  },
  {
    id: 'svc-4',
    name: 'إزالة الشعر بالليزر - الجسم الكامل',
    category: 'services',
    durationMinutes: 60,
    price: 1200,
    icon: 'pi pi-box',
    type: 'package',
  },
  {
    id: 'svc-5',
    name: 'إزالة شعر ليزر منطقة صغيرة',
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

/** Creates a local calendar date from one-based month input. */
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

/** Provides sample bookings for screens that still use local demo data. */
function createInitialBookings(): BookingRecord[] {
  const scheduled = createDate(2026, 8, 18);
  return [
    {
      id: 'bk-1',
      bookingNumber: 'OP-250826-0154',
      status: 'booked',
      clientId: 'client-1',
      clientName: 'أحمد علي محمد',
      clientMobile: '01012345678',
      employeeId: 'emp-2',
      employeeName: 'آية الله يوحنا',
      branchId: 'branch-1',
      branchName: 'الفرع الرئيسي',
      sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
      scheduledDate: scheduled,
      startMinutes: 9 * 60 + 15,
      slotDurationMinutes: 60,
      lineItems: [
        {
          id: 'li-1',
          name: 'إزالة الشعر بالليزر - الجسم الكامل',
          type: 'package',
          quantity: 1,
          price: 400,
          durationMinutes: 60,
          packageSessionLinked: true,
        },
        {
          id: 'li-2',
          name: 'تنظيف البشرة العميق',
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
      clientName: 'مها سعد',
      clientMobile: '01098765432',
      employeeId: 'emp-1',
      employeeName: 'د. سارة محمود',
      branchId: 'branch-1',
      branchName: 'الفرع الرئيسي',
      sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
      scheduledDate: scheduled,
      startMinutes: 10 * 60,
      slotDurationMinutes: 30,
      lineItems: [
        {
          id: 'li-3',
          name: 'جلسة ليزر نور',
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
      clientName: 'جيهان علي',
      clientMobile: '01055556666',
      employeeId: 'emp-3',
      employeeName: 'ليلى اللوز',
      branchId: 'branch-2',
      branchName: 'فرع المعادي',
      sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
      scheduledDate: scheduled,
      startMinutes: 11 * 60,
      slotDurationMinutes: 60,
      lineItems: [
        {
          id: 'li-4',
          name: 'تقشير كيميائي',
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

/** Returns fresh sample bookings so callers cannot mutate the shared fixtures. */
export function cloneBookings(): BookingRecord[] {
  return createInitialBookings().map(booking => ({
    ...booking,
    scheduledDate: new Date(booking.scheduledDate),
    createdAt: new Date(booking.createdAt),
    lineItems: booking.lineItems.map(item => ({ ...item })),
  }));
}

/** Returns fresh sample customers and owned Package lists. */
export function cloneClients(): ClientRecord[] {
  return MOCK_CLIENTS.map(client => ({
    ...client,
    packages: client.packages.map(pkg => ({ ...pkg })),
  }));
}

/** Formats a local calendar date as YYYY-MM-DD without UTC conversion. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Moves a local date by whole calendar days without mutating the input. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Formats minutes after midnight as a 24-hour clock value. */
export function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Scales booking duration to the calendar's 30-minute row height. */
export function bookingBlockHeightPx(durationMinutes: number): number {
  return (durationMinutes / SLOT_INTERVAL_MINUTES) * SLOT_ROW_HEIGHT_PX;
}

/** Positions a booking relative to the visible calendar start time. */
export function bookingBlockTopPx(
  startMinutes: number,
  dayStartMinutes: number = DAY_START_MINUTES
): number {
  return ((startMinutes - dayStartMinutes) / SLOT_INTERVAL_MINUTES) * SLOT_ROW_HEIGHT_PX;
}

/** Formats a booking start and duration as a visible time range. */
export function formatTimeRange(startMinutes: number, durationMinutes: number): string {
  return `${formatMinutesAsTime(startMinutes)} - ${formatMinutesAsTime(startMinutes + durationMinutes)}`;
}

/** Builds a stable key from employee, local date, and slot start. */
export function slotKey(employeeId: string, date: Date, startMinutes: number): string {
  return `${employeeId}|${toDateKey(date)}|${startMinutes}`;
}

/** Generates a display number for local sample bookings. */
export function generateBookingNumber(): string {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = String(Math.floor(Math.random() * 9000) + 1000);
  return `OP-${stamp}-${random}`;
}

/** Finds a local sample customer after removing mobile whitespace. */
export function findClientByMobile(mobile: string, clients: ClientRecord[]): ClientRecord | null {
  const normalized = mobile.replace(/\s+/g, '');
  return clients.find(client => client.mobile.replace(/\s+/g, '') === normalized) ?? null;
}

/** Checks whether a booking occupies any part of a 30-minute calendar cell. */
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

/** Checks whether a booking begins exactly at a calendar cell boundary. */
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

/** Finds bookings starting within a calendar row, including offset starts. */
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

/** Converts a local date to the working-day code used by employee schedules. */
export function weekdayCode(date: Date): string {
  return WEEKDAY_CODES[date.getDay()];
}

/** Parses a clock value into minutes after midnight for calendar arithmetic. */
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

/** Returns enabled employee hours for the selected local day, if any. */
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

/** Requires the full proposed interval to fit inside enabled employee hours. */
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

/** Checks interval overlap for an employee on a local date. */
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

/** Derives up to two avatar initials from a customer's or employee's name. */
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

/** Chooses a stable avatar color from an identifier. */
export function avatarColorFromId(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

/** Rounds minutes down to a 30-minute calendar row boundary. */
export function floorToSlot(minutes: number): number {
  return Math.floor(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
}

/** Rounds minutes up to a 30-minute calendar row boundary. */
export function ceilToSlot(minutes: number): number {
  return Math.ceil(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
}

/** Keeps the 08:00–18:00 reference day visible and extends it for longer employee schedules. */
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

  const startMinutes = Math.min(DAY_START_MINUTES, floorToSlot(earliestStart));
  const endMinutes = Math.max(DAY_END_MINUTES, ceilToSlot(latestEnd));

  return { startMinutes, endMinutes };
}

/** Builds the 30-minute labels used by the calendar time axis. */
export function buildSlotRows(startMinutes: number, endMinutes: number): number[] {
  const rows: number[] = [];
  for (let minute = startMinutes; minute < endMinutes; minute += SLOT_INTERVAL_MINUTES) {
    rows.push(minute);
  }
  return rows;
}

/** Requires working hours and no overlapping booking or active hold for the full interval. */
export function isSlotAvailableForBooking(
  bookings: BookingRecord[],
  employeeId: string,
  date: Date,
  startMinutes: number,
  durationMinutes: number,
  hours: EmployeeWorkingHours | null,
  availabilityBlocks: AppointmentAvailabilityBlock[] = []
): boolean {
  if (!isWithinWorkingHours(hours, startMinutes, durationMinutes)) {
    return false;
  }
  const endMinutes = startMinutes + durationMinutes;
  const overlapsBooking = bookings.some(
    booking =>
      booking.status !== 'cancelled' &&
      bookingOverlapsRange(booking, employeeId, date, startMinutes, durationMinutes)
  );
  const overlapsBlock = availabilityBlocks.some(
    block =>
      block.employeeId === employeeId &&
      toDateKey(block.scheduledDate) === toDateKey(date) &&
      block.startMinutes < endMinutes &&
      block.endMinutes > startMinutes
  );
  return !overlapsBooking && !overlapsBlock;
}

/** Finds the first available start in 15-minute steps within employee hours. */
export function findRecommendedStart(
  bookings: BookingRecord[],
  employeeId: string,
  date: Date,
  durationMinutes: number,
  hours: EmployeeWorkingHours | null,
  availabilityBlocks: AppointmentAvailabilityBlock[] = []
): number | null {
  const searchStart = hours?.fromMinutes ?? DAY_START_MINUTES;
  const searchEnd = hours?.toMinutes ?? DAY_END_MINUTES;
  const alignedStart = Math.ceil(searchStart / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES;

  for (let start = alignedStart; start + durationMinutes <= searchEnd; start += SLOT_SNAP_MINUTES) {
    if (
      isSlotAvailableForBooking(
        bookings,
        employeeId,
        date,
        start,
        durationMinutes,
        hours,
        availabilityBlocks
      )
    ) {
      return start;
    }
  }
  return null;
}

/** Builds consecutive selectable intervals of the chosen duration, skipping occupied time. */
export function buildAvailableSlots(
  bookings: BookingRecord[],
  employeeId: string,
  date: Date,
  durationMinutes: number,
  workingDays: EmployeeWorkingHours[],
  availabilityBlocks: AppointmentAvailabilityBlock[] = []
): CalendarAvailableSlot[] {
  const hours = hoursForDate(workingDays, date);
  const effectiveDuration = durationMinutes > 0 ? durationMinutes : SLOT_INTERVAL_MINUTES;
  if (!hours || hours.fromMinutes === null || hours.toMinutes === null) {
    return [];
  }

  const slots: CalendarAvailableSlot[] = [];
  let start = Math.ceil(hours.fromMinutes / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES;

  while (start + effectiveDuration <= hours.toMinutes) {
    if (
      isSlotAvailableForBooking(
        bookings,
        employeeId,
        date,
        start,
        effectiveDuration,
        hours,
        availabilityBlocks
      )
    ) {
      slots.push({ startMinutes: start, endMinutes: start + effectiveDuration });
      start += effectiveDuration;
    } else {
      start += SLOT_SNAP_MINUTES;
    }
  }

  return slots;
}

/** Builds 30-minute visual cells, including bookings, holds, closed hours, and offset availability. */
export function buildSlotGrid(
  bookings: BookingRecord[],
  employeeId: string,
  date: Date,
  durationMinutes: number,
  workingDays: EmployeeWorkingHours[] = [],
  rangeStartMinutes: number = DAY_START_MINUTES,
  rangeEndMinutes: number = DAY_END_MINUTES,
  availabilityBlocks: AppointmentAvailabilityBlock[] = []
): CalendarSlotCell[] {
  const hours = hoursForDate(workingDays, date);
  const recommendedStart = findRecommendedStart(
    bookings,
    employeeId,
    date,
    durationMinutes,
    hours,
    availabilityBlocks
  );
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
    const held = availabilityBlocks.some(
      block =>
        block.employeeId === employeeId &&
        toDateKey(block.scheduledDate) === toDateKey(date) &&
        block.startMinutes < start + SLOT_INTERVAL_MINUTES &&
        block.endMinutes > start
    );

    let visual: SlotVisualState = 'available';
    let booking: BookingRecord | undefined;

    if (!isWithinWorkingHours(hours, start, SLOT_INTERVAL_MINUTES)) {
      visual = 'closed';
    } else if (overlapping.length > 0) {
      const primary = bookingAtStart ?? offsetBooking ?? overlapping[0];
      booking = primary;
      visual = primary.status === 'completed' ? 'completed' : 'booked';
    } else if (held) {
      visual = 'held';
    }

    const effectiveDuration = durationMinutes > 0 ? durationMinutes : SLOT_INTERVAL_MINUTES;
    const selectable =
      visual === 'available' &&
      isSlotAvailableForBooking(
        bookings,
        employeeId,
        date,
        start,
        effectiveDuration,
        hours,
        availabilityBlocks
      );

    const offsetStart = start + SLOT_SNAP_MINUTES;
    const offsetAvailable =
      !offsetBooking &&
      isSlotAvailableForBooking(
        bookings,
        employeeId,
        date,
        offsetStart,
        effectiveDuration,
        hours,
        availabilityBlocks
      );
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

/** Adds the durations of all selected service units. */
export function sumLineItemDuration(items: BookingLineItem[]): number {
  return items.reduce((total, item) => total + item.durationMinutes * item.quantity, 0);
}

/** Adds the prices of all selected service units. */
export function sumLineItemPrice(items: BookingLineItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

/** Reports whether a booking contains a Package session line. */
export function bookingHasPackage(booking: BookingRecord): boolean {
  return booking.lineItems.some(item => item.type === 'package' || item.packageSessionLinked);
}

/** Builds service choices available to the deferred close-booking flow. */
export function bookingPerformedServiceOptions(lineItems: BookingLineItem[]): SelectOption[] {
  const packages = lineItems.filter(item => item.type === 'package' || item.packageSessionLinked);
  const source = packages.length > 0 ? packages : lineItems;
  return source.map(item => ({
    label: item.name,
    value: item.id,
  }));
}

/** Limits calendar employees to the selected branch and employee filter. */
export function filterEmployees(
  employees: EmployeeOption[],
  employeeId: string | null
): EmployeeOption[] {
  if (!employeeId) {
    return employees;
  }
  return employees.filter(employee => employee.id === employeeId);
}

/** Keeps the selected employee when allowed, otherwise chooses the first filtered employee. */
export function resolveEmployeeForFourDayView(
  employees: EmployeeOption[],
  employeeId: string | null
): EmployeeOption | null {
  const filtered = filterEmployees(employees, employeeId);
  return filtered[0] ?? null;
}

/** Returns the initial local calendar date. */
export function defaultSelectedDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Returns the initial appointment filters and empty customer selection. */
export function defaultFilters(): AppointmentFilters {
  return {
    employeeId: null,
    branchId: null,
    durationMinutes: 0,
    packageId: null,
    clientName: '',
    clientMobile: '',
  };
}
