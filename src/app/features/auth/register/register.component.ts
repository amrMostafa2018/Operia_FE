import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { AuthStore } from '../../../core/store/auth.store';
import { OtpVerificationComponent } from '../../../shared/components/otp-verification/otp-verification.component';
import { OtpLabels } from '../../../shared/components/otp-verification/otp-labels.model';

interface CountryCode {
  name: string;
  code: string;
  flag: string;
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const password = parent.get('password')?.value;
  return control.value && control.value !== password ? { mismatch: true } : null;
}

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
    TranslatePipe,
    OtpVerificationComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);

  form!: FormGroup;
  isLoading = this.authStore.isLoading;
  errorMessage = this.authStore.error;

  step = signal<RegisterStep>('form');
  registrationId = signal<string | null>(null);
  displayName = signal('');

  readonly otpLabels: OtpLabels = {
    title: 'AUTH.REGISTER_PAGE.OTP_TITLE',
    subtitle: 'AUTH.REGISTER_PAGE.OTP_SUBTITLE',
    code: 'AUTH.REGISTER_PAGE.OTP_CODE',
    placeholder: 'AUTH.REGISTER_PAGE.OTP_PLACEHOLDER',
    invalid: 'AUTH.REGISTER_PAGE.OTP_INVALID',
    verify: 'AUTH.REGISTER_PAGE.OTP_VERIFY',
    back: 'AUTH.REGISTER_PAGE.OTP_BACK',
  };

  showPassword = signal(false);
  showConfirm = signal(false);

  readonly submitIcon = computed(() =>
    this.languageService.currentLang() === 'ar' ? 'pi pi-arrow-left' : 'pi pi-arrow-right'
  );

  countryCodes: CountryCode[] = [
    { name: 'مصر', code: '+20', flag: '🇪🇬' },
    { name: 'السعودية', code: '+966', flag: '🇸🇦' },
    { name: 'الإمارات', code: '+971', flag: '🇦🇪' },
    { name: 'الكويت', code: '+965', flag: '🇰🇼' },
    { name: 'قطر', code: '+974', flag: '🇶🇦' },
    { name: 'البحرين', code: '+973', flag: '🇧🇭' },
    { name: 'عُمان', code: '+968', flag: '🇴🇲' },
    { name: 'الأردن', code: '+962', flag: '🇯🇴' },
    { name: 'لبنان', code: '+961', flag: '🇱🇧' },
    { name: 'المغرب', code: '+212', flag: '🇲🇦' },
  ];

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      countryCode: ['+20', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{7,15}$/)]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
      ]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator]],
      agreeToTerms: [false, Validators.requiredTrue],
    });

    this.form.get('password')?.valueChanges.subscribe(() => {
      this.form.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  backToForm(): void {
    this.step.set('form');
    this.registrationId.set(null);
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

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, phone, countryCode, password, confirmPassword } = this.form.value;
    const phoneNumber = `${countryCode}${phone}`.replace(/\s/g, '');

    this.authService.initiateRegistration({
      email,
      password,
      confirmPassword,
      phoneNumber,
    }).subscribe({
      next: (res) => {
        this.displayName.set(name);
        this.registrationId.set(res.registrationId);
        this.step.set('otp');
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('AUTH.REGISTER_PAGE.OTP_SENT_TITLE'),
          detail: this.translate.instant('AUTH.REGISTER_PAGE.OTP_SENT_DETAIL'),
          life: 5000,
        });
      },
    });
  }

  onVerifyOtp(code: string): void {
    const registrationId = this.registrationId();
    if (!registrationId) {
      this.backToForm();
      return;
    }

    this.authService.verifyRegisterOtp(
      { registrationId, code },
      this.displayName()
    ).subscribe({
      next: () => this.router.navigate(['/dashboard']),
    });
  }
}
