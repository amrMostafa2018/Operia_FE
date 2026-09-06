import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { isFieldInvalid } from '@app/shared/utils/form-field.util';

@Component({
  selector: 'app-confirm-package-usage-dialog',
  standalone: true,
  imports: [
    DialogModule,
    ButtonModule,
    ReactiveFormsModule,
    InputNumberModule,
    InputTextModule,
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

  readonly submitted = output<{ usageCount: number; serviceType: string; notes: string }>();
  readonly closed = output<void>();

  readonly form = this.fb.nonNullable.group({
    usageCount: [0, [Validators.required, Validators.min(0)]],
    serviceType: ['', Validators.required],
    notes: ['', Validators.maxLength(200)],
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ usageCount: 0, serviceType: '', notes: '' });
      }
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
    this.submitted.emit(value);
  }

  close(): void {
    this.closed.emit();
  }
}
