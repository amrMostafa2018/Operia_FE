import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  concat,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  timer,
} from 'rxjs';
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
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { setupServerErrorClearing } from '@core/utils/validators.util';
import { PackageService } from '@app/features/packages/package.service';
import { AppointmentsApiService } from './appointments-api.service';
import { getRtlStartScrollLeft } from '@app/shared/utils/rtl.util';
import {
  BookingLineItem,
  CatalogCategoryTab,
  ClientPackage,
  ClientRecord,
  EMPTY_UNLISTED_FORM,
  UNLISTED_DURATION_UNIT_OPTIONS,
  UNLISTED_OFFER_TYPE_OPTIONS,
  bookAppointmentCatalogQuantityLineItem,
  bookAppointmentLineDuration,
  bookAppointmentLineTotal,
  bookAppointmentMaxQuantity,
  bookAppointmentOwnedPackageLineItem,
  bookAppointmentPaymentLineItems,
  ServiceCatalogItem,
  SlotSelection,
  displayedPackageRemainingUnits,
  displayedPackageUsedUnits,
  formatTimeRange,
  packageUsesPulses,
  PaymentMethodId,
  PAYMENT_METHODS,
} from './models/booking.model';
import { UnlistedCategoryFieldComponent } from './unlisted-category-field.component';
import {
  applyUnlistedPackageApiErrors,
  toLineItemFromCreatedPackage,
  toUnlistedPackagePayload,
} from './unlisted-package.util';

/** Describes book appointment payload used by the booking UI. */
export interface BookAppointmentPayload {
  selection: SlotSelection;
  clientName: string;
  clientMobile: string;
  clientId: string | null;
  lineItems: BookingLineItem[];
  serviceDuration: number;
  paymentMethod: PaymentMethodId | null;
}

/** Describes customer lookup state used by the booking UI. */
interface CustomerLookupState {
  mobile: string;
  client: ClientRecord | null;
  pending: boolean;
}

/** Collects customer, item, and payment choices for a proposed appointment. */
@Component({
  selector: 'app-book-appointment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    DropdownModule,
    MultiSelectModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    TranslatePipe,
    UnlistedCategoryFieldComponent,
  ],
  templateUrl: './book-appointment-dialog.component.html',
  styleUrl: './book-appointment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookAppointmentDialogComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly currencyService = inject(CurrencyService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly packagesApi = inject(PackageService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly packageUsesPulses = packageUsesPulses;
  readonly displayedPackageRemainingUnits = displayedPackageRemainingUnits;

  private readonly serviceTrack = viewChild<ElementRef<HTMLElement>>('serviceTrack');
  private carouselResizeObserver?: ResizeObserver;
  readonly visible = input(false);
  readonly selection = input<SlotSelection | null>(null);
  readonly clients = input<ClientRecord[]>([]);
  readonly catalogItems = input<ServiceCatalogItem[]>([]);
  readonly catalogCategories = input<CatalogCategoryTab[]>([]);
  readonly catalogLoading = input(false);
  readonly saving = input(false);
  readonly initialClientName = input('');
  readonly initialClientMobile = input('');
  readonly initialPackageId = input<string | null>(null);
  readonly initialLineItems = input<BookingLineItem[]>([]);

  readonly closed = output<void>();
  readonly confirmBooking = output<BookAppointmentPayload>();
  readonly packageCreated = output<void>();

  readonly categoryTabs = computed<CatalogCategoryTab[]>(() => [
    { id: 'all', labelKey: 'BOOKINGS.SERVICE_TABS.ALL' },
    ...this.catalogCategories(),
  ]);
  readonly activeCategory = signal('all');
  readonly searchQuery = signal('');
  readonly selectedQuantities = signal<Record<string, number>>({});
  readonly unlistedItems = signal<BookingLineItem[]>([]);
  readonly selectedPackageIds = signal<string[]>([]);
  readonly showServicesSection = signal(false);
  readonly showUnlisted = signal(false);
  readonly unlistedSaving = signal(false);

  readonly clientForm = this.fb.nonNullable.group({
    mobile: ['', Validators.required],
    name: ['', Validators.required],
  });

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

  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);

  readonly paymentMethods = signal<typeof PAYMENT_METHODS>([]);
  readonly paymentMethodsLoading = signal(false);
  readonly paymentMethodsUnavailable = signal(false);
  private paymentMethodsRequestId = 0;
  readonly draftPaymentMethod = signal<PaymentMethodId | null>(null);

  private readonly clientMobile = toSignal(this.clientForm.controls.mobile.valueChanges, {
    initialValue: this.clientForm.controls.mobile.value,
  });

  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly customerLookup = toSignal(
    this.clientForm.controls.mobile.valueChanges.pipe(
      startWith(this.clientForm.controls.mobile.value),
      map(mobile => mobile.trim()),
      distinctUntilChanged(),
      switchMap(mobile => {
        const pending: CustomerLookupState = { mobile, client: null, pending: !!mobile };
        if (!mobile) {
          return of({ ...pending, pending: false });
        }
        return concat(
          of(pending),
          timer(250).pipe(
            switchMap(() =>
              this.appointmentsApi.findCustomer(mobile).pipe(
                map(
                  customer =>
                    ({
                      mobile,
                      pending: false,
                      client: customer
                        ? ({
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
                          } satisfies ClientRecord)
                        : null,
                    }) satisfies CustomerLookupState
                ),
                catchError(() => of({ mobile, client: null, pending: false }))
              )
            )
          )
        );
      })
    ),
    { initialValue: { mobile: '', client: null, pending: false } as CustomerLookupState }
  );

  readonly matchedClient = computed(() => {
    const mobile = this.clientMobile().trim();
    if (!mobile) {
      return null;
    }
    const local = this.clients().find(client => client.mobile === mobile) ?? null;
    const lookup = this.customerLookup();
    if (lookup.mobile !== mobile || lookup.pending) {
      return local;
    }
    return lookup.client ?? local;
  });

  readonly customerLookupPending = computed(() => {
    const mobile = this.clientMobile().trim();
    const hasLocalMatch = this.clients().some(client => client.mobile === mobile);
    const lookup = this.customerLookup();
    return !!mobile && !hasLocalMatch && lookup.mobile === mobile && lookup.pending;
  });

  readonly packageOptions = computed(() => {
    const client = this.matchedClient();
    if (client?.packages.length) {
      return client.packages
        .filter(
          (pkg, index, all) => all.findIndex(item => item.packageId === pkg.packageId) === index
        )
        .map(pkg => ({
          label: pkg.packageName,
          value: pkg.packageId,
        }));
    }
    return [];
  });

  readonly selectedClientPackages = computed<ClientPackage[]>(() => {
    const client = this.matchedClient();
    if (!client) {
      return [];
    }
    const selectedIds = new Set(this.selectedPackageIds());
    return client.packages.filter(pkg => selectedIds.has(pkg.packageId));
  });

  readonly filteredServices = computed(() => {
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

  readonly lineItems = computed<BookingLineItem[]>(() => {
    const quantities = this.selectedQuantities();
    const items: BookingLineItem[] = [];
    const catalogItems = this.catalogItems();

    for (const clientPackage of this.selectedClientPackages()) {
      const service = catalogItems.find(item => item.id === clientPackage.packageId);
      if (!service) {
        continue;
      }
      items.push(bookAppointmentOwnedPackageLineItem(clientPackage, service));
    }

    const ownedPackages = this.matchedClient()?.packages ?? [];
    for (const service of catalogItems) {
      const rawQuantity = quantities[service.id] ?? 0;
      const quantity = Math.min(rawQuantity, bookAppointmentMaxQuantity(service));
      if (quantity <= 0) {
        continue;
      }
      items.push(bookAppointmentCatalogQuantityLineItem(service, quantity, ownedPackages, items));
    }

    items.push(...this.unlistedItems());

    return items;
  });

  readonly paymentLineItems = computed(() => bookAppointmentPaymentLineItems(this.lineItems()));

  readonly serviceDuration = computed(() =>
    this.lineItems().reduce((total, item) => {
      if (item.type === 'unlisted') {
        return total + item.durationMinutes * item.quantity;
      }
      return (
        total +
        bookAppointmentLineDuration(
          { type: item.type, durationMinutes: item.durationMinutes },
          item.quantity
        )
      );
    }, 0)
  );
  readonly subtotal = computed(() =>
    this.paymentLineItems().reduce((total, item) => total + bookAppointmentLineTotal(item), 0)
  );
  readonly netTotal = computed(() => this.subtotal());
  readonly hasPayableItems = computed(() => this.paymentLineItems().length > 0);
  readonly sessionCount = computed(() =>
    this.lineItems().reduce((total, item) => total + item.quantity, 0)
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
          return;
        }

        untracked(() => {
          this.clientForm.reset({
            mobile: this.initialClientMobile(),
            name: this.initialClientName(),
          });
          this.unlistedForm.reset({ ...EMPTY_UNLISTED_FORM });
          this.unlistedItems.set(this.extractUnlistedItems(this.initialLineItems()));
          this.selectedQuantities.set(this.buildQuantitiesFromLineItems(this.initialLineItems()));
          const selectedPackageIds = this.buildOwnedPackageIdsFromLineItems(
            this.initialLineItems()
          );
          const initialPackageId = this.initialPackageId();
          if (initialPackageId && !selectedPackageIds.includes(initialPackageId)) {
            selectedPackageIds.push(initialPackageId);
          }
          this.selectedPackageIds.set(selectedPackageIds);
          this.showServicesSection.set(false);
          this.showUnlisted.set(false);
          this.activeCategory.set('all');
          this.searchQuery.set('');
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
        });
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const validIds = new Set(this.packageOptions().map(option => option.value));
        const filtered = this.selectedPackageIds().filter(id => validIds.has(id));
        if (filtered.length !== this.selectedPackageIds().length) {
          this.selectedPackageIds.set(filtered);
        }
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        if (this.visible()) {
          const client = this.matchedClient();
          if (client) {
            const mobile = client.mobile;
            if (this.clients().every(c => c.mobile !== mobile)) {
              this.clientForm.controls.name.setValue(client.name);
            }
          }
          this.loadPaymentMethods();
        } else {
          this.clientForm.reset({ mobile: '', name: '' });
        }
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        if (!this.visible()) {
          return;
        }
        this.filteredServices();
        this.isRtl();
        this.showServicesSection();
        queueMicrotask(() => {
          this.bindCarouselObserver();
          this.resetCarouselScroll();
          this.updateScrollState();
        });
      },
      { allowSignalWrites: true }
    );
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.bindCarouselObserver();
      this.resetCarouselScroll();
      this.updateScrollState();
    });
  }

  ngOnDestroy(): void {
    this.carouselResizeObserver?.disconnect();
  }

  scrollServices(visualDirection: -1 | 1): void {
    const track = this.serviceTrack()?.nativeElement;
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
    const delta =
      visualDirection < 0 ? cardRect.left - trackRect.left : cardRect.right - trackRect.right;
    track.scrollTo({ left: track.scrollLeft + delta, behavior: 'smooth' });
    window.setTimeout(() => this.updateScrollState(), 350);
  }

  onServiceTrackScroll(): void {
    this.updateScrollState();
  }

  private bindCarouselObserver(): void {
    const track = this.serviceTrack()?.nativeElement;
    if (!track) {
      return;
    }

    this.carouselResizeObserver?.disconnect();
    this.carouselResizeObserver = new ResizeObserver(() => this.updateScrollState());
    this.carouselResizeObserver.observe(track);
  }

  private resetCarouselScroll(): void {
    const track = this.serviceTrack()?.nativeElement;
    if (!track) {
      return;
    }
    track.scrollLeft = getRtlStartScrollLeft(track, this.isRtl());
  }

  private updateScrollState(): void {
    const track = this.serviceTrack()?.nativeElement;
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
    const overflowLeft = Math.min(firstRect.left, lastRect.left) < trackRect.left - 4;
    const overflowRight = Math.max(firstRect.right, lastRect.right) > trackRect.right + 4;

    this.canScrollLeft.set(overflowLeft);
    this.canScrollRight.set(overflowRight);
  }

  slotDateLabel(slot: SlotSelection): string {
    return slot.date.toLocaleDateString(this.languageService.currentLang(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  slotTimeLabel(slot: SlotSelection): string {
    return formatTimeRange(slot.startMinutes, slot.slotDurationMinutes);
  }

  lineTypeKey(type: BookingLineItem['type']): string {
    switch (type) {
      case 'package':
        return 'BOOKINGS.DETAILS.TYPE_PACKAGE';
      case 'session':
        return 'BOOKINGS.BOOK.SESSION_LABEL';
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

  lineTotal(item: BookingLineItem): number {
    return bookAppointmentLineTotal(item);
  }

  mobileError(): string | null {
    const control = this.clientForm.controls.mobile;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'BOOKINGS.BOOK.ERRORS.MOBILE_REQUIRED';
    }
    return null;
  }

  nameError(): string | null {
    const control = this.clientForm.controls.name;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'BOOKINGS.BOOK.ERRORS.NAME_REQUIRED';
    }
    return null;
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

  setCategory(category: string): void {
    this.activeCategory.set(category);
  }

  changeQuantity(service: ServiceCatalogItem, delta: number): void {
    const current = this.selectedQuantities();
    const maxQuantity = bookAppointmentMaxQuantity(service);
    const next = Math.min(maxQuantity, Math.max(0, (current[service.id] ?? 0) + delta));
    this.selectedQuantities.set({ ...current, [service.id]: next });
  }

  canIncreaseQuantity(service: ServiceCatalogItem): boolean {
    return this.quantityFor(service.id) < bookAppointmentMaxQuantity(service);
  }

  quantityFor(serviceId: string): number {
    return this.selectedQuantities()[serviceId] ?? 0;
  }

  removeLineItem(itemId: string): void {
    const ownedMatch = itemId.match(/^line-owned-(.+)$/);
    if (ownedMatch) {
      this.removeSelectedOwnedLine(ownedMatch[1]);
      return;
    }

    const serviceId = itemId.replace(/^line-/, '');
    const current = this.selectedQuantities();
    if (serviceId in current) {
      const next = { ...current };
      delete next[serviceId];
      this.selectedQuantities.set(next);
      return;
    }
    this.unlistedItems.update(items => items.filter(item => item.id !== itemId));
  }

  onPackageIdsChange(packageIds: string[] | null): void {
    this.selectedPackageIds.set(packageIds ?? []);
  }

  /** Validates and creates an unlisted service before adding it to the booking draft. */
  addUnlisted(): void {
    if (this.unlistedSaving()) {
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
          this.unlistedItems.update(items => [...items, toLineItemFromCreatedPackage(created)]);
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

  /** Validates the booking draft and emits the selected customer, items, slot, and payment method. */
  submit(): void {
    if (this.saving() || this.customerLookupPending()) {
      return;
    }
    this.clientForm.markAllAsTouched();
    if (this.clientForm.invalid || !this.selection()) {
      return;
    }
    if (this.customerLookupPending()) {
      return;
    }
    const client = this.matchedClient();
    if (!client) {
      this.toast.add({
        severity: 'error',
        summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
        detail: this.translate.instant('BOOKINGS.BOOK.CUSTOMER_NOT_REGISTERED'),
      });
      return;
    }
    if (this.lineItems().length === 0) {
      this.toast.add({
        severity: 'error',
        summary: this.translate.instant('BOOKINGS.BOOK.SERVICE_REQUIRED'),
      });
      return;
    }

    this.confirmBooking.emit({
      selection: this.selection()!,
      clientName: this.clientForm.controls.name.value.trim(),
      clientMobile: this.clientForm.controls.mobile.value.trim(),
      clientId: client.id,
      lineItems: this.lineItems(),
      serviceDuration: this.serviceDuration(),
      paymentMethod: this.draftPaymentMethod(),
    });
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

          if (enabledIds.length > 0 && !this.draftPaymentMethod()) {
            this.draftPaymentMethod.set(enabledIds[0]);
          }
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
    if (!this.paymentMethods().some(option => option.id === method)) {
      return;
    }
    this.draftPaymentMethod.set(method);
  }

  close(): void {
    if (this.saving()) {
      return;
    }
    this.closed.emit();
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

  private initialServiceQuantities(): Record<string, number> {
    const fromLineItems = this.buildQuantitiesFromLineItems(this.initialLineItems());
    if (Object.keys(fromLineItems).length > 0) {
      return fromLineItems;
    }

    const packageId = this.initialPackageId();
    if (!packageId) {
      return {};
    }

    const catalogItem = this.catalogItems().find(item => item.id === packageId);
    if (!catalogItem) {
      return {};
    }

    return { [catalogItem.id]: 1 };
  }

  private buildOwnedPackageIdsFromLineItems(items: BookingLineItem[]): string[] {
    const packageIds: string[] = [];
    for (const item of items) {
      if (!item.catalogPackageId) {
        continue;
      }
      if (
        item.packageSessionLinked ||
        (item.customerPackageId && (item.newPurchaseUnits ?? 0) === 0)
      ) {
        packageIds.push(item.catalogPackageId);
      }
    }
    return packageIds;
  }

  private buildQuantitiesFromLineItems(items: BookingLineItem[]): Record<string, number> {
    const quantities: Record<string, number> = {};
    for (const item of items) {
      if (item.type === 'unlisted' || item.packageSessionLinked) {
        continue;
      }
      if (item.type === 'package' && item.customerPackageId && (item.newPurchaseUnits ?? 0) === 0) {
        continue;
      }
      const serviceId = item.catalogPackageId ?? item.id.replace(/^line-(?:owned-)?/, '');
      quantities[serviceId] = item.quantity;
    }
    return quantities;
  }

  private extractUnlistedItems(items: BookingLineItem[]): BookingLineItem[] {
    return items.filter(item => item.type === 'unlisted');
  }

  private removeSelectedPackageId(packageId: string): void {
    this.selectedPackageIds.update(ids => ids.filter(id => id !== packageId));
  }

  private removeSelectedOwnedLine(ownedLineKey: string): void {
    const client = this.matchedClient();
    const ownedPackage =
      client?.packages.find(pkg => pkg.customerPackageId === ownedLineKey) ??
      client?.packages.find(pkg => pkg.packageId === ownedLineKey);
    if (ownedPackage) {
      this.removeSelectedPackageId(ownedPackage.packageId);
    }
  }
}
