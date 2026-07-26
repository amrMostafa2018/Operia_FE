import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '@core/services/language.service';
import { getPrevArrowIcon, getLeadingIconPos } from '@app/shared/utils/rtl.util';
import {
  bookingStatusKey,
  bookingStatusSeverity,
  TagSeverity,
} from '@app/shared/utils/status-tag.util';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';

import {
  BookingRow,
  BookingStatus,
  MOCK_BOOKINGS,
  MOCK_STATS,
  StatCard,
  STATUS_OPTIONS,
} from './models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    DropdownModule,
    CalendarModule,
    FormsModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly languageService = inject(LanguageService);

  readonly stats: StatCard[] = MOCK_STATS;
  readonly allBookings: BookingRow[] = MOCK_BOOKINGS;

  dateRange = signal<Date[] | null>(null);
  selectedEmployee = signal<string | null>(null);
  selectedStatus = signal<BookingStatus | null>(null);
  rows = signal(10);
  first = signal(0);

  readonly statusOptions = STATUS_OPTIONS.map(o => ({
    ...o,
    label: o.label,
  }));

  readonly rowOptions = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
    { label: '500', value: 500 },
    { label: '1000', value: 1000 },
    { label: '2000', value: 2000 },
  ];

  readonly filteredBookings = computed(() => {
    let result = this.allBookings;
    const employee = this.selectedEmployee();
    const status = this.selectedStatus();

    if (employee) {
      result = result.filter(b => b.employee.includes(employee));
    }
    if (status) {
      result = result.filter(b => b.status === status);
    }
    return result;
  });

  readonly prevIcon = computed(() => getPrevArrowIcon(this.languageService.currentLang()));

  readonly prevIconPos = computed(() => getLeadingIconPos(this.languageService.currentLang()));

  readonly today = computed(() =>
    new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  );

  statusSeverity(status: BookingStatus): TagSeverity {
    return bookingStatusSeverity(status);
  }

  statusKey(status: BookingStatus): string {
    return bookingStatusKey(status);
  }

  onRowsChange(val: number): void {
    this.rows.set(val);
    this.first.set(0);
  }

  exportReport(): void {
    // placeholder — real export wired when API is ready
  }
}
