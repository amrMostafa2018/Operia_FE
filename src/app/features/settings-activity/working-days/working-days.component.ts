import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { InputSwitchModule } from 'primeng/inputswitch';

import { TimePickerComponent } from '@app/shared/components/time-picker/time-picker.component';
import { SettingsFooterComponent } from '../components/settings-footer/settings-footer.component';
import { MOCK_WORKING_DAYS, WorkingDay } from '../models/settings-activity.model';
import { SettingsActivityService, WorkingDayDto } from '../services/settings-activity.service';

const DAY_KEY_MAP: Record<string, string> = {
  fri: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.FRI',
  sat: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.SAT',
  sun: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.SUN',
  mon: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.MON',
  tue: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.TUE',
  wed: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.WED',
  thu: 'SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.THU',
};

function parseTimeString(timeStr: string | null | undefined): Date {
  const d = new Date();
  if (!timeStr) {
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 9;
  const m = parseInt(parts[1], 10) || 0;
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

@Component({
  selector: 'app-working-days',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CheckboxModule,
    InputSwitchModule,
    TimePickerComponent,
    SettingsFooterComponent,
  ],
  templateUrl: './working-days.component.html',
  styleUrl: './working-days.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkingDaysComponent implements OnInit {
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly settingsService = inject(SettingsActivityService);
  private readonly destroyRef = inject(DestroyRef);

  workingDays = signal<WorkingDay[]>(structuredClone(MOCK_WORKING_DAYS));
  allowOutsideHours = signal(false);
  saving = signal(false);

  private initialDays: WorkingDay[] = [];
  private initialAllowOutside = false;

  ngOnInit(): void {
    this.loadWorkingDays();
  }

  private loadWorkingDays(): void {
    this.settingsService
      .getWorkingDays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          if (data.days && data.days.length > 0) {
            const mapped = data.days.map((d: WorkingDayDto) => ({
              id: d.day.toLowerCase(),
              dayKey:
                DAY_KEY_MAP[d.day.toLowerCase()] ||
                `SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.${d.day.toUpperCase()}`,
              enabled: d.enabled,
              selected: d.enabled,
              fromTime: parseTimeString(d.fromTime),
              toTime: parseTimeString(d.toTime),
            }));
            this.workingDays.set(mapped);
          }
          this.allowOutsideHours.set(data.allowBookingOutsideWorkingHours);
          this.snapshotInitialState();
        },
        error: () => {
          this.snapshotInitialState();
        },
      });
  }

  toggleDayEnabled(dayId: string, enabled: boolean): void {
    this.workingDays.update(days => days.map(d => (d.id === dayId ? { ...d, enabled } : d)));
  }

  updateFromTime(dayId: string, time: Date): void {
    this.workingDays.update(days => days.map(d => (d.id === dayId ? { ...d, fromTime: time } : d)));
  }

  updateToTime(dayId: string, time: Date): void {
    this.workingDays.update(days => days.map(d => (d.id === dayId ? { ...d, toTime: time } : d)));
  }

  onReset(): void {
    this.workingDays.set(structuredClone(this.initialDays));
    this.allowOutsideHours.set(this.initialAllowOutside);
  }

  onSave(): void {
    this.saving.set(true);
    const dtoList: WorkingDayDto[] = this.workingDays().map(d => ({
      day: d.id,
      enabled: d.enabled,
      fromTime: formatTimeString(d.fromTime),
      toTime: formatTimeString(d.toTime),
    }));

    this.settingsService
      .updateWorkingDays({
        days: dtoList,
        allowBookingOutsideWorkingHours: this.allowOutsideHours(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.saving.set(false);
          if (res.days && res.days.length > 0) {
            const mapped = res.days.map((d: WorkingDayDto) => ({
              id: d.day.toLowerCase(),
              dayKey:
                DAY_KEY_MAP[d.day.toLowerCase()] ||
                `SETTINGS_ACTIVITY.WORKING_DAYS.DAYS.${d.day.toUpperCase()}`,
              enabled: d.enabled,
              selected: d.enabled,
              fromTime: parseTimeString(d.fromTime),
              toTime: parseTimeString(d.toTime),
            }));
            this.workingDays.set(mapped);
          }
          this.allowOutsideHours.set(res.allowBookingOutsideWorkingHours);
          this.snapshotInitialState();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_TITLE'),
            detail: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_DETAIL'),
          });
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVE'),
            detail: 'Failed to save working days.',
          });
        },
      });
  }

  private snapshotInitialState(): void {
    this.initialDays = structuredClone(this.workingDays());
    this.initialAllowOutside = this.allowOutsideHours();
  }
}
