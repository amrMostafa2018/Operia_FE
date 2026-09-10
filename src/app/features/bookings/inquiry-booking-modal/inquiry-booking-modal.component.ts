import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { MessageService } from 'primeng/api';
import { BookingService } from '../booking.service';
import { AvailabilitySlot, Booking } from '../models/booking.model';
import {
  MockBranch,
  MockCustomer,
  MockEmployee,
  MockPackage,
} from '../models/mock-directory.model';
import { SlotPickerComponent } from '../slot-picker/slot-picker.component';
import {
  CalendarBookingDraft,
  CalendarSlotSelection,
  toIsoDate,
} from '../bookings-calendar/bookings-calendar.utils';

type Step = 'search' | 'packages' | 'schedule' | 'confirm';

@Component({
  selector: 'app-inquiry-booking-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    CalendarModule,
    SlotPickerComponent,
  ],
  templateUrl: './inquiry-booking-modal.component.html',
  styleUrl: './inquiry-booking-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InquiryBookingModalComponent {
  private readonly bookingService = inject(BookingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly visible = input(false);
  readonly schedulePrefill = input<CalendarSlotSelection | null>(null);
  readonly inquiryDraft = input<CalendarBookingDraft | null>(null);
  readonly closed = output<void>();
  readonly bookingCreated = output<Booking>();

  readonly step = signal<Step>('search');
  readonly customer = signal<MockCustomer | null>(null);
  readonly packages = signal<MockPackage[]>([]);
  readonly selectedPackage = signal<MockPackage | null>(null);
  readonly branches = signal<MockBranch[]>([]);
  readonly employees = signal<MockEmployee[]>([]);
  readonly slots = signal<AvailabilitySlot[]>([]);
  readonly slotsLoading = signal(false);
  readonly createdBooking = signal<Booking | null>(null);
  readonly errorMessage = signal('');

  readonly today = new Date();

  readonly searchForm = this.fb.nonNullable.group({
    countryCode: ['+20'],
    mobile: ['', [Validators.required, Validators.pattern(/^01[0125]\d{8}$/)]],
  });

  readonly scheduleForm = this.fb.nonNullable.group({
    branchId: ['', Validators.required],
    employeeId: ['', Validators.required],
    date: [new Date(), Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
  });

  private readonly pendingDraft = signal<CalendarBookingDraft | null>(null);

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const draft = this.inquiryDraft();
      if (!draft) return;
      untracked(() => this.applyInquiryDraft(draft));
    });
  }

  open(): void {
    this.reset();
  }

  close(): void {
    this.reset();
    this.closed.emit();
  }

  reset(): void {
    this.step.set('search');
    this.pendingDraft.set(null);
    this.customer.set(null);
    this.packages.set([]);
    this.selectedPackage.set(null);
    this.branches.set([]);
    this.employees.set([]);
    this.slots.set([]);
    this.createdBooking.set(null);
    this.errorMessage.set('');
    this.searchForm.reset({ countryCode: '+20', mobile: '' });
    this.scheduleForm.reset({
      branchId: '',
      employeeId: '',
      date: new Date(),
      startTime: '',
      endTime: '',
    });
  }

  searchCustomer(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }
    this.errorMessage.set('');
    const mobile = this.searchForm.controls.mobile.value;
    this.bookingService
      .searchCustomerByMobile(mobile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (!result) {
          this.errorMessage.set('BOOKINGS.INQUIRY.NOT_FOUND');
          return;
        }
        this.customer.set(result.customer);
        this.packages.set(result.packages);
        this.step.set('packages');
      });
  }

  selectPackage(pkg: MockPackage): void {
    if (pkg.status !== 'active' || pkg.remainingSessions <= 0) return;
    this.selectedPackage.set(pkg);
    const draft = this.pendingDraft();
    this.bookingService
      .getBranches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(branches => {
        this.branches.set(branches);
        if (draft) {
          this.applyDraftSchedule(draft, branches);
          return;
        }
        this.step.set('schedule');
        this.scheduleForm.patchValue({ branchId: branches[0]?.id ?? '' });
        if (branches[0]) {
          this.onBranchChange(branches[0].id, true);
        }
      });
  }

  private applyInquiryDraft(draft: CalendarBookingDraft): void {
    this.reset();
    this.pendingDraft.set(draft);
    this.searchForm.patchValue({ mobile: draft.mobile });
    this.errorMessage.set('');
    this.bookingService
      .searchCustomerByMobile(draft.mobile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (!result) {
          this.errorMessage.set('BOOKINGS.INQUIRY.NOT_FOUND');
          this.step.set('search');
          return;
        }
        this.customer.set(result.customer);
        this.packages.set(result.packages);
        this.step.set('packages');
      });
  }

  private applyDraftSchedule(draft: CalendarBookingDraft, branches: MockBranch[]): void {
    this.bookingService
      .getEmployees()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(employees => {
        const employee = employees.find(e => e.id === draft.employeeId);
        const branchId =
          employee?.branchIds.find(id => branches.some(b => b.id === id)) ?? branches[0]?.id ?? '';
        this.scheduleForm.patchValue({
          branchId,
          employeeId: draft.employeeId,
          date: new Date(draft.slot.date),
          startTime: draft.slot.startTime ?? '',
          endTime: draft.slot.endTime ?? '',
        });
        this.step.set('confirm');
      });
  }

  private activeSchedulePrefill(): CalendarSlotSelection | null {
    return this.inquiryDraft()?.slot ?? this.schedulePrefill();
  }

  onBranchChange(branchId: string, fromPackageSelect = false): void {
    if (!fromPackageSelect) {
      this.scheduleForm.patchValue({ employeeId: '', startTime: '', endTime: '' });
    }
    this.slots.set([]);
    if (!branchId) {
      this.employees.set([]);
      return;
    }
    this.bookingService
      .getBookableEmployees(branchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(employees => {
        this.employees.set(employees);
        if (employees[0]) {
          this.scheduleForm.patchValue({ employeeId: employees[0].id });
          this.loadSlots(fromPackageSelect);
        }
      });
  }

  onEmployeeChange(): void {
    this.scheduleForm.patchValue({ startTime: '', endTime: '' });
    this.loadSlots();
  }

  onDateChange(): void {
    this.scheduleForm.patchValue({ startTime: '', endTime: '' });
    this.loadSlots();
  }

  loadSlots(applyPrefill = false): void {
    const { branchId, employeeId, date } = this.scheduleForm.getRawValue();
    const pkg = this.selectedPackage();
    if (!branchId || !employeeId || !date || !pkg) return;

    if (applyPrefill) {
      this.applySchedulePrefillDate();
    }

    this.slotsLoading.set(true);
    const dateStr = toIsoDate(date);
    const prefill = this.activeSchedulePrefill();
    const slotDuration =
      applyPrefill && prefill?.durationMinutes ? prefill.durationMinutes : pkg.sessionDurationMinutes;
    this.bookingService
      .getAvailability(branchId, employeeId, dateStr, slotDuration)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(slots => {
        this.slots.set(slots);
        this.slotsLoading.set(false);
        if (applyPrefill) {
          this.applySchedulePrefillTime(slots);
        }
      });
  }

  private applySchedulePrefillDate(): void {
    const prefill = this.activeSchedulePrefill();
    if (!prefill) return;
    this.scheduleForm.patchValue({ date: new Date(prefill.date) });
  }

  private applySchedulePrefillTime(slots: AvailabilitySlot[]): void {
    const prefill = this.activeSchedulePrefill();
    if (!prefill?.startTime || !prefill.endTime) return;
    const exactMatch = slots.find(
      s => s.isAvailable && s.start === prefill.startTime && s.end === prefill.endTime
    );
    if (exactMatch) {
      this.scheduleForm.patchValue({ startTime: exactMatch.start, endTime: exactMatch.end });
      return;
    }
    const startMatch = slots.find(s => s.isAvailable && s.start === prefill.startTime);
    if (startMatch) {
      this.scheduleForm.patchValue({ startTime: startMatch.start, endTime: startMatch.end });
      return;
    }
    this.scheduleForm.patchValue({
      startTime: prefill.startTime,
      endTime: prefill.endTime,
    });
  }

  onSlotSelected(event: { start: string; end: string }): void {
    this.scheduleForm.patchValue({ startTime: event.start, endTime: event.end });
  }

  confirmSchedule(): void {
    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      return;
    }
    this.step.set('confirm');
  }

  submitBooking(): void {
    const customer = this.customer();
    const pkg = this.selectedPackage();
    const { branchId, employeeId, date, startTime, endTime } = this.scheduleForm.getRawValue();
    if (!customer || !pkg) return;

    this.errorMessage.set('');
    try {
      this.bookingService
        .createBooking({
          customerId: customer.id,
          packageId: pkg.id,
          branchId,
          employeeId,
          date: toIsoDate(date),
          startTime,
          endTime,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: booking => {
            this.createdBooking.set(booking);
            this.toast.add({
              severity: 'success',
              summary: 'OPERIA',
              detail: 'Booking created.',
            });
            this.bookingCreated.emit(booking);
          },
          error: () => this.errorMessage.set('BOOKINGS.ERRORS.SLOT_TAKEN'),
        });
    } catch {
      this.errorMessage.set('BOOKINGS.ERRORS.SLOT_TAKEN');
    }
  }

  goBack(): void {
    const current = this.step();
    if (current === 'packages') this.step.set('search');
    else if (current === 'schedule') this.step.set('packages');
    else if (current === 'confirm') this.step.set('schedule');
  }

  packageStatusKey(status: string): string {
    return `BOOKINGS.PACKAGE_STATUS.${status.toUpperCase()}`;
  }

  selectedBranchName(): string {
    const branchId = this.scheduleForm.controls.branchId.value;
    return this.branches().find(b => b.id === branchId)?.name ?? '';
  }

  selectedEmployeeName(): string {
    const employeeId = this.scheduleForm.controls.employeeId.value;
    return this.employees().find(e => e.id === employeeId)?.fullName ?? '';
  }

  isPackageSelectable(pkg: MockPackage): boolean {
    return pkg.status === 'active' && pkg.remainingSessions > 0;
  }
}
