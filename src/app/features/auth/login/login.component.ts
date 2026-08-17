import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { AuthStore } from '@core/store/auth.store';
import {
  applyServerFieldErrors,
  extractAuthFormFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import {
  PASSWORD_VALIDATORS,
  passwordMatchValidatorFor,
  setupPasswordConfirmSync,
  setupServerErrorClearing,
} from '@core/utils/validators.util';
import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';
import { OtpVerificationComponent } from '@app/shared/components/otp-verification/otp-verification.component';
import { PhoneUsernameAutocompleteDirective } from '@app/shared/directives/phone-username-autocomplete.directive';
import {
  buildOtpLabels,
  handleOtpVerifyError as resolveOtpVerifyError,
} from '@app/shared/utils/otp.util';
import { getSubmitArrowIcon } from '@app/shared/utils/rtl.util';
import { getCredentialPhoneUsername, getE164PhoneNumber, getPhoneFieldError } from '@app/shared/utils/phone-number.util';
import { createPasswordToggle, getFieldServerError, isFieldInvalid, syncTelInputValueForCredentialSave } from '../auth-form.utils';

type LoginStep = 'form' | 'otp' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    NgxIntlTelInputModule,
    TranslatePipe,
    OtpVerificationComponent,
    PhoneUsernameAutocompleteDirective,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isFieldInvalid = isFieldInvalid;
  readonly getFieldServerError = getFieldServerError;
  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly selectedCountryISO = PHONE_INPUT_DEFAULT_COUNTRY;
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;

  form!: FormGroup;
  isLoading = this.authStore.isLoading;

  step = signal<LoginStep>('form');
  userId = signal<string | null>(null);
  rememberMe = signal(false);
  isResendingOtp = signal(false);
  otpServerError = signal<string | null>(null);
  resetToken = signal<string | null>(null);
  passwordForm = this.fb.nonNullable.group({
    newPassword: ['', PASSWORD_VALIDATORS],
    confirmPassword: ['', [Validators.required, passwordMatchValidatorFor('newPassword')]],
  });

  private readonly passwordToggle = createPasswordToggle();
  readonly showPassword = this.passwordToggle.show;
  readonly togglePassword = this.passwordToggle.toggle;

  private readonly newPasswordToggle = createPasswordToggle();
  readonly showNewPassword = this.newPasswordToggle.show;
  readonly toggleNewPassword = this.newPasswordToggle.toggle;

  private readonly confirmToggle = createPasswordToggle();
  readonly showConfirm = this.confirmToggle.show;
  readonly toggleConfirm = this.confirmToggle.toggle;

  readonly otpLabels = buildOtpLabels('AUTH.LOGIN_PAGE');

  readonly submitIcon = computed(() => getSubmitArrowIcon(this.languageService.currentLang()));

  ngOnInit(): void {
    this.form = this.fb.group({
      phone: [null, Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });

    setupServerErrorClearing(this.form, this.destroyRef, ['phone', 'password']);
    setupPasswordConfirmSync(this.passwordForm, this.destroyRef, 'newPassword', 'confirmPassword');
  }

  private handleLoginError(err: HttpErrorResponse): void {
    const fieldErrors = extractAuthFormFieldErrors(err);
    const translated = translateApiFieldErrors(fieldErrors, key => this.translate.instant(key));
    applyServerFieldErrors(this.form, translated);
  }

  getPhoneError(): string | null {
    return getPhoneFieldError(this.form.get('phone'), {
      required: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_REQUIRED'),
      invalid: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_INVALID'),
    });
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

    const { phone, password, rememberMe } = this.form.getRawValue();
    const phoneNumber = getE164PhoneNumber(phone);
    syncTelInputValueForCredentialSave('loginPhone', getCredentialPhoneUsername(phone));

    this.authService
      .initiateLogin({ phoneNumber, password, rememberMe })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
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
        error: (err: HttpErrorResponse) => this.handleLoginError(err),
      });
  }

  onVerifyOtp(code: string): void {
    const userId = this.userId();
    if (!userId) {
      this.backToForm();
      return;
    }

    this.otpServerError.set(null);
    syncTelInputValueForCredentialSave(
      'loginPhone',
      getCredentialPhoneUsername(this.form.get('phone')?.value)
    );

    this.authService
      .verifyLoginOtp({ userId, code }, this.rememberMe())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.requiresPasswordChange && res.resetToken) {
            this.resetToken.set(res.resetToken);
            this.step.set('password');
          }
        },
        error: (err: HttpErrorResponse) => this.handleOtpVerifyError(err),
      });
  }

  completeFirstLogin(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { newPassword } = this.passwordForm.getRawValue();
    const userId = this.userId();
    const resetToken = this.resetToken();
    if (!userId || !resetToken) {
      this.backToForm();
      return;
    }
    this.authService
      .completeFirstLogin(userId, resetToken, newPassword, this.rememberMe())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: (err: HttpErrorResponse) => this.handleOtpVerifyError(err) });
  }

  private handleOtpVerifyError(err: HttpErrorResponse): void {
    this.otpServerError.set(resolveOtpVerifyError(err, key => this.translate.instant(key)));
  }

  onResendOtp(): void {
    const userId = this.userId();
    if (!userId) {
      this.backToForm();
      return;
    }

    this.isResendingOtp.set(true);
    this.otpServerError.set(null);

    this.authService
      .resendLoginOtp({ userId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
