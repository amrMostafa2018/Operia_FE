import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { setupServerErrorClearing } from '@core/utils/validators.util';
import { extractApiFieldErrors, translateApiFieldErrors } from '@core/utils/api-error.util';
import { PackageService } from '@app/features/packages/package.service';
import {
  getCarouselNextIcon,
  getCarouselPrevIcon,
  getRtlStartScrollLeft,
} from '@app/shared/utils/rtl.util';
import {
  AppointmentsApiService,
  BookingCustomerDto,
  CloseBookingItemInput,
} from './appointments-api.service';
import {
  BookingLineItem,
  BookingRecord,
  BookingWordStatus,
  bookAppointmentLineTotal,
  bookAppointmentMaxQuantity,
  bookAppointmentOwnedPackageLineItem,
  bookingDetailsLineItemFromCatalog,
  bookingLineDisplaysPrice,
  CatalogCategoryTab,
  ClientPackage,
  ClientRecord,
  customerOwnsCatalogPackage,
  displayedPackageRemainingUnits,
  displayedPackageUsedUnits,
  EMPTY_UNLISTED_FORM,
  formatTimeRange,
  isBookingDetailsCatalogPurchaseLine,
  isOwnedPackageReservedOnBookingLine,
  normalizeBookingDetailsLineItems,
  packageUsesPulses,
  PaymentMethodId,
  PAYMENT_METHODS,
  ServiceCatalogItem,
  sumLineItemPrice,
  UNLISTED_DURATION_UNIT_OPTIONS,
  UNLISTED_OFFER_TYPE_OPTIONS,
} from './models/booking.model';
import { UnlistedCategoryFieldComponent } from './unlisted-category-field.component';
import {
  applyUnlistedPackageApiErrors,
  toLineItemFromCreatedPackage,
  toUnlistedPackagePayload,
} from './unlisted-package.util';
import { ConfirmPackageUsageDialogComponent } from './confirm-package-usage-dialog.component';

/** Describes booking details save payload used by the booking UI. */
export interface BookingDetailsSavePayload {
  bookingId: string;
  lineItems: BookingLineItem[];
  paymentMethod: PaymentMethodId | null;
}

/** Displays a saved booking and prepares edits or cancellation requests. */
@Component({
  selector: 'app-booking-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    TranslatePipe,
    UnlistedCategoryFieldComponent,
    ConfirmPackageUsageDialogComponent,
  ],
  templateUrl: './booking-details-dialog.component.html',
  styleUrl: './booking-details-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingDetailsDialogComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly permissions = inject(PermissionService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly packagesApi = inject(PackageService);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogTrack = viewChild<ElementRef<HTMLElement>>('catalogTrack');
  private carouselResizeObserver: ResizeObserver | null = null;
  readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly booking = input<BookingRecord | null>(null);
  readonly catalogItems = input<ServiceCatalogItem[]>([]);
  readonly catalogCategories = input<CatalogCategoryTab[]>([]);
  readonly catalogLoading = input(false);
  readonly saving = input(false);

  readonly closed = output<void>();
  readonly saved = output<BookingDetailsSavePayload>();
  readonly cancelBooking = output<string>();
  readonly bookingClosed = output<string>();
  readonly packageCreated = output<void>();

  readonly paymentMethods = signal<typeof PAYMENT_METHODS>([]);
  readonly paymentMethodsLoading = signal(false);
  readonly paymentMethodsUnavailable = signal(false);
  private paymentMethodsRequestId = 0;
  private draftBookingKey: string | null = null;
  readonly showCloseConfirm = signal(false);
  readonly closeSaving = signal(false);
  readonly showUnlisted = signal(false);
  readonly showServicePicker = signal(false);
  readonly pickerSource = signal<'customer' | 'catalog'>('customer');
  readonly showCatalogSection = signal(false);
  readonly catalogQuantities = signal<Record<string, number>>({});
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);
  readonly canActivateCatalogLeadingArrow = computed(() =>
    this.isRtl() ? this.canActivateCatalogNextInternal() : this.canActivateCatalogPrevInternal()
  );
  readonly canActivateCatalogTrailingArrow = computed(() =>
    this.isRtl() ? this.canActivateCatalogPrevInternal() : this.canActivateCatalogNextInternal()
  );
  readonly activeCategory = signal('all');
  readonly searchQuery = signal('');
  readonly customerPackagesLoading = signal(false);
  readonly unlistedSaving = signal(false);

  readonly unlistedForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    serviceCategoryId: this.fb.control<string | null>(null, Validators.required),
    offerType: [EMPTY_UNLISTED_FORM.offerType, Validators.required],
    durationMinutes: [
      EMPTY_UNLISTED_FORM.durationMinutes,
      [Validators.required, Validators.min(1)],
    ],
    sessionDurationUnit: [EMPTY_UNLISTED_FORM.sessionDurationUnit],
    price: [0, [Validators.required, Validators.min(0)]],
  });

  readonly durationUnitOptions = UNLISTED_DURATION_UNIT_OPTIONS;
  readonly offerTypeOptions = UNLISTED_OFFER_TYPE_OPTIONS;

  readonly draftLineItems = signal<BookingLineItem[]>([]);
  readonly draftPaymentMethod = signal<PaymentMethodId | null>(null);
  readonly draftPaidAmount = signal(0);
  readonly matchedClient = signal<ClientRecord | null>(null);
  private customerPackagesRequestId = 0;
  readonly savedMethodUnavailable = computed(() => {
    const method = this.draftPaymentMethod();
    return method !== null && !this.paymentMethods().some(option => option.id === method);
  });

  readonly canManage = computed(() => this.permissions.hasPermission(Policies.BookingsManage));
  readonly canCancel = computed(() => this.permissions.hasPermission(Policies.BookingsCancel));

  readonly isEditable = computed(() => this.booking()?.status === 'booked' && this.canManage());
  readonly canClose = computed(
    () =>
      this.booking()?.status === 'booked' &&
      this.canManage() &&
      (this.booking()?.lineItems.length ?? 0) > 0
  );
  readonly showActions = computed(
    () => this.booking()?.status === 'booked' && (this.canManage() || this.canCancel())
  );

  readonly categoryTabs = computed<CatalogCategoryTab[]>(() => [
    { id: 'all', labelKey: 'BOOKINGS.SERVICE_TABS.ALL' },
    ...this.catalogCategories(),
  ]);

  readonly customerPackages = computed(() => this.matchedClient()?.packages ?? []);

  readonly filteredCatalogItems = computed(() => {
    const category = this.activeCategory();
    const query = this.searchQuery().trim().toLowerCase();
    let services =
      category === 'all'
        ? this.catalogItems()
        : this.catalogItems().filter(service => service.category === category);

    if (query) {
      services = services.filter(service => service.name.toLowerCase().includes(query));
    }
    return services;
  });

  readonly totalAmount = computed(() => sumLineItemPrice(this.draftLineItems()));
  readonly remainingAmount = computed(() =>
    Math.max(this.totalAmount() - this.draftPaidAmount(), 0)
  );
  readonly isRtl = computed(() => this.languageService.currentLang() === 'ar');

  constructor() {
    setupServerErrorClearing(this.unlistedForm, this.destroyRef, [
      'name',
      'serviceCategoryId',
      'offerType',
      'durationMinutes',
      'price',
    ]);
    effect(
      () => {
        if (!this.visible()) {
          this.draftBookingKey = null;
          return;
        }
        const current = this.booking();
        if (!current) {
          return;
        }
        const bookingKey = `${current.id}:${current.version ?? ''}`;
        if (bookingKey === this.draftBookingKey) {
          return;
        }
        this.draftBookingKey = bookingKey;
        this.loadCustomerPackages(current);
        this.draftPaymentMethod.set(current.paymentMethod);
        this.draftPaidAmount.set(current.paidAmount);
        this.showUnlisted.set(false);
        this.showServicePicker.set(false);
        this.pickerSource.set('customer');
        this.showCatalogSection.set(false);
        this.catalogQuantities.set({});
        this.activeCategory.set('all');
        this.searchQuery.set('');
        this.unlistedForm.reset({ ...EMPTY_UNLISTED_FORM });
      },
      { allowSignalWrites: true }
    );
    effect(
      () => {
        if (this.visible()) {
          this.loadPaymentMethods();
        }
      },
      { allowSignalWrites: true }
    );
    effect(
      () => {
        if (!this.visible() || !this.showServicePicker() || this.pickerSource() !== 'catalog') {
          return;
        }
        this.filteredCatalogItems();
        this.isRtl();
        this.showCatalogSection();
        this.catalogTrack();
        this.refreshCarouselState();
      },
      { allowSignalWrites: true }
    );
  }

  ngAfterViewInit(): void {
    this.refreshCarouselState();
  }

  ngOnDestroy(): void {
    this.carouselResizeObserver?.disconnect();
  }

  /** Loads owned packages for purchase-only pricing when editing booking lines. */
  loadCustomerPackages(booking: BookingRecord): void {
    const requestId = ++this.customerPackagesRequestId;
    this.customerPackagesLoading.set(true);
    this.matchedClient.set(null);
    this.initializeDraftLineItems(booking, []);
    this.appointmentsApi
      .findCustomer(booking.clientMobile, booking.id)
      .pipe(
        map(customer => (customer ? this.toClientRecord(customer) : null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: client => {
          if (requestId !== this.customerPackagesRequestId) {
            return;
          }
          this.customerPackagesLoading.set(false);
          this.matchedClient.set(client);
          this.initializeDraftLineItems(booking, client?.packages ?? []);
        },
        error: () => {
          if (requestId !== this.customerPackagesRequestId) {
            return;
          }
          this.customerPackagesLoading.set(false);
          this.initializeDraftLineItems(booking, []);
        },
      });
  }

  private initializeDraftLineItems(booking: BookingRecord, ownedPackages: ClientPackage[]): void {
    const normalized = normalizeBookingDetailsLineItems(
      booking.lineItems,
      this.catalogItems(),
      ownedPackages
    );
    this.draftLineItems.set(normalized);
    this.catalogQuantities.set(this.extractCatalogQuantities(normalized));
  }

  private renormalizeDraftLineItems(items: BookingLineItem[]): BookingLineItem[] {
    const ownedPackages = this.matchedClient()?.packages ?? [];
    return normalizeBookingDetailsLineItems(items, this.catalogItems(), ownedPackages);
  }

  /** Loads currently enabled payment methods for the booking form. */
  loadPaymentMethods(): void {
    const requestId = ++this.paymentMethodsRequestId;
    this.paymentMethodsLoading.set(true);
    this.paymentMethodsUnavailable.set(false);
    this.paymentMethods.set([]);
    this.appointmentsApi
      .getPaymentMethods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: enabledIds => {
          if (requestId !== this.paymentMethodsRequestId) {
            return;
          }
          this.paymentMethodsLoading.set(false);
          this.paymentMethods.set(PAYMENT_METHODS.filter(method => enabledIds.includes(method.id)));
        },
        error: () => {
          if (requestId !== this.paymentMethodsRequestId) {
            return;
          }
          this.paymentMethodsLoading.set(false);
          this.paymentMethodsUnavailable.set(true);
        },
      });
  }

  /** Stores the selected enabled payment method in the booking draft. */
  selectPaymentMethod(method: PaymentMethodId): void {
    if (!this.isEditable() || !this.paymentMethods().some(option => option.id === method)) {
      return;
    }
    this.draftPaymentMethod.set(method);
  }

  statusClass(status: BookingWordStatus): string {
    switch (status) {
      case 'booked':
        return 'status-booked';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
    }
  }

  statusKey(status: BookingWordStatus): string {
    switch (status) {
      case 'booked':
        return 'BOOKING_STATUS.BOOKED';
      case 'completed':
        return 'BOOKING_STATUS.COMPLETED';
      case 'cancelled':
        return 'BOOKING_STATUS.CANCELLED';
    }
  }

  lineTypeKey(type: BookingLineItem['type']): string {
    switch (type) {
      case 'package':
        return 'BOOKINGS.DETAILS.TYPE_PACKAGE';
      case 'session':
        return 'BOOKINGS.DETAILS.TYPE_SESSION';
      default:
        return 'BOOKINGS.DETAILS.TYPE_UNLISTED';
    }
  }

  lineTypeClass(type: BookingLineItem['type']): string {
    switch (type) {
      case 'package':
        return 'type-package';
      case 'session':
        return 'type-session';
      default:
        return 'type-unlisted';
    }
  }

  lineIcon(item: BookingLineItem): string {
    if (item.type === 'package') {
      return 'pi pi-box';
    }
    if (item.type === 'session') {
      return 'pi pi-sun';
    }
    return 'pi pi-ellipsis-h';
  }

  createdAtLabel(booking: BookingRecord): string {
    return booking.createdAt.toLocaleString(this.languageService.currentLang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  scheduledLabel(booking: BookingRecord): string {
    const date = booking.scheduledDate.toLocaleDateString(this.languageService.currentLang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const time = formatTimeRange(booking.startMinutes, booking.slotDurationMinutes);
    return `${date}، ${time}`;
  }

  lineTotal(item: BookingLineItem): number {
    return bookAppointmentLineTotal(item);
  }

  lineItemTrackKey(item: BookingLineItem): string {
    return item.id;
  }

  showsLinePrice(item: BookingLineItem): boolean {
    return bookingLineDisplaysPrice(item);
  }

  packageRemainingSessions(item: BookingLineItem): number | null {
    if (isBookingDetailsCatalogPurchaseLine(item)) {
      return null;
    }
    if (item.type !== 'package' && !item.packageSessionLinked) {
      return null;
    }
    return item.packageRemainingSessions ?? null;
  }

  packageRemainingLabelKey(item: BookingLineItem): string {
    return item.packagePulseCount != null && item.packagePulseCount > 0
      ? 'BOOKINGS.DETAILS.REMAINING_PULSES'
      : 'BOOKINGS.DETAILS.REMAINING_SESSIONS';
  }

  unlistedNameError(): string | null {
    return this.unlistedControlError(this.unlistedForm.controls.name, {
      required: 'BOOKINGS.DETAILS.ERRORS.UNLISTED_NAME_REQUIRED',
      maxlength: 'ERRORS.PACKAGE_NAME_MAX',
    });
  }

  unlistedOfferTypeError(): string | null {
    return this.unlistedControlError(this.unlistedForm.controls.offerType, {
      required: 'BOOKINGS.DETAILS.ERRORS.UNLISTED_OFFER_TYPE_REQUIRED',
    });
  }

  unlistedDurationError(): string | null {
    return this.unlistedControlError(this.unlistedForm.controls.durationMinutes, {
      required: 'BOOKINGS.DETAILS.ERRORS.UNLISTED_DURATION_REQUIRED',
      min: 'BOOKINGS.DETAILS.ERRORS.UNLISTED_DURATION_MIN',
    });
  }

  unlistedPriceError(): string | null {
    return this.unlistedControlError(this.unlistedForm.controls.price, {
      required: 'BOOKINGS.DETAILS.ERRORS.UNLISTED_PRICE_REQUIRED',
      min: 'BOOKINGS.DETAILS.ERRORS.UNLISTED_PRICE_MIN',
    });
  }

  async copyBookingNumber(number: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(number);
      this.toast.add({
        severity: 'success',
        summary: this.translate.instant('BOOKINGS.DETAILS.COPY_SUCCESS'),
      });
    } catch {
      this.toast.add({
        severity: 'error',
        summary: this.translate.instant('BOOKINGS.DETAILS.COPY_FAILED'),
      });
    }
  }

  removeLineItem(itemId: string, itemIndex?: number): void {
    if (!this.isEditable()) {
      return;
    }
    const items = this.draftLineItems();
    const index = itemIndex ?? items.findIndex(item => item.id === itemId);
    if (index < 0) {
      return;
    }
    const next = [...items.slice(0, index), ...items.slice(index + 1)];
    this.catalogQuantities.set(this.extractCatalogQuantities(next));
    this.draftLineItems.set(
      normalizeBookingDetailsLineItems(
        next,
        this.catalogItems(),
        this.matchedClient()?.packages ?? []
      )
    );
  }

  toggleServicePicker(): void {
    const opening = !this.showServicePicker();
    this.showServicePicker.set(opening);
    if (!opening) {
      return;
    }
    this.activeCategory.set('all');
    this.searchQuery.set('');
    this.pickerSource.set('customer');
  }

  setPickerSource(source: 'customer' | 'catalog'): void {
    this.pickerSource.set(source);
    if (source === 'catalog') {
      this.showCatalogSection.set(true);
      this.refreshCarouselState();
    }
  }

  setCategory(category: string): void {
    this.activeCategory.set(category);
    this.refreshCarouselState();
  }

  onCatalogSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  isPackageOnBooking(packageId: string, customerPackageId?: string): boolean {
    return this.draftLineItems().some(item => {
      if (customerPackageId) {
        return item.customerPackageId === customerPackageId;
      }
      return item.type === 'package' && item.catalogPackageId === packageId;
    });
  }

  ownedPackageSelectable(pkg: ClientPackage): boolean {
    return this.catalogItems().some(item => item.id === pkg.packageId);
  }

  /** True when the customer already has a balance for this catalog package. */
  customerOwnsCatalogItem(serviceId: string): boolean {
    const ownedPackages = this.matchedClient()?.packages ?? [];
    return customerOwnsCatalogPackage(serviceId, ownedPackages);
  }

  customerPackageRemaining(pkg: ClientPackage): number {
    return displayedPackageRemainingUnits(pkg);
  }

  customerPackageRemainingLabel(pkg: ClientPackage): string {
    return packageUsesPulses(pkg)
      ? 'BOOKINGS.DETAILS.REMAINING_PULSES'
      : 'BOOKINGS.DETAILS.REMAINING_SESSIONS';
  }

  packageExpiryLabel(expiryDate: string): string {
    if (!expiryDate) {
      return '';
    }
    const parsed = new Date(expiryDate);
    if (Number.isNaN(parsed.getTime())) {
      return expiryDate;
    }
    return parsed.toLocaleDateString(this.languageService.currentLang(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  addOwnedPackage(pkg: ClientPackage): void {
    if (!this.isEditable()) {
      return;
    }
    if (!this.ownedPackageSelectable(pkg)) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('BOOKINGS.DETAILS.PACKAGE_NOT_IN_CATALOG'),
      });
      return;
    }
    if (this.draftLineItems().some(item => item.customerPackageId === pkg.customerPackageId)) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('BOOKINGS.DETAILS.PACKAGE_ALREADY_ON_BOOKING'),
      });
      return;
    }
    const service = this.catalogItems().find(item => item.id === pkg.packageId);
    if (!service) {
      return;
    }
    this.draftLineItems.update(items =>
      this.renormalizeDraftLineItems([...items, bookAppointmentOwnedPackageLineItem(pkg, service)])
    );
  }

  changeCatalogQuantity(service: ServiceCatalogItem, delta: number): void {
    if (!this.isEditable()) {
      return;
    }
    const current = this.catalogQuantities();
    const previous = current[service.id] ?? 0;
    const next = Math.min(bookAppointmentMaxQuantity(service), Math.max(0, previous + delta));
    if (next === previous) {
      return;
    }

    if (delta > 0 && previous === 0 && this.customerOwnsCatalogItem(service.id)) {
      this.toast.add({
        severity: 'warn',
        summary: this.translate.instant('BOOKINGS.DETAILS.PACKAGE_ALREADY_OWNED'),
        detail: this.translate.instant('BOOKINGS.DETAILS.PACKAGE_ALREADY_OWNED_HINT'),
      });
    }

    this.catalogQuantities.set({ ...current, [service.id]: next });
    this.rebuildCatalogLinesInDraft();
  }

  catalogQuantityFor(serviceId: string): number {
    return this.catalogQuantities()[serviceId] ?? 0;
  }

  canIncreaseCatalogQuantity(service: ServiceCatalogItem): boolean {
    return this.catalogQuantityFor(service.id) < bookAppointmentMaxQuantity(service);
  }

  catalogLeadingArrowIcon(): string {
    const lang = this.languageService.currentLang();
    return this.isRtl() ? getCarouselNextIcon(lang) : getCarouselPrevIcon(lang);
  }

  catalogTrailingArrowIcon(): string {
    const lang = this.languageService.currentLang();
    return this.isRtl() ? getCarouselPrevIcon(lang) : getCarouselNextIcon(lang);
  }

  scrollCatalogLeadingArrow(): void {
    if (this.isRtl()) {
      this.scrollCatalogNextInternal();
      return;
    }
    this.scrollCatalogPrevInternal();
  }

  scrollCatalogTrailingArrow(): void {
    if (this.isRtl()) {
      this.scrollCatalogPrevInternal();
      return;
    }
    this.scrollCatalogNextInternal();
  }

  private canActivateCatalogPrevInternal(): boolean {
    return this.isRtl() ? this.canScrollRight() : this.canScrollLeft();
  }

  private canActivateCatalogNextInternal(): boolean {
    return this.isRtl() ? this.canScrollLeft() : this.canScrollRight();
  }

  private scrollCatalogPrevInternal(): void {
    this.scrollCatalog(this.isRtl() ? 1 : -1);
  }

  private scrollCatalogNextInternal(): void {
    this.scrollCatalog(this.isRtl() ? -1 : 1);
  }

  scrollCatalog(visualDirection: -1 | 1): void {
    const track = this.catalogTrack()?.nativeElement;
    if (!track) {
      return;
    }

    const cards = Array.from(track.querySelectorAll<HTMLElement>('.service-card'));
    if (cards.length === 0) {
      this.updateScrollState();
      return;
    }

    const trackRect = track.getBoundingClientRect();
    const epsilon = 4;
    let target: HTMLElement | undefined;

    if (visualDirection < 0) {
      const overflowingLeft = cards.filter(
        card => card.getBoundingClientRect().left < trackRect.left - epsilon
      );
      target = overflowingLeft[overflowingLeft.length - 1];
    } else {
      target = cards.find(card => card.getBoundingClientRect().right > trackRect.right + epsilon);
    }

    if (!target) {
      this.updateScrollState();
      return;
    }

    const cardRect = target.getBoundingClientRect();
    const scrollDelta =
      visualDirection < 0 ? cardRect.left - trackRect.left : cardRect.right - trackRect.right;
    track.scrollTo({ left: track.scrollLeft + scrollDelta, behavior: 'smooth' });
    window.setTimeout(() => this.updateScrollState(), 350);
  }

  onCatalogTrackScroll(): void {
    this.updateScrollState();
  }

  /** Validates and creates an unlisted service before adding it to the booking draft. */
  addUnlisted(): void {
    if (!this.isEditable() || this.unlistedSaving()) {
      return;
    }
    this.unlistedForm.markAllAsTouched();
    if (this.unlistedForm.invalid) {
      return;
    }
    if (!this.permissions.hasPermission(Policies.PackagesManage)) {
      this.toast.add({
        severity: 'error',
        summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
        detail: this.translate.instant('BOOKINGS.DETAILS.UNLISTED_NO_PERMISSION'),
      });
      return;
    }

    const payload = toUnlistedPackagePayload(this.unlistedForm.getRawValue());
    this.unlistedSaving.set(true);
    this.packagesApi
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: created => {
          this.unlistedSaving.set(false);
          this.draftLineItems.update(items => [...items, toLineItemFromCreatedPackage(created)]);
          this.unlistedForm.reset({ ...EMPTY_UNLISTED_FORM });
          this.showUnlisted.set(false);
          this.packageCreated.emit();
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('PACKAGES.TITLE'),
            detail: this.translate.instant('BOOKINGS.DETAILS.UNLISTED_ADDED'),
          });
        },
        error: (error: HttpErrorResponse) => {
          this.unlistedSaving.set(false);
          const hasFieldErrors = applyUnlistedPackageApiErrors(this.unlistedForm, error, key =>
            this.translate.instant(key)
          );
          if (!hasFieldErrors) {
            this.toast.add({
              severity: 'error',
              summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
              detail:
                (error as HttpErrorResponse & { userMessage?: string }).userMessage ??
                this.translate.instant('HTTP_ERRORS.SERVER'),
            });
          }
        },
      });
  }

  /** Emits edited booking lines and payment method for the parent to persist. */
  save(): void {
    const current = this.booking();
    if (!current || !this.isEditable() || this.saving()) {
      return;
    }
    if (this.draftLineItems().length === 0) {
      this.toast.add({
        severity: 'error',
        summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
        detail: this.translate.instant('ERRORS.BookingItemsRequired'),
      });
      return;
    }
    this.saved.emit({
      bookingId: current.id,
      lineItems: this.draftLineItems(),
      paymentMethod: this.draftPaymentMethod(),
    });
  }

  /** Requests the parent confirmation flow for this booking. */
  requestCancel(): void {
    const current = this.booking();
    if (!current || !this.canCancel() || this.saving()) {
      return;
    }
    this.cancelBooking.emit(current.id);
  }

  /** Opens the close-and-confirm usage dialog for every booking line. */
  requestCloseBooking(): void {
    const current = this.booking();
    if (!current || !this.canClose() || this.saving()) {
      return;
    }
    this.showCloseConfirm.set(true);
  }

  /** Persists close outcomes for all booking lines. */
  onCloseConfirmed(items: CloseBookingItemInput[]): void {
    const current = this.booking();
    if (!current?.version || this.closeSaving()) {
      return;
    }

    this.closeSaving.set(true);
    this.appointmentsApi
      .closeBooking(current.id, current.version, items)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closeSaving.set(false);
          this.showCloseConfirm.set(false);
          this.toast.add({
            severity: 'success',
            summary: this.translate.instant('BOOKINGS.CLOSE.SUCCESS'),
          });
          this.bookingClosed.emit(current.id);
          this.closed.emit();
        },
        error: (error: HttpErrorResponse) => {
          this.closeSaving.set(false);
          this.showCloseApiErrors(error);
        },
      });
  }

  closeCloseConfirm(): void {
    if (this.closeSaving()) {
      return;
    }
    this.showCloseConfirm.set(false);
  }

  close(): void {
    if (this.saving() || this.closeSaving()) {
      return;
    }
    this.closed.emit();
  }

  private showCloseApiErrors(error: HttpErrorResponse): void {
    const translated = translateApiFieldErrors(extractApiFieldErrors(error), key =>
      this.translate.instant(key)
    );
    const entries = Object.entries(translated);
    if (entries.length > 0) {
      for (const [, message] of entries) {
        this.toast.add({
          severity: 'error',
          summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
          detail: message,
        });
      }
      return;
    }

    this.toast.add({
      severity: 'error',
      summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
      detail:
        (error as HttpErrorResponse & { userMessage?: string }).userMessage ??
        this.translate.instant('HTTP_ERRORS.SERVER'),
    });
  }

  private toClientRecord(customer: BookingCustomerDto): ClientRecord {
    return {
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
  }

  private unlistedControlError(
    control: AbstractControl,
    messages: Record<string, string>
  ): string | null {
    if (!control.touched && !control.dirty) {
      return null;
    }
    for (const key of Object.keys(messages)) {
      if (control.hasError(key)) {
        return messages[key];
      }
    }
    if (control.hasError('server')) {
      return String(control.getError('server'));
    }
    return null;
  }

  private rebuildCatalogLinesInDraft(): void {
    const ownedPackages = this.matchedClient()?.packages ?? [];
    const catalogItems = this.catalogItems();
    const preserved = this.draftLineItems().filter(item => this.isPreservedBookingLine(item));
    const catalogLines: BookingLineItem[] = [];

    for (const service of catalogItems) {
      const quantity = this.catalogQuantities()[service.id] ?? 0;
      if (quantity <= 0) {
        continue;
      }
      catalogLines.push({
        ...bookingDetailsLineItemFromCatalog(
          service,
          quantity,
          [],
          [...preserved, ...catalogLines]
        ),
        id: `line-${service.id}`,
      });
    }

    this.draftLineItems.set(
      normalizeBookingDetailsLineItems([...preserved, ...catalogLines], catalogItems, ownedPackages)
    );
  }

  private isPreservedBookingLine(item: BookingLineItem): boolean {
    if (item.type === 'unlisted' || item.id.startsWith('line-owned-')) {
      return true;
    }
    if (item.catalogPackageId && item.id === `line-${item.catalogPackageId}`) {
      return false;
    }
    return true;
  }

  private extractCatalogQuantities(items: readonly BookingLineItem[]): Record<string, number> {
    const quantities: Record<string, number> = {};
    for (const item of items) {
      if (!item.catalogPackageId || this.isPreservedBookingLine(item)) {
        continue;
      }
      quantities[item.catalogPackageId] = item.quantity;
    }
    return quantities;
  }

  private refreshCarouselState(): void {
    queueMicrotask(() => {
      this.bindCarouselObserver();
      this.resetCarouselScroll();
      this.updateScrollState();
      window.setTimeout(() => {
        this.bindCarouselObserver();
        this.resetCarouselScroll();
        this.updateScrollState();
      }, 150);
    });
  }

  private bindCarouselObserver(): void {
    const track = this.catalogTrack()?.nativeElement;
    if (!track) {
      return;
    }

    this.carouselResizeObserver?.disconnect();
    this.carouselResizeObserver = new ResizeObserver(() => this.updateScrollState());
    this.carouselResizeObserver.observe(track);
  }

  private resetCarouselScroll(): void {
    const track = this.catalogTrack()?.nativeElement;
    if (!track) {
      return;
    }
    track.scrollLeft = getRtlStartScrollLeft(track, this.isRtl());
  }

  private updateScrollState(): void {
    const track = this.catalogTrack()?.nativeElement;
    if (!track) {
      this.canScrollLeft.set(false);
      this.canScrollRight.set(false);
      return;
    }

    const cards = Array.from(track.querySelectorAll<HTMLElement>('.service-card'));
    if (cards.length === 0) {
      this.canScrollLeft.set(false);
      this.canScrollRight.set(false);
      return;
    }

    const trackRect = track.getBoundingClientRect();
    const firstRect = cards[0].getBoundingClientRect();
    const lastRect = cards[cards.length - 1].getBoundingClientRect();
    const epsilon = 4;
    let overflowLeft = Math.min(firstRect.left, lastRect.left) < trackRect.left - epsilon;
    let overflowRight = Math.max(firstRect.right, lastRect.right) > trackRect.right + epsilon;
    const hasScrollableContent = track.scrollWidth - track.clientWidth > epsilon;
    if (hasScrollableContent && !overflowLeft && !overflowRight) {
      overflowLeft = this.isRtl();
      overflowRight = !this.isRtl();
    }

    this.canScrollLeft.set(overflowLeft);
    this.canScrollRight.set(overflowRight);
  }
}
