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
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TabViewModule } from 'primeng/tabview';
import { isFieldInvalid } from '@app/shared/utils/form-field.util';
import { CloseBookingItemInput } from './appointments-api.service';
import {
  BookingLineItem,
  BookingRecord,
  displayedPackageRemainingUnits,
  displayedPackageUsedUnits,
  packageUsesPulses,
} from './models/booking.model';

type CloseLineStatus = 'complete' | 'cancel';

interface CloseLineFormValue {
  status: CloseLineStatus;
  pulsesUsed: number | null;
  notes: string;
}

/** Confirms per-line usage before closing a booked appointment. */
@Component({
  selector: 'app-confirm-package-usage-dialog',
  standalone: true,
  imports: [
    DialogModule,
    DropdownModule,
    ReactiveFormsModule,
    InputNumberModule,
    InputTextareaModule,
    TabViewModule,
    TranslatePipe,
  ],
  templateUrl: './confirm-package-usage-dialog.component.html',
  styleUrl: './confirm-package-usage-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmPackageUsageDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = input(false);
  readonly booking = input<BookingRecord | null>(null);
  readonly saving = input(false);

  readonly confirmed = output<CloseBookingItemInput[]>();
  readonly closed = output<void>();

  readonly statusOptions: { label: string; value: CloseLineStatus }[] = [
    { label: 'BOOKINGS.CLOSE.STATUS_COMPLETE', value: 'complete' },
    { label: 'BOOKINGS.CLOSE.STATUS_CANCEL', value: 'cancel' },
  ];

  readonly form = this.fb.nonNullable.group({
    items: this.fb.array<FormGroup>([]),
  });

  readonly lineItems = computed(() => this.booking()?.lineItems ?? []);
  /** True only after the form array matches the open booking lines. */
  readonly formReady = signal(false);

  private readonly lineSync = new Subject<void>();
  private renderedLinesKey = '';
  /** Line ids already warned for a pulses-over-remaining value, until the value drops back. */
  private readonly pulseOverflowWarned = new Set<string>();

  constructor() {
    effect(() => {
      const open = this.visible();
      const lines = this.lineItems();
      const key = open ? lines.map(line => line.id).join('|') : '';

      untracked(() => {
        if (!open) {
          this.renderedLinesKey = '';
          this.formReady.set(false);
          return;
        }

        if (this.renderedLinesKey === key && this.itemsArray().length === lines.length) {
          this.formReady.set(true);
          return;
        }

        this.renderedLinesKey = key;
        this.rebuildForm(lines);
        this.formReady.set(this.itemsArray().length === lines.length);
      });
    });
  }

  itemsArray(): FormArray<FormGroup> {
    return this.form.controls.items;
  }

  /** Form array is in sync with the lines the template is about to render. */
  formMatchesLines(): boolean {
    return this.formReady() && this.itemsArray().length === this.lineItems().length;
  }

  itemGroup(index: number): FormGroup | null {
    return this.itemsArray().at(index) ?? null;
  }

  isPulseLine(line: BookingLineItem): boolean {
    return line.type === 'package' && packageUsesPulses({ pulseCount: line.packagePulseCount });
  }

  isSessionPackageLine(line: BookingLineItem): boolean {
    return line.type === 'package' && !this.isPulseLine(line);
  }

  isStandaloneLine(line: BookingLineItem): boolean {
    return line.type === 'session' || line.type === 'unlisted';
  }

  lineTotal(line: BookingLineItem): number | null {
    return line.packageTotal ?? null;
  }

  lineUsed(line: BookingLineItem): number | null {
    if (line.packageUsed == null) {
      return null;
    }

    const total = line.packageTotal ?? 0;
    const remaining = line.packageRemainingSessions ?? 0;
    const reserved = Math.max(0, total - line.packageUsed - remaining);
    return displayedPackageUsedUnits({
      usedSessions: line.packageUsed,
      reservedSessions: reserved,
      pulseCount: line.packagePulseCount,
      offerType: line.type === 'package' ? 'package' : 'session',
    });
  }

  lineRemaining(line: BookingLineItem): number | null {
    if (line.packageTotal == null || line.packageUsed == null) {
      return line.packageRemainingSessions ?? null;
    }

    const total = line.packageTotal ?? 0;
    const remaining = line.packageRemainingSessions ?? 0;
    const reserved = Math.max(0, total - line.packageUsed - remaining);
    return displayedPackageRemainingUnits({
      totalSessions: line.packageTotal,
      usedSessions: line.packageUsed,
      reservedSessions: reserved,
      pulseCount: line.packagePulseCount,
      offerType: line.type === 'package' ? 'package' : 'session',
    });
  }

  showPulseInput(line: BookingLineItem, index: number): boolean {
    const group = this.itemGroup(index);
    return this.isPulseLine(line) && group?.controls['status'].value === 'complete';
  }

  isInvalid(index: number, field: string): boolean {
    return isFieldInvalid(this.itemGroup(index), field);
  }

  tabHasError(index: number): boolean {
    const group = this.itemGroup(index);
    return !!group && group.invalid && (group.dirty || group.touched);
  }

  notesLength(index: number): number {
    return String(this.itemGroup(index)?.controls['notes'].value ?? '').length;
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    this.form.markAllAsTouched();
    const pulsesExceed = this.hasPulsesOverRemaining();
    if (pulsesExceed) {
      this.toastPulsesExceedRemaining();
    }
    if (this.form.invalid) {
      if (!pulsesExceed || this.hasNonPulseMaxErrors()) {
        this.toast.add({
          severity: 'warn',
          summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
          detail: this.translate.instant('BOOKINGS.CLOSE.VALIDATION_INCOMPLETE'),
        });
      }
      return;
    }

    const booking = this.booking();
    if (!booking) {
      return;
    }

    const payload: CloseBookingItemInput[] = [];
    for (const [index, line] of booking.lineItems.entries()) {
      const group = this.itemGroup(index);
      if (!group) {
        return;
      }

      const value = group.getRawValue() as CloseLineFormValue;
      payload.push({
        bookingItemId: line.id,
        customerPackageId: line.customerPackageId ?? null,
        status: value.status,
        pulsesUsed: value.status === 'complete' && this.isPulseLine(line) ? value.pulsesUsed : null,
        notes: value.notes.trim() ? value.notes.trim() : null,
      });
    }

    this.confirmed.emit(payload);
  }

  private rebuildForm(lines: readonly BookingLineItem[]): void {
    this.lineSync.next();
    this.pulseOverflowWarned.clear();
    const array = this.fb.array<FormGroup>(lines.map(line => this.createItemGroup(line)));
    this.form.setControl('items', array);
  }

  private createItemGroup(line: BookingLineItem): FormGroup {
    const group = this.fb.nonNullable.group({
      status: ['complete' as CloseLineStatus, Validators.required],
      pulsesUsed: [null as number | null],
      notes: ['', Validators.maxLength(200)],
    });

    this.applyPulseValidators(group, line);
    group.controls['status'].valueChanges
      .pipe(takeUntil(this.lineSync), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyPulseValidators(group, line));
    group.controls['pulsesUsed'].valueChanges
      .pipe(takeUntil(this.lineSync), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.warnIfPulsesExceedRemaining(line, value));

    return group;
  }

  private applyPulseValidators(group: FormGroup, line: BookingLineItem): void {
    const pulsesControl = group.controls['pulsesUsed'];
    const status = group.controls['status'].value as CloseLineStatus;
    pulsesControl.clearValidators();

    if (this.isPulseLine(line) && status === 'complete') {
      const max = this.lineRemaining(line) ?? 0;
      pulsesControl.setValidators([Validators.required, Validators.min(1), Validators.max(max)]);
    } else {
      pulsesControl.setValue(null);
      this.pulseOverflowWarned.delete(line.id);
    }

    pulsesControl.updateValueAndValidity({ emitEvent: false });
  }

  private hasPulsesOverRemaining(): boolean {
    return this.lineItems().some(
      (line, index) =>
        this.showPulseInput(line, index) &&
        this.pulsesExceedRemaining(line, this.itemGroup(index)?.controls['pulsesUsed'].value)
    );
  }

  private hasNonPulseMaxErrors(): boolean {
    return this.itemsArray().controls.some(group => {
      const pulseHasOtherError = Object.keys(group.controls['pulsesUsed'].errors ?? {}).some(
        key => key !== 'max'
      );
      return (
        group.controls['status'].invalid || group.controls['notes'].invalid || pulseHasOtherError
      );
    });
  }

  private warnIfPulsesExceedRemaining(line: BookingLineItem, value: unknown): void {
    if (!this.pulsesExceedRemaining(line, value)) {
      this.pulseOverflowWarned.delete(line.id);
      return;
    }

    if (this.pulseOverflowWarned.has(line.id)) {
      return;
    }

    this.pulseOverflowWarned.add(line.id);
    this.toastPulsesExceedRemaining();
  }

  private pulsesExceedRemaining(line: BookingLineItem, value: unknown): boolean {
    const pulses = typeof value === 'number' ? value : null;
    if (pulses == null) {
      return false;
    }

    return pulses > (this.lineRemaining(line) ?? 0);
  }

  private toastPulsesExceedRemaining(): void {
    this.toast.add({
      severity: 'warn',
      summary: this.translate.instant('HTTP_ERRORS.SUMMARY'),
      detail: this.translate.instant('BOOKINGS.CLOSE.ERRORS.PULSES_MAX'),
    });
  }
}
