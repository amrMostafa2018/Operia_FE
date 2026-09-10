import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { PackageService } from '@app/features/packages/package.service';
import {
  BookingLineItem,
  BookingRecord,
  BookingWordStatus,
  CatalogCategoryTab,
  EMPTY_UNLISTED_FORM,
  formatTimeRange,
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

export interface BookingDetailsSavePayload {
  bookingId: string;
  lineItems: BookingLineItem[];
  paymentMethod: PaymentMethodId;
  paidAmount: number;
}

export interface BookingClosePayload {
  bookingId: string;
  lineItems: BookingLineItem[];
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
    DropdownModule,
    TranslatePipe,
    UnlistedCategoryFieldComponent,
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
  private readonly packagesApi = inject(PackageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly booking = input<BookingRecord | null>(null);
  readonly catalogItems = input<ServiceCatalogItem[]>([]);
  readonly catalogCategories = input<CatalogCategoryTab[]>([]);

  readonly closed = output<void>();
  readonly saved = output<BookingDetailsSavePayload>();
  readonly closeBooking = output<BookingClosePayload>();
  readonly cancelBooking = output<string>();
  readonly packageCreated = output<void>();

  readonly paymentMethods = PAYMENT_METHODS;
  readonly showUnlisted = signal(false);
  readonly showServicePicker = signal(false);
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
    setupServerErrorClearing(this.unlistedForm, this.destroyRef, [
      'name',
      'serviceCategoryId',
      'offerType',
      'durationMinutes',
      'price',
    ]);
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
      this.unlistedForm.reset({ ...EMPTY_UNLISTED_FORM });
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
    this.closeBooking.emit({
      bookingId: current.id,
      lineItems: this.draftLineItems(),
    });
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
}
