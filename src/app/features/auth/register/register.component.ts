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
import { PhoneUsernameAutocompleteDirective } from '@app/shared/directives/phone-username-autocomplete.directive';
import {
  buildOtpLabels,
  handleOtpVerifyError as resolveOtpVerifyError,
} from '@app/shared/utils/otp.util';
import { getSubmitArrowIcon } from '@app/shared/utils/rtl.util';
import { getCredentialPhoneUsername, getE164PhoneNumber, getPhoneFieldError } from '@app/shared/utils/phone-number.util';
import { createPasswordToggle, getFieldServerError, isFieldInvalid, syncTelInputValueForCredentialSave } from '../auth-form.utils';

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
    NgxIntlTelInputModule,
    TranslatePipe,
    OtpVerificationComponent,
    PhoneUsernameAutocompleteDirective,
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
  readonly isFieldInvalid = isFieldInvalid;
  readonly getFieldServerError = getFieldServerError;

  form!: FormGroup;
  isLoading = this.authStore.isLoading;

  step = signal<RegisterStep>('form');
  registrationId = signal<string | null>(null);
  displayName = signal('');
  otpServerError = signal<string | null>(null);
  isResendingOtp = signal(false);

  readonly otpLabels = buildOtpLabels('AUTH.REGISTER_PAGE');

  private readonly passwordToggle = createPasswordToggle();
  readonly showPassword = this.passwordToggle.show;
  readonly togglePassword = this.passwordToggle.toggle;

  private readonly confirmToggle = createPasswordToggle();
  readonly showConfirm = this.confirmToggle.show;
  readonly toggleConfirm = this.confirmToggle.toggle;

  readonly submitIcon = computed(() => getSubmitArrowIcon(this.languageService.currentLang()));

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
      'name',
      'email',
      'phone',
      'password',
      'confirmPassword',
    ]);
  }

  private handleRegisterError(err: HttpErrorResponse): void {
    const fieldErrors = extractApiFieldErrors(err);
    const translated = translateApiFieldErrors(fieldErrors, key => this.translate.instant(key));
    applyServerFieldErrors(this.form, translated);
  }

  private handleOtpVerifyError(err: HttpErrorResponse): void {
    this.otpServerError.set(resolveOtpVerifyError(err, key => this.translate.instant(key)));
  }

  backToForm(): void {
    this.step.set('form');
    this.registrationId.set(null);
    this.otpServerError.set(null);
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
    syncTelInputValueForCredentialSave('registerPhone', getCredentialPhoneUsername(phone));

    this.authService
      .initiateRegistration({
        fullName: name,
        email,
        password,
        confirmPassword,
        phoneNumber,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
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
    syncTelInputValueForCredentialSave(
      'registerPhone',
      getCredentialPhoneUsername(this.form.get('phone')?.value)
    );

    this.authService
      .verifyRegisterOtp({ registrationId, code }, this.displayName())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

    this.authService
      .resendRegisterOtp({ registrationId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
