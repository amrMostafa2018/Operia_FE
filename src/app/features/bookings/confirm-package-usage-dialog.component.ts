import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { isFieldInvalid } from '@app/shared/utils/form-field.util';
import { BookingLineItem, bookingPerformedServiceOptions } from './models/booking.model';

@Component({
  selector: 'app-confirm-package-usage-dialog',
  standalone: true,
  imports: [
    DialogModule,
    DropdownModule,
    ReactiveFormsModule,
    InputNumberModule,
    InputTextareaModule,
    TranslatePipe,
  ],
  templateUrl: './confirm-package-usage-dialog.component.html',
  styleUrl: './confirm-package-usage-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmPackageUsageDialogComponent {
  private readonly fb = inject(FormBuilder);

  readonly visible = input(false);
  readonly lineItems = input<BookingLineItem[]>([]);

  readonly submitted = output<{ usageCount: number; serviceType: string; notes: string }>();
  readonly closed = output<void>();

  readonly serviceOptions = computed(() => bookingPerformedServiceOptions(this.lineItems()));

  readonly form = this.fb.nonNullable.group({
    usageCount: [0, [Validators.required, Validators.min(0)]],
    serviceType: ['', Validators.required],
    notes: ['', Validators.maxLength(200)],
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const options = this.serviceOptions();
      const defaultId = options.length === 1 ? options[0].value : '';
      this.form.reset({ usageCount: 0, serviceType: defaultId, notes: '' });
    });
  }

  isInvalid(field: string): boolean {
    return isFieldInvalid(this.form, field);
  }

  notesLength(): number {
    return this.form.controls.notes.value.length;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const selected = this.serviceOptions().find(option => option.value === value.serviceType);
    this.submitted.emit({
      usageCount: value.usageCount,
      serviceType: selected?.label ?? value.serviceType,
      notes: value.notes,
    });
  }

  close(): void {
    this.closed.emit();
  }
}
