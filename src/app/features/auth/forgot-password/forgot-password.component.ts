import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { AuthStore } from '../../../core/store/auth.store';
import { passwordMatchValidator } from '../../../core/utils/validators.util';
import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '../../../shared/constants/phone-input.config';
import { OtpVerificationComponent } from '../../../shared/components/otp-verification/otp-verification.component';
import { buildOtpLabels, handleOtpVerifyError as resolveOtpVerifyError } from '../../../shared/utils/otp.util';
import { getSubmitArrowIcon } from '../../../shared/utils/rtl.util';
import { getE164PhoneNumber, getPhoneFieldError } from '../../../shared/utils/phone-number.util';

type ForgotPasswordStep = 'phone' | 'otp' | 'reset';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    NgxIntlTelInputModule,
    TranslatePipe,
    OtpVerificationComponent,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);

  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly selectedCountryISO = PHONE_INPUT_DEFAULT_COUNTRY;
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;

  phoneForm!: FormGroup;
  resetForm!: FormGroup;
  isLoading = this.authStore.isLoading;

  step = signal<ForgotPasswordStep>('phone');
  phoneNumber = signal<string | null>(null);
  resetToken = signal<string | null>(null);
  isResendingOtp = signal(false);
  otpServerError = signal<string | null>(null);

  showPassword = signal(false);
  showConfirm = signal(false);

  readonly otpLabels = buildOtpLabels('AUTH.FORGOT_PASSWORD_PAGE');

  readonly submitIcon = computed(() =>
    getSubmitArrowIcon(this.languageService.currentLang())
  );

  ngOnInit(): void {
    this.phoneForm = this.fb.group({
      phone: [null, Validators.required],
    });

    this.resetForm = this.fb.group({
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
      ]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
    });

    this.resetForm.get('password')?.valueChanges.subscribe(() => {
      this.resetForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  isPhoneInvalid(): boolean {
    const ctrl = this.phoneForm.get('phone');
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  isResetInvalid(field: string): boolean {
    const ctrl = this.resetForm.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  getPhoneError(): string | null {
    return getPhoneFieldError(this.phoneForm.get('phone'), {
      required: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.PHONE_REQUIRED'),
      invalid: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.PHONE_INVALID'),
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirm(): void {
    this.showConfirm.update(v => !v);
  }

  backToPhone(): void {
    this.step.set('phone');
    this.resetToken.set(null);
    this.otpServerError.set(null);
  }

  onSubmitPhone(): void {
    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }

    const phone = getE164PhoneNumber(this.phoneForm.get('phone')?.value);
    this.phoneNumber.set(phone);

    this.authService.forgotPassword(phone).subscribe({
      next: () => {
        this.otpServerError.set(null);
        this.step.set('otp');
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.OTP_SENT_TITLE'),
          detail: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.OTP_SENT_DETAIL'),
          life: 5000,
        });
      },
    });
  }

  onVerifyOtp(code: string): void {
    const phone = this.phoneNumber();
    if (!phone) {
      this.backToPhone();
      return;
    }

    this.otpServerError.set(null);

    this.authService.verifyForgotPasswordOtp(phone, code).subscribe({
      next: (res) => {
        this.resetToken.set(res.resetToken);
        this.step.set('reset');
      },
      error: (err: HttpErrorResponse) => this.handleOtpVerifyError(err),
    });
  }

  onResendOtp(): void {
    const phone = this.phoneNumber();
    if (!phone) {
      this.backToPhone();
      return;
    }

    this.isResendingOtp.set(true);
    this.otpServerError.set(null);

    this.authService.resendForgotPasswordOtp(phone).subscribe({
      next: () => {
        this.isResendingOtp.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.OTP_SENT_TITLE'),
          detail: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.OTP_SENT_DETAIL'),
          life: 5000,
        });
      },
      error: () => this.isResendingOtp.set(false),
    });
  }

  onSubmitReset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const phone = this.phoneNumber();
    const token = this.resetToken();
    if (!phone || !token) {
      this.backToPhone();
      return;
    }

    const { password, confirmPassword } = this.resetForm.value;

    this.authService.resetPassword(phone, token, password, confirmPassword).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.RESET_SUCCESS'),
          detail: this.translate.instant('AUTH.FORGOT_PASSWORD_PAGE.RESET_SUCCESS_DETAIL'),
          life: 5000,
        });
        this.router.navigate(['/auth/login']);
      },
    });
  }

  private handleOtpVerifyError(err: HttpErrorResponse): void {
    this.otpServerError.set(
      resolveOtpVerifyError(err, key => this.translate.instant(key))
    );
  }
}
