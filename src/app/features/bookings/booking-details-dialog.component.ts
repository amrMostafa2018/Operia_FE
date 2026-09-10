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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import {
  BookingLineItem,
  BookingRecord,
  BookingWordStatus,
  formatTimeRange,
  PaymentMethodId,
  PAYMENT_METHODS,
  ServiceCatalogItem,
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
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly booking = input<BookingRecord | null>(null);
  readonly catalogItems = input<ServiceCatalogItem[]>([]);

  readonly closed = output<void>();
  readonly saved = output<BookingDetailsSavePayload>();
  readonly closeBooking = output<string>();
  readonly cancelBooking = output<string>();

  readonly paymentMethods = PAYMENT_METHODS;
  readonly showUnlisted = signal(false);
  readonly showServicePicker = signal(false);

  readonly unlistedForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    price: [0, Validators.min(0)],
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
    () =>
      this.booking()?.status === 'booked' &&
      (this.canManage() || this.canChangeStatus() || this.canCancel())
  );

  readonly totalAmount = computed(() => sumLineItemPrice(this.draftLineItems()));
  readonly remainingAmount = computed(() =>
    Math.max(this.totalAmount() - this.draftPaidAmount(), 0)
  );

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

  packageRemainingSessions(item: BookingLineItem): number | null {
    if (item.type !== 'package' && !item.packageSessionLinked) {
      return null;
    }
    return 5;
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
    const service = this.catalogItems().find(item => item.id === serviceId);
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
    this.unlistedForm.markAllAsTouched();
    if (this.unlistedForm.invalid) {
      return;
    }
    const value = this.unlistedForm.getRawValue();
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
