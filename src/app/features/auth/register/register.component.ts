import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';

import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { AuthStore } from '@core/store/auth.store';
import {
  applyServerFieldErrors,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import {
  PASSWORD_VALIDATORS,
  passwordMatchValidator,
  setupPasswordConfirmSync,
  setupServerErrorClearing,
} from '@core/utils/validators.util';
import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';
import { OtpVerificationComponent } from '@app/shared/components/otp-verification/otp-verification.component';
import { buildOtpLabels, handleOtpVerifyError as resolveOtpVerifyError } from '@app/shared/utils/otp.util';
import { getSubmitArrowIcon } from '@app/shared/utils/rtl.util';
import { getE164PhoneNumber, getPhoneFieldError } from '@app/shared/utils/phone-number.util';

type RegisterStep = 'form' | 'otp';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
    NgxIntlTelInputModule,
    TranslatePipe,
    OtpVerificationComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly selectedCountryISO = PHONE_INPUT_DEFAULT_COUNTRY;
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;

  form!: FormGroup;
  isLoading = this.authStore.isLoading;
  errorMessage = this.authStore.error;

  step = signal<RegisterStep>('form');
  registrationId = signal<string | null>(null);
  displayName = signal('');
  otpServerError = signal<string | null>(null);
  isResendingOtp = signal(false);

  readonly otpLabels = buildOtpLabels('AUTH.REGISTER_PAGE');

  showPassword = signal(false);
  showConfirm = signal(false);

  readonly submitIcon = computed(() =>
    getSubmitArrowIcon(this.languageService.currentLang())
  );

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [null, Validators.required],
      password: ['', PASSWORD_VALIDATORS],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
      agreeToTerms: [false, Validators.requiredTrue],
    });

    setupPasswordConfirmSync(this.form, this.destroyRef);
    setupServerErrorClearing(this.form, this.destroyRef, [
      'email',
      'phone',
      'password',
      'confirmPassword',
    ]);
  }

  private handleRegisterError(err: HttpErrorResponse): void {
    const fieldErrors = extractApiFieldErrors(err);
    const translated = translateApiFieldErrors(fieldErrors, key =>
      this.translate.instant(key)
    );
    applyServerFieldErrors(this.form, translated);
  }

  private handleOtpVerifyError(err: HttpErrorResponse): void {
    this.otpServerError.set(
      resolveOtpVerifyError(err, key => this.translate.instant(key))
    );
  }

  backToForm(): void {
    this.step.set('form');
    this.registrationId.set(null);
    this.otpServerError.set(null);
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirm(): void {
    this.showConfirm.update(v => !v);
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  getFieldError(field: string): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl?.touched || !ctrl.errors) {
      return null;
    }
    if (ctrl.errors['server']) {
      return ctrl.errors['server'];
    }
    return null;
  }

  getPhoneError(): string | null {
    return getPhoneFieldError(this.form.get('phone'), {
      required: this.translate.instant('AUTH.REGISTER_PAGE.PHONE_REQUIRED'),
      invalid: this.translate.instant('AUTH.REGISTER_PAGE.PHONE_INVALID'),
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, phone, password, confirmPassword } = this.form.value;
    const phoneNumber = getE164PhoneNumber(phone);

    this.authService.initiateRegistration({
      email,
      password,
      confirmPassword,
      phoneNumber,
    }).subscribe({
      next: (res) => {
        this.displayName.set(name);
        this.registrationId.set(res.registrationId);
        this.otpServerError.set(null);
        this.step.set('otp');
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.REGISTER_PAGE.OTP_SENT_TITLE'),
          detail: this.translate.instant('AUTH.REGISTER_PAGE.OTP_SENT_DETAIL'),
          life: 5000,
        });
      },
      error: (err: HttpErrorResponse) => this.handleRegisterError(err),
    });
  }

  onVerifyOtp(code: string): void {
    const registrationId = this.registrationId();
    if (!registrationId) {
      this.backToForm();
      return;
    }

    this.otpServerError.set(null);

    this.authService.verifyRegisterOtp(
      { registrationId, code },
      this.displayName()
    ).subscribe({
      error: (err: HttpErrorResponse) => this.handleOtpVerifyError(err),
    });
  }

  onResendOtp(): void {
    const registrationId = this.registrationId();
    if (!registrationId) {
      this.backToForm();
      return;
    }

    this.isResendingOtp.set(true);
    this.otpServerError.set(null);

    this.authService.resendRegisterOtp({ registrationId }).subscribe({
      next: () => {
        this.isResendingOtp.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.REGISTER_PAGE.OTP_SENT_TITLE'),
          detail: this.translate.instant('AUTH.REGISTER_PAGE.OTP_SENT_DETAIL'),
          life: 5000,
        });
      },
      error: () => this.isResendingOtp.set(false),
    });
  }
}
