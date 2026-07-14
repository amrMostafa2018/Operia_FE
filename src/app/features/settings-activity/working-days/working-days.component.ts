import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { InputSwitchModule } from 'primeng/inputswitch';

import { SettingsFooterComponent } from '../components/settings-footer/settings-footer.component';
import { MOCK_WORKING_DAYS, WorkingDay } from '../models/settings-activity.model';

@Component({
  selector: 'app-working-days',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CalendarModule,
    CheckboxModule,
    InputSwitchModule,
    SettingsFooterComponent,
  ],
  templateUrl: './working-days.component.html',
  styleUrl: './working-days.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkingDaysComponent {
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  workingDays = signal<WorkingDay[]>(structuredClone(MOCK_WORKING_DAYS));
  allowOutsideHours = signal(false);
  saving = signal(false);

  private initialDays: WorkingDay[] = [];
  private initialAllowOutside = false;

  constructor() {
    this.snapshotInitialState();
  }

  toggleDayEnabled(dayId: string, enabled: boolean): void {
    this.workingDays.update(days =>
      days.map(d => (d.id === dayId ? { ...d, enabled } : d))
    );
  }

  toggleDaySelected(dayId: string, selected: boolean): void {
    this.workingDays.update(days =>
      days.map(d => (d.id === dayId ? { ...d, selected } : d))
    );
  }

  updateFromTime(dayId: string, time: Date): void {
    this.workingDays.update(days =>
      days.map(d => (d.id === dayId ? { ...d, fromTime: time } : d))
    );
  }

  updateToTime(dayId: string, time: Date): void {
    this.workingDays.update(days =>
      days.map(d => (d.id === dayId ? { ...d, toTime: time } : d))
    );
  }

  onReset(): void {
    this.workingDays.set(structuredClone(this.initialDays));
    this.allowOutsideHours.set(this.initialAllowOutside);
  }

  onSave(): void {
    this.saving.set(true);
    setTimeout(() => {
      this.snapshotInitialState();
      this.saving.set(false);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_TITLE'),
        detail: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_DETAIL'),
      });
    }, 400);
  }

  private snapshotInitialState(): void {
    this.initialDays = structuredClone(this.workingDays());
    this.initialAllowOutside = this.allowOutsideHours();
  }
}
