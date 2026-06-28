import { Component, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';

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

export class OtpVerificationComponent implements OnInit, OnDestroy {

  private readonly fb = inject(FormBuilder);



  labels = input.required<OtpLabels>();

  isLoading = input(false);

  isResending = input(false);

  submitIcon = input('pi pi-arrow-right');

  inputId = input('otpCode');

  serverError = input<string | null>(null);

  resendCooldownSeconds = input(60);



  verify = output<string>();

  resend = output<void>();

  back = output<void>();



  form!: FormGroup;

  resendCountdown = signal(0);



  private countdownTimer: ReturnType<typeof setInterval> | null = null;



  ngOnInit(): void {

    this.form = this.fb.group({

      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],

    });

    this.startResendCooldown();

  }



  ngOnDestroy(): void {

    this.clearCountdown();

  }



  isInvalid(field: string): boolean {

    const ctrl = this.form.get(field);

    return !!(ctrl?.invalid && ctrl?.touched);

  }



  canResend(): boolean {

    return this.resendCountdown() === 0 && !this.isResending() && !this.isLoading();

  }



  onSubmit(): void {

    if (this.form.invalid) {

      this.form.markAllAsTouched();

      return;

    }



    this.verify.emit(this.form.value.code);

  }



  onResend(): void {

    if (!this.canResend()) {

      return;

    }



    this.form.reset();
    this.startResendCooldown();
    this.resend.emit();

  }



  onBack(): void {

    this.form.reset();

    this.clearCountdown();

    this.back.emit();

  }



  private startResendCooldown(): void {

    this.clearCountdown();

    this.resendCountdown.set(this.resendCooldownSeconds());



    this.countdownTimer = setInterval(() => {

      const next = this.resendCountdown() - 1;

      if (next <= 0) {

        this.resendCountdown.set(0);

        this.clearCountdown();

      } else {

        this.resendCountdown.set(next);

      }

    }, 1000);

  }



  private clearCountdown(): void {

    if (this.countdownTimer) {

      clearInterval(this.countdownTimer);

      this.countdownTimer = null;

    }

  }

}

