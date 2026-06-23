import { Component, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { OtpLabels } from './otp-labels.model';

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ButtonModule, InputTextModule],
  templateUrl: './otp-verification.component.html',
  styleUrl: './otp-verification.component.scss',
})
export class OtpVerificationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  labels = input.required<OtpLabels>();
  isLoading = input(false);
  submitIcon = input('pi pi-arrow-right');
  inputId = input('otpCode');

  verify = output<string>();
  back = output<void>();

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.verify.emit(this.form.value.code);
  }

  onBack(): void {
    this.form.reset();
    this.back.emit();
  }
}
