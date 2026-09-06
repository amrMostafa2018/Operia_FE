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
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { CurrencyService } from '@core/services/currency.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import {
  BookingLineItem,
  BookingRecord,
  BookingWordStatus,
  MOCK_SERVICES,
  PaymentMethodId,
  PAYMENT_METHODS,
  sumLineItemPrice,
} from './models/booking.model';

export interface BookingDetailsSavePayload {
  bookingId: string;
  lineItems: BookingLineItem[];
  paymentMethod: PaymentMethodId;
  paidAmount: number;
}

@Component({
  selector: 'app-booking-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TagModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    TranslatePipe,
  ],
  templateUrl: './booking-details-dialog.component.html',
  styleUrl: './booking-details-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingDetailsDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly permissions = inject(PermissionService);
  readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly booking = input<BookingRecord | null>(null);

  readonly closed = output<void>();
  readonly saved = output<BookingDetailsSavePayload>();
  readonly closeBooking = output<string>();
  readonly cancelBooking = output<string>();

  readonly paymentMethods = PAYMENT_METHODS;
  readonly catalogServices = MOCK_SERVICES;
  readonly showUnlisted = signal(false);
  readonly showServicePicker = signal(false);

  readonly unlistedForm = this.fb.nonNullable.group({
    name: [''],
    price: [0],
  });

  readonly draftLineItems = signal<BookingLineItem[]>([]);
  readonly draftPaymentMethod = signal<PaymentMethodId>('cash');
  readonly draftPaidAmount = signal(0);

  readonly canManage = computed(() => this.permissions.hasPermission(Policies.BookingsManage));
  readonly canChangeStatus = computed(() =>
    this.permissions.hasPermission(Policies.BookingsChangeStatus)
  );
  readonly canCancel = computed(() => this.permissions.hasPermission(Policies.BookingsCancel));

  readonly isEditable = computed(() => this.booking()?.status === 'booked' && this.canManage());
  readonly showActions = computed(
    () => this.booking()?.status === 'booked' && (this.canManage() || this.canChangeStatus() || this.canCancel())
  );

  readonly totalAmount = computed(() => sumLineItemPrice(this.draftLineItems()));
  readonly remainingAmount = computed(() => Math.max(this.totalAmount() - this.draftPaidAmount(), 0));

  constructor() {
    effect(() => {
      const current = this.booking();
      if (!current) {
        return;
      }
      this.draftLineItems.set(current.lineItems.map(item => ({ ...item })));
      this.draftPaymentMethod.set(current.paymentMethod);
      this.draftPaidAmount.set(current.paidAmount);
      this.showUnlisted.set(false);
      this.showServicePicker.set(false);
      this.unlistedForm.reset({ name: '', price: 0 });
    });
  }

  statusSeverity(status: BookingWordStatus): 'success' | 'info' | 'danger' {
    switch (status) {
      case 'booked':
        return 'info';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'danger';
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

  removeLineItem(itemId: string): void {
    if (!this.isEditable()) {
      return;
    }
    this.draftLineItems.update(items => items.filter(item => item.id !== itemId));
  }

  addService(serviceId: string): void {
    if (!this.isEditable()) {
      return;
    }
    const service = MOCK_SERVICES.find(item => item.id === serviceId);
    if (!service) {
      return;
    }
    this.draftLineItems.update(items => [
      ...items,
      {
        id: `line-${service.id}-${Date.now()}`,
        name: service.name,
        type: service.type,
        quantity: 1,
        price: service.price,
        durationMinutes: service.durationMinutes,
        packageSessionLinked: service.type === 'package',
      },
    ]);
    this.showServicePicker.set(false);
  }

  addUnlisted(): void {
    if (!this.isEditable()) {
      return;
    }
    const value = this.unlistedForm.getRawValue();
    if (!value.name.trim()) {
      return;
    }
    this.draftLineItems.update(items => [
      ...items,
      {
        id: `line-unlisted-${Date.now()}`,
        name: value.name.trim(),
        type: 'unlisted',
        quantity: 1,
        price: value.price,
        durationMinutes: 30,
      },
    ]);
    this.unlistedForm.reset({ name: '', price: 0 });
    this.showUnlisted.set(false);
  }

  selectPayment(method: PaymentMethodId): void {
    if (!this.isEditable()) {
      return;
    }
    this.draftPaymentMethod.set(method);
  }

  save(): void {
    const current = this.booking();
    if (!current || !this.isEditable()) {
      return;
    }
    this.saved.emit({
      bookingId: current.id,
      lineItems: this.draftLineItems(),
      paymentMethod: this.draftPaymentMethod(),
      paidAmount: this.draftPaidAmount(),
    });
  }

  requestClose(): void {
    const current = this.booking();
    if (!current || !this.canChangeStatus()) {
      return;
    }
    this.closeBooking.emit(current.id);
  }

  requestCancel(): void {
    const current = this.booking();
    if (!current || !this.canCancel()) {
      return;
    }
    this.cancelBooking.emit(current.id);
  }

  close(): void {
    this.closed.emit();
  }
}
