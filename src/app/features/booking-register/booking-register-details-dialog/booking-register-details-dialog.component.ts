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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import {
  BookingRegisterRow,
  BookingRegisterStatus,
  registerStatusKey,
  registerStatusSeverity,
} from '../models/booking-register.model';

@Component({
  selector: 'app-booking-register-details-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TagModule, TranslatePipe],
  templateUrl: './booking-register-details-dialog.component.html',
  styleUrl: './booking-register-details-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRegisterDetailsDialogComponent {
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly booking = input<BookingRegisterRow | null>(null);

  readonly closed = output<void>();
  readonly statusConfirmed = output<string>();

  readonly localStatus = signal<BookingRegisterStatus | null>(null);

  readonly canChangeStatus = computed(() =>
    this.permissions.hasPermission(Policies.BookingsChangeStatus)
  );

  constructor() {
    effect(
      () => {
        if (this.booking()) {
          this.localStatus.set(null);
        }
      },
      { allowSignalWrites: true }
    );
  }

  readonly displayStatus = computed(() => {
    const booking = this.booking();
    if (!booking) {
      return null;
    }
    return this.localStatus() ?? booking.status;
  });

  readonly remainingAmount = computed(() => {
    const booking = this.booking();
    if (!booking) {
      return 0;
    }
    return Math.max(booking.totalAmount - booking.paidAmount, 0);
  });

  close(): void {
    this.localStatus.set(null);
    this.closed.emit();
  }

  scheduledDateLabel(booking: BookingRegisterRow): string {
    return booking.scheduledDate.toLocaleDateString(this.languageService.currentLang(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(part => Number(part));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return time;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString(this.languageService.currentLang(), {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatAmount(amount: number): string {
    const formatted = amount.toLocaleString(this.languageService.currentLang());
    const currency = this.currencyService.currencyLabel();
    return currency ? `${formatted} ${currency}` : formatted;
  }

  displayPhone(phone: string): string {
    return phone.replace(/^\+20/, '0');
  }

  customerInitial(name: string): string {
    return name.trim().charAt(0) || '?';
  }

  statusKey(status: BookingRegisterStatus): string {
    return registerStatusKey(status);
  }

  statusSeverity(status: BookingRegisterStatus) {
    return registerStatusSeverity(status);
  }

  confirmStatus(): void {
    const booking = this.booking();
    if (!booking || !this.canChangeStatus()) {
      return;
    }

    this.localStatus.set('confirm');
    this.statusConfirmed.emit(booking.id);
    this.toast.add({
      severity: 'success',
      summary: 'OPERIA',
      detail: this.translate.instant('BOOKING_REGISTER.DETAILS.CONFIRM_SUCCESS'),
      life: 3000,
    });
  }
}
