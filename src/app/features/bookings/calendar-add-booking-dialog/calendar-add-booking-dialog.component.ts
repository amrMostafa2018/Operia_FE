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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { LanguageService } from '@core/services/language.service';
import { getSubmitArrowIcon, getSubmitIconPos } from '@app/shared/utils/rtl.util';
import { getAppDateLocale } from '@app/shared/utils/time-format.util';
import { BookingService } from '../booking.service';
import { MockEmployee } from '../models/mock-directory.model';
import {
  CalendarBookingDraft,
  CalendarSlotSelection,
  hasSlotCollision,
  toIsoDate,
} from '../bookings-calendar/bookings-calendar.utils';

@Component({
  selector: 'app-calendar-add-booking-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
  ],
  templateUrl: './calendar-add-booking-dialog.component.html',
  styleUrl: './calendar-add-booking-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarAddBookingDialogComponent {
  private readonly bookingService = inject(BookingService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly visible = input(false);
  readonly slot = input<CalendarSlotSelection | null>(null);

  readonly closed = output<void>();
  readonly continued = output<CalendarBookingDraft>();

  readonly employees = signal<MockEmployee[]>([]);
  readonly errorMessage = signal('');

  readonly continueIcon = computed(() => getSubmitArrowIcon(this.languageService.currentLang()));
  readonly continueIconPos = computed(() => getSubmitIconPos(this.languageService.currentLang()));

  readonly form = this.fb.nonNullable.group({
    mobile: ['', [Validators.required, Validators.pattern(/^01[0125]\d{8}$/)]],
    employeeId: ['', Validators.required],
  });

  constructor() {
    this.bookingService
      .getEmployees()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(emps => this.employees.set(emps));

    effect(() => {
      if (!this.visible()) return;
      this.reset();
    });
  }

  close(): void {
    this.reset();
    this.closed.emit();
  }

  continue(): void {
    const slot = this.slot();
    if (!slot?.startTime || !slot.endTime) {
      this.errorMessage.set('BOOKINGS.CALENDAR.ADD_DIALOG.SLOT_REQUIRED');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { mobile, employeeId } = this.form.getRawValue();
    const iso = toIsoDate(slot.date);

    this.bookingService
      .listAll({})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(bookings => {
        if (hasSlotCollision(iso, slot.startTime!, slot.endTime!, bookings, employeeId)) {
          this.errorMessage.set('BOOKINGS.CALENDAR.SLOT_TAKEN');
          return;
        }

        this.errorMessage.set('');
        this.continued.emit({ slot, mobile, employeeId });
      });
  }

  slotSummary(): string {
    const slot = this.slot();
    if (!slot) return '';
    const dateStr = slot.date.toLocaleDateString(getAppDateLocale(this.languageService.currentLang()), {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    if (slot.startTime && slot.endTime) {
      return `${dateStr} · ${slot.startTime} – ${slot.endTime}`;
    }
    return dateStr;
  }

  private reset(): void {
    this.errorMessage.set('');
    this.form.reset({ mobile: '', employeeId: '' });
  }
}
