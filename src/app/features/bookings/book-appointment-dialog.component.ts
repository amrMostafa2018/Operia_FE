import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { getRtlStartScrollLeft } from '@app/shared/utils/rtl.util';
import {
  BookingLineItem,
  CatalogCategoryTab,
  ClientPackage,
  ClientRecord,
  PaymentMethodId,
  PAYMENT_METHODS,
  ServiceCatalogItem,
  SlotSelection,
  formatTimeRange,
  sumLineItemDuration,
  sumLineItemPrice,
} from './models/booking.model';

export interface BookAppointmentPayload {
  selection: SlotSelection;
  clientName: string;
  clientMobile: string;
  clientId: string | null;
  lineItems: BookingLineItem[];
  paymentMethod: PaymentMethodId;
  discount: number;
  sendMessage: boolean;
  serviceDuration: number;
}

@Component({
  selector: 'app-book-appointment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    DropdownModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    TranslatePipe,
  ],
  templateUrl: './book-appointment-dialog.component.html',
  styleUrl: './book-appointment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookAppointmentDialogComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly currencyService = inject(CurrencyService);
  private readonly languageService = inject(LanguageService);

  private readonly serviceTrack = viewChild<ElementRef<HTMLElement>>('serviceTrack');
  private carouselResizeObserver?: ResizeObserver;

  readonly visible = input(false);
  readonly selection = input<SlotSelection | null>(null);
  readonly clients = input<ClientRecord[]>([]);
  readonly catalogItems = input<ServiceCatalogItem[]>([]);
  readonly catalogCategories = input<CatalogCategoryTab[]>([]);
  readonly catalogLoading = input(false);
  readonly initialClientName = input('');
  readonly initialClientMobile = input('');
  readonly initialPackageId = input<string | null>(null);

  readonly closed = output<void>();
  readonly confirmBooking = output<BookAppointmentPayload>();

  readonly categoryTabs = computed<CatalogCategoryTab[]>(() => [
    { id: 'all', labelKey: 'BOOKINGS.SERVICE_TABS.ALL' },
    ...this.catalogCategories(),
  ]);
  readonly paymentMethods = PAYMENT_METHODS;
  readonly activeCategory = signal('all');
  readonly searchQuery = signal('');
  readonly selectedQuantities = signal<Record<string, number>>({});
  readonly unlistedItems = signal<BookingLineItem[]>([]);
  readonly selectedPackageId = signal<string | null>(null);
  readonly sendMessage = signal(true);
  readonly showUnlisted = signal(false);

  readonly clientForm = this.fb.nonNullable.group({
    mobile: ['', Validators.required],
    name: ['', Validators.required],
  });

  readonly unlistedForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    price: [0, Validators.min(0)],
    tax: [0, Validators.min(0)],
  });

  readonly discount = signal(0);
  readonly paymentMethod = signal<PaymentMethodId>('cash');
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);

  readonly matchedClient = computed(() => {
    const mobile = this.clientForm.controls.mobile.value.trim();
    if (!mobile) {
      return null;
    }
    return this.clients().find(client => client.mobile === mobile) ?? null;
  });

  readonly packageOptions = computed(() => {
    const client = this.matchedClient();
    if (client?.packages.length) {
      return client.packages.map(pkg => ({
        label: pkg.packageName,
        value: pkg.packageId,
      }));
    }
    return this.catalogItems()
      .filter(item => item.type === 'package')
      .map(pkg => ({
        label: pkg.name,
        value: pkg.id,
      }));
  });

  readonly selectedClientPackage = computed<ClientPackage | null>(() => {
    const packageId = this.selectedPackageId();
    if (!packageId) {
      return null;
    }
    const client = this.matchedClient();
    const clientPackage = client?.packages.find(pkg => pkg.packageId === packageId);
    return clientPackage ?? null;
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

    for (const service of this.catalogItems()) {
      const quantity = quantities[service.id] ?? 0;
      if (quantity <= 0) {
        continue;
      }
      items.push({
        id: `line-${service.id}`,
        name: service.name,
        type: service.type,
        quantity,
        price: service.type === 'package' ? 0 : service.price,
        durationMinutes: service.durationMinutes,
        packageSessionLinked: service.type === 'package',
      });
    }

    items.push(...this.unlistedItems());

    return items;
  });

  readonly serviceDuration = computed(() => sumLineItemDuration(this.lineItems()));
  readonly subtotal = computed(() => sumLineItemPrice(this.lineItems()));
  readonly netTotal = computed(() => Math.max(this.subtotal() - this.discount(), 0));
  readonly sessionCount = computed(() =>
    this.lineItems().reduce((total, item) => total + item.quantity, 0)
  );
  readonly paymentsTotal = computed(() => this.subtotal());

  readonly isRtl = computed(() => this.languageService.currentLang() === 'ar');

  constructor() {
    effect(
      () => {
        if (!this.visible()) {
          return;
        }
        this.clientForm.reset({
          mobile: this.initialClientMobile(),
          name: this.initialClientName(),
        });
        this.unlistedForm.reset({ name: '', price: 0, tax: 0 });
        this.unlistedItems.set([]);
        this.selectedQuantities.set(this.initialServiceQuantities());
        this.selectedPackageId.set(this.initialPackageId());
        this.discount.set(0);
        this.paymentMethod.set('cash');
        this.sendMessage.set(true);
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
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const client = this.matchedClient();
        if (client) {
          this.clientForm.controls.name.setValue(client.name, { emitEvent: false });
          if (client.packages.length === 1) {
            this.selectedPackageId.set(client.packages[0].packageId);
          }
        }
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const packageId = this.selectedPackageId();
        const catalogItem = this.catalogItems().find(item => item.id === packageId);
        if (!catalogItem) {
          return;
        }
        const current = this.selectedQuantities();
        if ((current[catalogItem.id] ?? 0) > 0) {
          return;
        }
        this.selectedQuantities.set({
          ...current,
          [catalogItem.id]: 1,
        });
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        this.filteredServices();
        this.isRtl();
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

  linePaymentStatus(item: BookingLineItem): 'paid' | 'remaining' {
    return item.type === 'package' || item.price === 0 ? 'remaining' : 'paid';
  }

  lineTotal(item: BookingLineItem): number {
    return item.price * item.quantity;
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
    const control = this.unlistedForm.controls.name;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'BOOKINGS.DETAILS.ERRORS.UNLISTED_NAME_REQUIRED';
    }
    return null;
  }

  unlistedPriceError(): string | null {
    const control = this.unlistedForm.controls.price;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('min')) {
      return 'BOOKINGS.DETAILS.ERRORS.UNLISTED_PRICE_MIN';
    }
    return null;
  }

  setCategory(category: string): void {
    this.activeCategory.set(category);
  }

  changeQuantity(service: ServiceCatalogItem, delta: number): void {
    const current = this.selectedQuantities();
    const next = Math.max(0, (current[service.id] ?? 0) + delta);
    this.selectedQuantities.set({ ...current, [service.id]: next });
  }

  quantityFor(serviceId: string): number {
    return this.selectedQuantities()[serviceId] ?? 0;
  }

  removeLineItem(itemId: string): void {
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

  selectPayment(method: PaymentMethodId): void {
    this.paymentMethod.set(method);
  }

  addUnlisted(): void {
    this.unlistedForm.markAllAsTouched();
    if (this.unlistedForm.invalid) {
      return;
    }
    const value = this.unlistedForm.getRawValue();
    const totalPrice = value.price + value.tax;
    this.unlistedItems.update(items => [
      ...items,
      {
        id: `line-unlisted-${Date.now()}`,
        name: value.name.trim(),
        type: 'unlisted',
        quantity: 1,
        price: totalPrice,
        durationMinutes: 30,
      },
    ]);
    this.unlistedForm.reset({ name: '', price: 0, tax: 0 });
    this.showUnlisted.set(false);
  }

  submit(): void {
    this.clientForm.markAllAsTouched();
    if (this.clientForm.invalid || !this.selection()) {
      return;
    }
    const client = this.matchedClient();
    this.confirmBooking.emit({
      selection: this.selection()!,
      clientName: this.clientForm.controls.name.value.trim(),
      clientMobile: this.clientForm.controls.mobile.value.trim(),
      clientId: client?.id ?? null,
      lineItems: this.lineItems(),
      paymentMethod: this.paymentMethod(),
      discount: this.discount(),
      sendMessage: this.sendMessage(),
      serviceDuration: this.serviceDuration(),
    });
  }

  close(): void {
    this.closed.emit();
  }

  private initialServiceQuantities(): Record<string, number> {
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
}
