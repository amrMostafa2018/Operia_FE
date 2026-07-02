import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { AuthStore } from '../../../core/store/auth.store';
import { extractOtpFieldError } from '../../../core/utils/api-error.util';
import { OtpVerificationComponent } from '../../../shared/components/otp-verification/otp-verification.component';
import { OtpLabels } from '../../../shared/components/otp-verification/otp-labels.model';

type LoginStep = 'form' | 'otp';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    TranslatePipe,
    OtpVerificationComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);

  form!: FormGroup;
  isLoading = this.authStore.isLoading;

  step = signal<LoginStep>('form');
  userId = signal<string | null>(null);
  rememberMe = signal(false);
  isResendingOtp = signal(false);
  otpServerError = signal<string | null>(null);

  showPassword = signal(false);

  readonly otpLabels: OtpLabels = {
    title: 'AUTH.LOGIN_PAGE.OTP_TITLE',
    subtitle: 'AUTH.LOGIN_PAGE.OTP_SUBTITLE',
    code: 'AUTH.LOGIN_PAGE.OTP_CODE',
    placeholder: 'AUTH.LOGIN_PAGE.OTP_PLACEHOLDER',
    invalid: 'AUTH.LOGIN_PAGE.OTP_INVALID',
    verify: 'AUTH.LOGIN_PAGE.OTP_VERIFY',
    back: 'AUTH.LOGIN_PAGE.OTP_BACK',
    resend: 'AUTH.LOGIN_PAGE.OTP_RESEND',
    resendIn: 'AUTH.LOGIN_PAGE.OTP_RESEND_IN',
  };

  readonly submitIcon = computed(() =>
    this.languageService.currentLang() === 'ar' ? 'pi pi-arrow-left' : 'pi pi-arrow-right'
  );

  ngOnInit(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  backToForm(): void {
    this.step.set('form');
    this.userId.set(null);
    this.otpServerError.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, rememberMe } = this.form.value;

    this.authService.initiateLogin({ email, password, rememberMe }).subscribe({
      next: (res) => {
        this.rememberMe.set(!!rememberMe);
        this.userId.set(res.userId);
        this.otpServerError.set(null);
        this.step.set('otp');
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.LOGIN_PAGE.OTP_SENT_TITLE'),
          detail: this.translate.instant('AUTH.LOGIN_PAGE.OTP_SENT_DETAIL'),
          life: 5000,
        });
      },
    });
  }

  onVerifyOtp(code: string): void {
    const userId = this.userId();
    if (!userId) {
      this.backToForm();
      return;
    }

    this.otpServerError.set(null);

    this.authService.verifyLoginOtp({ userId, code }, this.rememberMe()).subscribe({
      error: (err: HttpErrorResponse) => this.handleOtpVerifyError(err),
    });
  }

  private handleOtpVerifyError(err: HttpErrorResponse): void {
    this.otpServerError.set(
      extractOtpFieldError(err, key => this.translate.instant(key))
    );
  }

  onResendOtp(): void {
    const userId = this.userId();
    if (!userId) {
      this.backToForm();
      return;
    }

    this.isResendingOtp.set(true);
    this.otpServerError.set(null);

    this.authService.resendLoginOtp({ userId }).subscribe({
      next: () => {
        this.isResendingOtp.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.LOGIN_PAGE.OTP_SENT_TITLE'),
          detail: this.translate.instant('AUTH.LOGIN_PAGE.OTP_SENT_DETAIL'),
          life: 5000,
        });
      },
      error: () => this.isResendingOtp.set(false),
    });
  }
}
