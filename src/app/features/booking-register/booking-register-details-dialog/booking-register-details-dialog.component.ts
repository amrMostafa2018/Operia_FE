import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import {
  BookingRegisterRow,
  BookingRegisterStatus,
  registerStatusKey,
  registerStatusSeverity,
} from '../models/booking-register.model';

/** Adapts register rows for the shared booking details dialog. */
@Component({
  selector: 'app-booking-register-details-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TagModule, TranslatePipe],
  templateUrl: './booking-register-details-dialog.component.html',
  styleUrl: './booking-register-details-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRegisterDetailsDialogComponent {
  private readonly languageService = inject(LanguageService);
  private readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly booking = input<BookingRegisterRow | null>(null);

  readonly closed = output<void>();
  readonly displayStatus = computed(() => {
    const booking = this.booking();
    if (!booking) {
      return null;
    }
    return booking.status;
  });

  readonly remainingAmount = computed(() => {
    const booking = this.booking();
    if (!booking) {
      return 0;
    }
    return Math.max(booking.totalAmount - booking.paidAmount, 0);
  });

  close(): void {
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
}
