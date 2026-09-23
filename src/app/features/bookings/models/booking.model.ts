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

/** True when the customer already owns a catalog package balance. */
export function customerOwnsCatalogPackage(
  catalogPackageId: string,
  ownedPackages: readonly ClientPackage[]
): boolean {
  return ownedPackages.some(pkg => pkg.packageId === catalogPackageId);
}

/** True when a booking line already reserves the owned package session for this catalog item. */
export function isOwnedPackageReservedOnBookingLine(line: BookingLineItem): boolean {
  return (
    line.type === 'package' &&
    !!line.packageSessionLinked &&
    (line.newPurchaseUnits ?? 0) === 0 &&
    !!line.customerPackageId
  );
}

/** Units that create new customer-package purchases and are charged at catalog price. */
export function bookAppointmentNewPurchaseUnits(
  service: Pick<ServiceCatalogItem, 'type' | 'id'>,
  quantity: number,
  ownedPackage: ClientPackage | null,
  ownedPackages: readonly ClientPackage[] = []
): number {
  if (quantity <= 0) {
    return 0;
  }

  if (service.type !== 'package') {
    return ownedPackage != null && quantity === 1 ? 0 : quantity;
  }

  const customerOwnsCatalog =
    ownedPackage != null || customerOwnsCatalogPackage(service.id, ownedPackages);

  return customerOwnsCatalog ? Math.max(0, quantity - 1) : quantity;
}

export function bookAppointmentMaxQuantity(_service: Pick<ServiceCatalogItem, 'type'>): number {
  return BOOKING_ITEM_MAX_QUANTITY;
}

/** Builds a booking line for an owned client package selected outside the catalog carousel. */
export function bookAppointmentOwnedPackageLineItem(
  clientPackage: ClientPackage,
  service: ServiceCatalogItem
): BookingLineItem {
  return {
    id: `line-owned-${clientPackage.customerPackageId}`,
    name: service.name,
    type: service.type,
    quantity: 1,
    price: bookAppointmentCatalogUnitPrice(service, clientPackage, 1),
    newPurchaseUnits: 0,
    durationMinutes: service.durationMinutes,
    packageSessionLinked: true,
    catalogPackageId: service.id,
    customerPackageId: clientPackage.customerPackageId,
  };
}

/** Sessions already linked to a package balance on the same booking draft. */
export function linkedPackageSessionCount(
  lineItems: readonly BookingLineItem[],
  customerPackageId: string,
  excludeLineId?: string
): number {
  return lineItems.filter(
    line =>
      line.id !== excludeLineId &&
      line.type === 'session' &&
      line.packageSessionLinked &&
      line.customerPackageId === customerPackageId
  ).length;
}

/** Fills package-line metadata from the customer's owned packages when the API snapshot is partial. */
export function enrichPackageLineFromOwnedPackages(
  line: BookingLineItem,
  ownedPackages: readonly ClientPackage[]
): BookingLineItem {
  if (line.type !== 'package' || !line.catalogPackageId) {
    return line;
  }

  if (isBookingDetailsCatalogPurchaseLine(line)) {
    return line;
  }

  const owned =
    (line.customerPackageId
      ? ownedPackages.find(pkg => pkg.customerPackageId === line.customerPackageId)
      : null) ?? ownedPackages.find(pkg => pkg.packageId === line.catalogPackageId);
  if (!owned) {
    return line;
  }

  return {
    ...line,
    customerPackageId: line.customerPackageId ?? owned.customerPackageId,
    packageRemainingSessions:
      line.packageRemainingSessions ?? displayedPackageRemainingUnits(owned),
    packagePulseCount: line.packagePulseCount ?? owned.pulseCount ?? null,
  };
}

/** Remaining package sessions available on this booking after linked session lines. */
export function remainingPackageSessionsOnBookingLine(
  packageLine: BookingLineItem,
  lineItems: readonly BookingLineItem[],
  excludeLineId?: string
): number {
  const enriched = enrichPackageLineFromOwnedPackages(packageLine, []);
  if (enriched.type !== 'package' || !enriched.customerPackageId) {
    return 0;
  }

  const snapshotRemaining = enriched.packageRemainingSessions;
  if (snapshotRemaining == null) {
    return 0;
  }

  return Math.max(
    0,
    snapshotRemaining -
      linkedPackageSessionCount(lineItems, enriched.customerPackageId, excludeLineId)
  );
}

/** Remaining package balance for a booking line using snapshot and owned-package fallbacks. */
export function effectivePackageRemainingOnBookingLine(
  packageLine: BookingLineItem,
  ownedPackages: readonly ClientPackage[],
  lineItems: readonly BookingLineItem[],
  excludeLineId?: string
): number {
  const enriched = enrichPackageLineFromOwnedPackages(packageLine, ownedPackages);
  const fromSnapshot = remainingPackageSessionsOnBookingLine(enriched, lineItems, excludeLineId);
  if (fromSnapshot > 0) {
    return fromSnapshot;
  }

  if (!enriched.customerPackageId) {
    return 0;
  }

  const owned = ownedPackages.find(pkg => pkg.customerPackageId === enriched.customerPackageId);
  if (!owned) {
    return 0;
  }

  const linked = linkedPackageSessionCount(lineItems, enriched.customerPackageId, excludeLineId);
  return Math.max(0, displayedPackageRemainingUnits(owned) - linked);
}

/** Builds a client-package view from a package line snapshot on the booking. */
export function clientPackageFromBookingLine(line: BookingLineItem): ClientPackage | null {
  if (line.type !== 'package' || !line.customerPackageId || !line.catalogPackageId) {
    return null;
  }

  const remaining = line.packageRemainingSessions ?? 0;
  if (remaining <= 0) {
    return null;
  }

  return {
    customerPackageId: line.customerPackageId,
    packageId: line.catalogPackageId,
    packageName: line.name,
    usedSessions: 0,
    totalSessions: remaining,
    expiryDate: '',
    offerType: 'package',
    sessionCount: line.packagePulseCount ? null : remaining,
    pulseCount: line.packagePulseCount ?? null,
  };
}

/** Where owned-package resolution may look for a matching balance. */
export type ResolveOwnedPackageMode = 'bookAppointment' | 'bookingDetails';

/** Finds a directly owned single-session package for the same catalog product. */
export function resolveDirectOwnedSessionPackage(
  service: ServiceCatalogItem,
  ownedPackages: readonly ClientPackage[],
  item?: Pick<BookingLineItem, 'customerPackageId' | 'price'>
): ClientPackage | null {
  if (service.type !== 'session') {
    return null;
  }

  const direct = ownedPackages.find(
    pkg => pkg.packageId === service.id && displayedPackageRemainingUnits(pkg) > 0
  );
  if (direct) {
    return direct;
  }

  if (!item?.customerPackageId || item.price !== 0) {
    return null;
  }

  const linked = ownedPackages.find(pkg => pkg.customerPackageId === item.customerPackageId);
  if (linked?.packageId === service.id && displayedPackageRemainingUnits(linked) > 0) {
    return linked;
  }

  return null;
}

/** Finds the owned customer package that should cover a catalog line. */
export function resolveOwnedPackageForCatalogLine(
  service: ServiceCatalogItem,
  ownedPackages: readonly ClientPackage[],
  lineItems: readonly BookingLineItem[],
  excludeLineId?: string,
  mode: ResolveOwnedPackageMode = 'bookAppointment'
): ClientPackage | null {
  const hasRemaining = (pkg: ClientPackage) => displayedPackageRemainingUnits(pkg) > 0;

  const direct = ownedPackages.find(pkg => pkg.packageId === service.id && hasRemaining(pkg));
  if (direct) {
    if (
      service.type === 'package' &&
      lineItems.some(
        line =>
          line.id !== excludeLineId &&
          line.catalogPackageId === service.id &&
          isOwnedPackageReservedOnBookingLine(line)
      )
    ) {
      return null;
    }

    return direct;
  }

  if (service.type !== 'session' || mode === 'bookingDetails') {
    return null;
  }

  for (const line of lineItems) {
    if (excludeLineId && line.id === excludeLineId) {
      continue;
    }
    if (line.type !== 'package' && !line.packageSessionLinked) {
      continue;
    }
    const customerPackageId = line.customerPackageId;
    if (!customerPackageId) {
      continue;
    }

    if (line.type === 'package') {
      const packageLine = enrichPackageLineFromOwnedPackages(line, ownedPackages);
      const remainingOnBooking = effectivePackageRemainingOnBookingLine(
        packageLine,
        ownedPackages,
        lineItems,
        excludeLineId
      );
      if (remainingOnBooking <= 0) {
        continue;
      }

      const resolvedCustomerPackageId = packageLine.customerPackageId ?? customerPackageId;
      const pkg = ownedPackages.find(item => item.customerPackageId === resolvedCustomerPackageId);
      if (pkg) {
        return pkg;
      }

      const snapshot = clientPackageFromBookingLine({
        ...packageLine,
        customerPackageId: resolvedCustomerPackageId,
        packageRemainingSessions: remainingOnBooking,
      });
      if (snapshot) {
        return snapshot;
      }

      continue;
    }

    const pkg = ownedPackages.find(item => item.customerPackageId === customerPackageId);
    if (pkg && hasRemaining(pkg)) {
      return pkg;
    }
  }

  return null;
}

/** Builds a catalog carousel line; package quantities are always treated as purchases. */
export function bookAppointmentCatalogQuantityLineItem(
  service: ServiceCatalogItem,
  quantity: number,
  ownedPackages: readonly ClientPackage[],
  lineItems: readonly BookingLineItem[] = []
): BookingLineItem {
  const ownedPackage =
    service.type === 'session'
      ? resolveDirectOwnedSessionPackage(service, ownedPackages)
      : resolveOwnedPackageForCatalogLine(service, ownedPackages, lineItems, `line-${service.id}`);
  const newPurchaseUnits =
    service.type === 'package'
      ? quantity
      : bookAppointmentNewPurchaseUnits(service, quantity, ownedPackage, ownedPackages);
  const usesOwnedSession = service.type === 'session' && ownedPackage != null && quantity === 1;

  return {
    id: `line-${service.id}`,
    name: service.name,
    type: service.type,
    quantity,
    price: usesOwnedSession ? 0 : bookAppointmentCatalogUnitPrice(service, ownedPackage, quantity),
    newPurchaseUnits,
    durationMinutes: service.durationMinutes,
    packageSessionLinked: usesOwnedSession,
    catalogPackageId: service.id,
    customerPackageId: usesOwnedSession
      ? ownedPackage.customerPackageId
      : bookAppointmentCustomerPackageId(),
  };
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

/** True when a saved booking session line already consumed a directly owned session balance. */
export function isPersistedOwnedSessionLineItem(
  item: Pick<
    BookingLineItem,
    'type' | 'price' | 'packageSessionLinked' | 'customerPackageId' | 'catalogPackageId'
  >
): boolean {
  return (
    item.type === 'session' &&
    item.price === 0 &&
    (!!item.packageSessionLinked || !!item.customerPackageId)
  );
}

/** True when a saved session line still maps to a directly owned session product. */
export function isPersistedDirectOwnedSessionLineItem(
  item: BookingLineItem,
  service: ServiceCatalogItem,
  ownedPackages: readonly ClientPackage[]
): boolean {
  if (item.type !== 'session') {
    return false;
  }

  if (!item.packageSessionLinked && item.price !== 0 && !item.customerPackageId) {
    return false;
  }

  if (!item.customerPackageId) {
    return item.price === 0 && !!item.packageSessionLinked;
  }

  const linked = ownedPackages.find(pkg => pkg.customerPackageId === item.customerPackageId);
  if (linked) {
    return linked.packageId === service.id;
  }

  if (ownedPackages.length === 0 && item.packageSessionLinked) {
    return true;
  }

  return item.price === 0 && !!item.packageSessionLinked;
}

/** True when a session line uses an owned customer package and should not be billed. */
export function isOwnedSessionLineItem(
  item: Pick<BookingLineItem, 'type' | 'price' | 'packageSessionLinked' | 'customerPackageId'>
): boolean {
  return isPersistedOwnedSessionLineItem(item);
}

/** Billable amount for one booking line item. */
export function bookAppointmentLineTotal(
  item: Pick<
    BookingLineItem,
    | 'type'
    | 'price'
    | 'quantity'
    | 'newPurchaseUnits'
    | 'packageSessionLinked'
    | 'customerPackageId'
  >
): number {
  if (item.type === 'package') {
    return item.price * (item.newPurchaseUnits ?? 0);
  }

  if (isOwnedSessionLineItem(item)) {
    return 0;
  }

  return item.price * item.quantity;
}

/** True when a booking line should show a price in the UI. */
export function bookingLineDisplaysPrice(item: BookingLineItem): boolean {
  return bookAppointmentLineTotal(item) > 0;
}

/** Booking lines that require payment (excludes owned-package usage with zero charge). */
export function bookAppointmentPaymentLineItems(items: BookingLineItem[]): BookingLineItem[] {
  return items.filter(item => bookAppointmentLineTotal(item) > 0);
}

/** Calendar duration contributed by one catalog line. */
export function bookAppointmentLineDuration(
  service: Pick<ServiceCatalogItem, 'type' | 'durationMinutes'>,
  quantity: number
): number {
  if (service.type === 'package') {
    return quantity > 0 ? service.durationMinutes : 0;
  }

  return service.durationMinutes * quantity;
}

/** Bookings no longer link a package session; purchases are recorded separately. */
export function bookAppointmentCustomerPackageId(): string | null {
  return null;
}

/** Maps a booking line item to the API item type. */
export function bookAppointmentApiItemType(item: BookingLineItem): string {
  if (item.type === 'package' && !item.packageSessionLinked) {
    return 'packagePurchase';
  }

  return item.type;
}

/**
 * Customer package id sent to the API.
 * Sessions covered by a multi-session package on the same booking stay linked in the UI only.
 */
export function bookingLineCustomerPackageIdForApi(
  item: BookingLineItem,
  lineItems: readonly BookingLineItem[]
): string | null {
  if (!item.customerPackageId) {
    return null;
  }

  if (
    item.type === 'session' &&
    item.packageSessionLinked &&
    item.catalogPackageId &&
    lineItems.some(
      line =>
        line.type === 'package' &&
        line.customerPackageId === item.customerPackageId &&
        line.catalogPackageId &&
        line.catalogPackageId !== item.catalogPackageId
    )
  ) {
    return null;
  }

  return item.customerPackageId;
}

/** Maps a booking line item to the booking API payload shape. */
export function mapBookingLineToApiItem(
  item: BookingLineItem,
  lineItems: readonly BookingLineItem[]
): {
  packageId: string;
  customerPackageId: string | null;
  quantity: number;
  type: string;
} {
  return {
    packageId: item.catalogPackageId!,
    customerPackageId: bookingLineCustomerPackageIdForApi(item, lineItems),
    quantity: item.quantity,
    type: bookAppointmentApiItemType(item),
  };
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

/** Adds the billable prices of all selected service units. */
export function sumLineItemPrice(items: BookingLineItem[]): number {
  return items.reduce((total, item) => total + bookAppointmentLineTotal(item), 0);
}

function packageBalanceFieldsFromOwned(
  ownedPackage: ClientPackage | null
): Pick<BookingLineItem, 'packageRemainingSessions' | 'packagePulseCount'> {
  if (!ownedPackage) {
    return {};
  }

  return {
    packageRemainingSessions: displayedPackageRemainingUnits(ownedPackage),
    packagePulseCount: ownedPackage.pulseCount ?? null,
  };
}

/** True when a booking-details catalog pick should stay a billed new purchase. */
export function isBookingDetailsCatalogPurchaseLine(
  item: Pick<
    BookingLineItem,
    'type' | 'packageSessionLinked' | 'newPurchaseUnits' | 'quantity' | 'customerPackageId'
  >
): boolean {
  return (
    (item.type === 'package' || item.type === 'session') &&
    !item.packageSessionLinked &&
    (item.newPurchaseUnits ?? 0) >= item.quantity
  );
}

/** Builds a catalog line for booking details using owned-package purchase rules. */
export function bookingDetailsLineItemFromCatalog(
  service: ServiceCatalogItem,
  quantity: number,
  ownedPackages: readonly ClientPackage[],
  lineItems: readonly BookingLineItem[] = [],
  lineId?: string
): BookingLineItem {
  const id = lineId ?? `line-${service.id}-${lineItems.length}-${Date.now()}`;
  const enrichedLineItems = lineItems.map(line =>
    enrichPackageLineFromOwnedPackages(line, ownedPackages)
  );
  const ownedPackage =
    service.type === 'session'
      ? resolveDirectOwnedSessionPackage(service, ownedPackages)
      : resolveOwnedPackageForCatalogLine(
          service,
          ownedPackages,
          enrichedLineItems,
          id,
          'bookingDetails'
        );
  const usesOwnedSession = service.type === 'session' && ownedPackage != null && quantity === 1;
  const newPurchaseUnits = bookAppointmentNewPurchaseUnits(
    service,
    quantity,
    ownedPackage,
    ownedPackages
  );
  const catalogOwnedPackage =
    ownedPackage ?? ownedPackages.find(pkg => pkg.packageId === service.id) ?? null;
  const usesOwnedPackageOnBooking =
    service.type === 'package' && newPurchaseUnits === 0 && ownedPackage != null;

  return {
    id,
    name: service.name,
    type: service.type,
    quantity,
    price: usesOwnedSession ? 0 : bookAppointmentCatalogUnitPrice(service, ownedPackage, quantity),
    newPurchaseUnits,
    durationMinutes: service.durationMinutes,
    packageSessionLinked: usesOwnedSession || usesOwnedPackageOnBooking,
    catalogPackageId: service.id,
    customerPackageId: usesOwnedSession
      ? (ownedPackage?.customerPackageId ?? null)
      : itemCustomerPackageIdForPackageLine(service, ownedPackage, quantity, ownedPackages),
    ...packageBalanceFieldsFromOwned(usesOwnedPackageOnBooking ? catalogOwnedPackage : null),
  };
}

function itemCustomerPackageIdForPackageLine(
  service: ServiceCatalogItem,
  ownedPackage: ClientPackage | null,
  quantity: number,
  ownedPackages: readonly ClientPackage[] = []
): string | null {
  if (service.type !== 'package' || !ownedPackage) {
    return bookAppointmentCustomerPackageId();
  }

  return bookAppointmentNewPurchaseUnits(service, quantity, ownedPackage, ownedPackages) === 0
    ? ownedPackage.customerPackageId
    : bookAppointmentCustomerPackageId();
}

/** Drops duplicate owned-package rows that share the same customer balance. */
export function dedupeOwnedPackageBookingLines(
  items: readonly BookingLineItem[]
): BookingLineItem[] {
  const seenOwnedPackageKeys = new Set<string>();
  return items.filter(item => {
    if (item.type !== 'package' || !item.packageSessionLinked) {
      return true;
    }

    const key = item.customerPackageId ?? item.id;
    if (seenOwnedPackageKeys.has(key)) {
      return false;
    }

    seenOwnedPackageKeys.add(key);
    return true;
  });
}

/** Recomputes purchase-only pricing for every editable booking line. */
export function normalizeBookingDetailsLineItems(
  items: BookingLineItem[],
  catalogItems: ServiceCatalogItem[],
  ownedPackages: readonly ClientPackage[]
): BookingLineItem[] {
  const dedupedItems = dedupeOwnedPackageBookingLines(items);
  const enrichedItems = dedupedItems.map(item =>
    enrichPackageLineFromOwnedPackages(item, ownedPackages)
  );
  return enrichedItems.map(item =>
    normalizeBookingDetailsLineItem(item, catalogItems, ownedPackages, enrichedItems)
  );
}

/** Recomputes purchase-only pricing and API flags for an editable booking line. */
export function normalizeBookingDetailsLineItem(
  item: BookingLineItem,
  catalogItems: ServiceCatalogItem[],
  ownedPackages: readonly ClientPackage[],
  lineItems: readonly BookingLineItem[] = []
): BookingLineItem {
  if (item.type === 'unlisted' || !item.catalogPackageId) {
    return item;
  }

  const service = catalogItems.find(catalogItem => catalogItem.id === item.catalogPackageId);
  if (!service) {
    return item.type === 'package' ? { ...item, packageSessionLinked: false } : item;
  }

  const enrichedLineItems = lineItems.map(line =>
    enrichPackageLineFromOwnedPackages(line, ownedPackages)
  );
  const ownedPackage =
    service.type === 'session'
      ? resolveDirectOwnedSessionPackage(service, ownedPackages, item)
      : ((item.customerPackageId
          ? ownedPackages.find(pkg => pkg.customerPackageId === item.customerPackageId)
          : null) ??
        resolveOwnedPackageForCatalogLine(
          service,
          ownedPackages,
          enrichedLineItems,
          item.id,
          'bookingDetails'
        ));
  const quantity = item.quantity;
  const usesOwnedSession =
    service.type === 'session' &&
    quantity === 1 &&
    (ownedPackage != null || isPersistedDirectOwnedSessionLineItem(item, service, ownedPackages));

  const catalogOwnedPackage =
    ownedPackage ?? ownedPackages.find(pkg => pkg.packageId === service.id) ?? null;

  if (isBookingDetailsCatalogPurchaseLine(item)) {
    return {
      ...item,
      price: service.price,
      newPurchaseUnits: quantity,
      packageSessionLinked: false,
      customerPackageId: bookAppointmentCustomerPackageId(),
      ...(service.type === 'package'
        ? { packageRemainingSessions: null, packagePulseCount: null }
        : {}),
    };
  }

  if (service.type === 'package') {
    const newPurchaseUnits = isOwnedPackageReservedOnBookingLine(item)
      ? 0
      : bookAppointmentNewPurchaseUnits(
          service,
          quantity,
          ownedPackage,
          ownedPackages
        );
    const usesOwnedPackageOnBooking =
      newPurchaseUnits === 0 &&
      (ownedPackage != null ||
        isOwnedPackageReservedOnBookingLine(item) ||
        (!!item.customerPackageId && (item.packageSessionLinked ?? false)));
    const balanceFields = packageBalanceFieldsFromOwned(
      usesOwnedPackageOnBooking ? catalogOwnedPackage : null
    );

    return {
      ...item,
      price: bookAppointmentCatalogUnitPrice(service, ownedPackage, quantity),
      newPurchaseUnits,
      packageSessionLinked: usesOwnedPackageOnBooking,
      customerPackageId:
        item.customerPackageId ??
        itemCustomerPackageIdForPackageLine(service, ownedPackage, quantity, ownedPackages),
      packageRemainingSessions:
        balanceFields.packageRemainingSessions ?? item.packageRemainingSessions ?? null,
      packagePulseCount: balanceFields.packagePulseCount ?? item.packagePulseCount ?? null,
    };
  }

  return {
    ...item,
    price: usesOwnedSession ? 0 : bookAppointmentCatalogUnitPrice(service, ownedPackage, quantity),
    newPurchaseUnits: bookAppointmentNewPurchaseUnits(
      service,
      quantity,
      ownedPackage,
      ownedPackages
    ),
    packageSessionLinked: usesOwnedSession,
    customerPackageId: usesOwnedSession
      ? (ownedPackage?.customerPackageId ?? item.customerPackageId ?? null)
      : bookAppointmentCustomerPackageId(),
  };
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
