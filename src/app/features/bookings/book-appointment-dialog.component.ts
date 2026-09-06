import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyService } from '@core/services/currency.service';
import {
  BookingLineItem,
  ClientRecord,
  MOCK_SERVICES,
  PaymentMethodId,
  PAYMENT_METHODS,
  SERVICE_CATEGORY_TABS,
  ServiceCatalogItem,
  ServiceCategory,
  SlotSelection,
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
export class BookAppointmentDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly selection = input<SlotSelection | null>(null);
  readonly clients = input<ClientRecord[]>([]);
  readonly initialClientName = input('');
  readonly initialClientMobile = input('');

  readonly closed = output<void>();
  readonly confirmBooking = output<BookAppointmentPayload>();

  readonly categoryTabs = SERVICE_CATEGORY_TABS;
  readonly paymentMethods = PAYMENT_METHODS;
  readonly activeCategory = signal<ServiceCategory>('all');
  readonly selectedQuantities = signal<Record<string, number>>({});
  readonly sendMessage = signal(true);
  readonly showUnlisted = signal(false);

  readonly clientForm = this.fb.nonNullable.group({
    mobile: ['', Validators.required],
    name: ['', Validators.required],
  });

  readonly unlistedForm = this.fb.nonNullable.group({
    name: [''],
    price: [0],
  });

  readonly discount = signal(0);
  readonly paymentMethod = signal<PaymentMethodId>('cash');

  readonly matchedClient = computed(() => {
    const mobile = this.clientForm.controls.mobile.value.trim();
    if (!mobile) {
      return null;
    }
    return this.clients().find(client => client.mobile === mobile) ?? null;
  });

  readonly filteredServices = computed(() => {
    const category = this.activeCategory();
    if (category === 'all') {
      return MOCK_SERVICES;
    }
    return MOCK_SERVICES.filter(service => service.category === category);
  });

  readonly lineItems = computed<BookingLineItem[]>(() => {
    const quantities = this.selectedQuantities();
    const items: BookingLineItem[] = [];

    for (const service of MOCK_SERVICES) {
      const quantity = quantities[service.id] ?? 0;
      if (quantity <= 0) {
        continue;
      }
      items.push({
        id: `line-${service.id}`,
        name: service.name,
        type: service.type,
        quantity,
        price: service.price,
        durationMinutes: service.durationMinutes,
        packageSessionLinked: service.type === 'package',
      });
    }

    const unlisted = this.unlistedForm.getRawValue();
    if (this.showUnlisted() && unlisted.name.trim()) {
      items.push({
        id: 'line-unlisted',
        name: unlisted.name.trim(),
        type: 'unlisted',
        quantity: 1,
        price: unlisted.price,
        durationMinutes: 30,
      });
    }

    return items;
  });

  readonly serviceDuration = computed(() => sumLineItemDuration(this.lineItems()));
  readonly subtotal = computed(() => sumLineItemPrice(this.lineItems()));
  readonly netTotal = computed(() => Math.max(this.subtotal() - this.discount(), 0));
  readonly sessionCount = computed(() =>
    this.lineItems().reduce((total, item) => total + item.quantity, 0)
  );

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      this.clientForm.reset({
        mobile: this.initialClientMobile(),
        name: this.initialClientName(),
      });
      this.unlistedForm.reset({ name: '', price: 0 });
      this.selectedQuantities.set({});
      this.discount.set(0);
      this.paymentMethod.set('cash');
      this.sendMessage.set(true);
      this.showUnlisted.set(false);
      this.activeCategory.set('all');
    });

    effect(() => {
      const client = this.matchedClient();
      if (client) {
        this.clientForm.controls.name.setValue(client.name, { emitEvent: false });
      }
    });
  }

  setCategory(category: ServiceCategory): void {
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

  selectPayment(method: PaymentMethodId): void {
    this.paymentMethod.set(method);
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
}
