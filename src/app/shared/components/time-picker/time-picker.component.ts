import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  HostListener,
  inject,
  input,
  signal,
  ViewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Calendar, CalendarModule } from 'primeng/calendar';

import { LanguageService } from '@core/services/language.service';
import { formatAppTime } from '@app/shared/utils/time-format.util';

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [FormsModule, CalendarModule],
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-time-picker-host',
    '[class.app-time-picker-host--ar]': 'isArabic()',
    '[class.app-time-picker-host--pm]': 'isPm()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
})
export class TimePickerComponent
  implements ControlValueAccessor, AfterViewInit
{
  private readonly languageService = inject(LanguageService);

  readonly inputId = input('');
  readonly placeholder = input('');
  readonly styleClass = input('time-picker');

  @ViewChild('calendar') private calendar?: Calendar;

  readonly disabled = signal(false);
  readonly value = signal<Date | null>(null);
  readonly isArabic = computed(() => this.languageService.currentLang() === 'ar');
  readonly isPm = signal(false);
  readonly panelStyleClass = computed(() => {
    const classes = ['app-time-picker-panel'];
    if (this.isArabic() && this.isPm()) {
      classes.push('app-time-picker-panel--pm');
    }
    return classes.join(' ');
  });

  private isUpdatingPopup = false;
  private onChange: (value: Date | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      this.languageService.currentLang();
      this.value();
      this.scheduleLocalizedDisplay();
    });
  }

  ngAfterViewInit(): void {
    this.scheduleLocalizedDisplay();
    this.syncPmState();
  }

  writeValue(value: Date | null): void {
    this.value.set(value);
    this.scheduleLocalizedDisplay();
    this.syncPmState();
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onModelChange(value: Date | null): void {
    this.value.set(value);
    this.onChange(value);
    this.scheduleLocalizedDisplay();
    this.syncPmState();
    this.syncPopupTimeInputs();
  }

  onBlur(): void {
    this.onTouched();
  }

  onTimeSelected(): void {
    this.syncValueFromCalendar();
    this.syncPopupTimeInputs();
    this.syncPmState();
    this.scheduleLocalizedDisplay();
  }

  onPickerClosed(): void {
    this.commitPopupTimeInputs();
    this.syncValueFromCalendar();
    this.scheduleLocalizedDisplay();
    this.syncPmState();
  }

  onPickerOpened(): void {
    this.scheduleLocalizedDisplay();
    queueMicrotask(() => {
      this.syncPmState();
      this.enhancePopupTimeInputs();
    });
  }

  @HostListener('click')
  onHostClick(): void {
    if (!this.isArabic()) {
      return;
    }
    queueMicrotask(() => this.syncPmState());
  }

  private enhancePopupTimeInputs(): void {
    const calendar = this.calendar;
    const overlay = calendar?.overlay as HTMLElement | undefined;

    if (!calendar || !overlay || calendar.disabled) {
      return;
    }

    const hourPicker = overlay.querySelector('.p-hour-picker');
    const minutePicker = overlay.querySelector('.p-minute-picker');

    if (hourPicker) {
      this.ensurePopupInput(hourPicker, 'hour');
    }

    if (minutePicker) {
      this.ensurePopupInput(minutePicker, 'minute');
    }

    this.syncPopupTimeInputs();
  }

  private ensurePopupInput(
    picker: Element,
    kind: 'hour' | 'minute'
  ): HTMLInputElement {
    const existing = picker.querySelector(
      'input.app-time-picker-popup-input'
    ) as HTMLInputElement | null;

    if (existing) {
      return existing;
    }

    const span = picker.querySelector('span');
    if (span) {
      span.classList.add('app-time-picker-popup-native');
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 2;
    input.className = 'app-time-picker-popup-input';
    input.setAttribute(
      'aria-label',
      kind === 'hour' ? 'Hour' : 'Minute'
    );

    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 2);
    });
    input.addEventListener('blur', () => {
      this.commitPopupTimeInput(kind);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        input.blur();
        event.preventDefault();
      }
    });

    if (span?.parentElement) {
      span.parentElement.insertBefore(input, span.nextSibling);
    } else {
      picker.appendChild(input);
    }

    return input;
  }

  private syncPopupTimeInputs(): void {
    const calendar = this.calendar;
    const overlay = calendar?.overlay as HTMLElement | undefined;

    if (!calendar || !overlay) {
      return;
    }

    const hourInput = overlay.querySelector(
      '.p-hour-picker input.app-time-picker-popup-input'
    ) as HTMLInputElement | null;
    const minuteInput = overlay.querySelector(
      '.p-minute-picker input.app-time-picker-popup-input'
    ) as HTMLInputElement | null;

    if (hourInput && document.activeElement !== hourInput) {
      hourInput.value = String(calendar.currentHour ?? 0).padStart(2, '0');
    }

    if (minuteInput && document.activeElement !== minuteInput) {
      minuteInput.value = String(calendar.currentMinute ?? 0).padStart(2, '0');
    }
  }

  private commitPopupTimeInputs(): void {
    this.commitPopupTimeInput('hour');
    this.commitPopupTimeInput('minute');
  }

  private commitPopupTimeInput(kind: 'hour' | 'minute'): void {
    if (this.isUpdatingPopup) {
      return;
    }

    const calendar = this.calendar;
    const overlay = calendar?.overlay as HTMLElement | undefined;

    if (!calendar || !overlay) {
      return;
    }

    const selector =
      kind === 'hour'
        ? '.p-hour-picker input.app-time-picker-popup-input'
        : '.p-minute-picker input.app-time-picker-popup-input';
    const input = overlay.querySelector(selector) as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const raw = input.value.trim();
    if (!raw) {
      this.syncPopupTimeInputs();
      return;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      this.syncPopupTimeInputs();
      return;
    }

    const prevHour = calendar.currentHour;
    const prevMinute = calendar.currentMinute;
    const prevPm = !!calendar.pm;

    if (kind === 'hour') {
      if (calendar.hourFormat === '12' && (parsed < 1 || parsed > 12)) {
        this.syncPopupTimeInputs();
        return;
      }

      if (calendar.hourFormat === '24' && (parsed < 0 || parsed > 23)) {
        this.syncPopupTimeInputs();
        return;
      }

      calendar.currentHour = parsed;
    } else if (parsed < 0 || parsed > 59) {
      this.syncPopupTimeInputs();
      return;
    } else {
      calendar.currentMinute = parsed;
    }

    [calendar.currentHour, calendar.currentMinute, calendar.currentSecond] =
      calendar.constrainTime(
        calendar.currentHour ?? 0,
        calendar.currentMinute ?? 0,
        calendar.currentSecond ?? 0,
        !!calendar.pm
      );

    const unchanged =
      calendar.currentHour === prevHour &&
      calendar.currentMinute === prevMinute &&
      !!calendar.pm === prevPm;

    if (unchanged) {
      this.syncPopupTimeInputs();
      return;
    }

    this.isUpdatingPopup = true;
    try {
      calendar.updateTime();
      this.syncValueFromCalendar();
      this.syncPopupTimeInputs();
      this.syncPmState();
      this.scheduleLocalizedDisplay();
    } finally {
      this.isUpdatingPopup = false;
    }
  }

  private syncValueFromCalendar(): void {
    const calendar = this.calendar;
    if (!calendar?.value || !(calendar.value instanceof Date)) {
      return;
    }

    const next = new Date(calendar.value.getTime());
    this.value.set(next);
    this.onChange(next);
  }

  private syncPmState(): void {
    const calendar = this.calendar;
    if (!calendar) {
      return;
    }

    const nextPm = !!calendar.pm;
    if (this.isPm() !== nextPm) {
      this.isPm.set(nextPm);
    }

    const overlay = calendar.overlay;
    if (overlay) {
      overlay.classList.toggle('app-time-picker-panel--pm', nextPm);
    }
  }

  private scheduleLocalizedDisplay(): void {
    queueMicrotask(() => this.applyLocalizedDisplay());
    requestAnimationFrame(() => this.applyLocalizedDisplay());
  }

  private applyLocalizedDisplay(): void {
    const calendar = this.calendar;
    const value = this.value();
    if (!calendar) {
      return;
    }

    const input = calendar.inputfieldViewChild?.nativeElement as
      | HTMLInputElement
      | undefined;

    if (this.disabled() && this.placeholder()) {
      calendar.inputFieldValue = this.placeholder();
      if (input) {
        input.value = this.placeholder();
      }
      return;
    }

    if (!value) {
      return;
    }

    if (!this.isArabic()) {
      calendar.updateInputfield();
      return;
    }

    const formatted = formatAppTime(value, 'ar');
    calendar.inputFieldValue = formatted;

    if (input && input.value !== formatted) {
      input.value = formatted;
    }
  }
}
