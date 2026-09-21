import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { LanguageService } from '@core/services/language.service';
import { BookingRegisterHistoryEvent } from '../models/booking-register.model';

/** Displays the recorded change history for a booking. */
@Component({
  selector: 'app-change-history-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, TranslatePipe],
  templateUrl: './change-history-dialog.component.html',
  styleUrl: './change-history-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeHistoryDialogComponent {
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  readonly visible = input(false);
  readonly events = input<BookingRegisterHistoryEvent[]>([]);

  readonly closed = output<void>();

  readonly isRtl = computed(() => this.languageService.currentLang() === 'ar');

  readonly dialogStyleClass = computed(
    () => `change-history-dialog ${this.isRtl() ? 'is-rtl' : 'is-ltr'}`
  );

  close(): void {
    this.closed.emit();
  }

  timestampLabel(timestamp: Date): string {
    const lang = this.languageService.currentLang();
    const date = timestamp.toLocaleDateString(lang, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const time = timestamp.toLocaleTimeString(lang, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${date} - ${time}`;
  }

  actorLabel(event: BookingRegisterHistoryEvent): string {
    if (!event.actorRoleKey) {
      return event.actorName;
    }
    const role = this.translate.instant(event.actorRoleKey);
    return `${event.actorName} (${role})`;
  }

  titleKey(event: BookingRegisterHistoryEvent): string {
    switch (event.type) {
      case 'created':
        return 'BOOKING_REGISTER.HISTORY.CREATED';
      case 'employee_changed':
        return 'BOOKING_REGISTER.HISTORY.EMPLOYEE_CHANGED';
      case 'time_changed':
        return 'BOOKING_REGISTER.HISTORY.TIME_CHANGED';
      case 'updated':
        return 'BOOKING_REGISTER.HISTORY.UPDATED';
      case 'cancelled':
        return 'BOOKING_REGISTER.HISTORY.CANCELLED';
    }
  }

  titleClass(event: BookingRegisterHistoryEvent): string {
    switch (event.type) {
      case 'created':
        return 'history-title--created';
      case 'employee_changed':
        return 'history-title--employee';
      case 'time_changed':
        return 'history-title--time';
      case 'updated':
      case 'cancelled':
        return 'history-title--status';
    }
  }
}
