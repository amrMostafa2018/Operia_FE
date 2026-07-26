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
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';

import { AuthService } from '@core/services/auth.service';
import { AppConfigService } from '@core/services/app-config.service';
import { OnboardingService } from '@core/services/onboarding.service';
import { OnboardingStateService } from '@core/services/onboarding-state.service';
import { LanguageService } from '@core/services/language.service';
import {
  getPrevArrowIcon,
  getLeadingIconPos,
  getSubmitArrowIcon,
  getSubmitIconPos,
} from '@app/shared/utils/rtl.util';
import {
  ACTIVITY_TYPES,
  ActivityType,
  ActivityTypeId,
} from '@app/features/onboarding/models/activity-type.model';
import { ACTIVITY_TO_BUSINESS_TYPE } from '@app/features/onboarding/models/onboarding.model';
import { HttpErrorResponse } from '@angular/common/http';
import { extractApiError } from '@core/utils/api-error.util';
import { SingleFileDragState } from '@app/shared/utils/file-drag.util';
import {
  showUploadValidationToast,
  validateUploadFile,
} from '@app/shared/utils/file-upload.util';
import { isFieldInvalid } from '@app/shared/utils/form-field.util';

interface SelectOption<T = string> {
  label: string;
  value: T;
}

const COUNTRY_CODES = ['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO'] as const;
const CURRENCY_CODES = ['EGP', 'SAR', 'AED', 'USD'] as const;

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  EG: ['cairo', 'alexandria', 'giza', 'sharm'],
  SA: ['riyadh', 'jeddah', 'dammam'],
  AE: ['dubai', 'abu_dhabi', 'sharjah'],
  KW: ['kuwait_city'],
  QA: ['doha'],
  BH: ['manama'],
  OM: ['muscat'],
  JO: ['amman'],
};

@Component({
  selector: 'app-business-setup',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, DropdownModule, InputTextModule, TranslatePipe],
  templateUrl: './business-setup.component.html',
  styleUrl: './business-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessSetupComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly onboardingState = inject(OnboardingStateService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly appConfig = inject(AppConfigService);
  private readonly messageService = inject(MessageService);

  form!: FormGroup;
  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  selectedActivityId = signal<ActivityTypeId>('laser_clinic');
  logoPreview = signal<string | null>(null);
  logoFile = signal<File | null>(null);
  isLogoDragOver = signal(false);

  private readonly logoDragState = new SingleFileDragState(this.isLogoDragOver);

  readonly activityTypes = ACTIVITY_TYPES;
  readonly acceptedImageAccept = this.appConfig.allowedMimeTypesAccept;

  readonly selectedActivity = computed(
    () => this.activityTypes.find(a => a.id === this.selectedActivityId()) ?? this.activityTypes[0]
  );

  readonly isArabic = computed(() => this.languageService.currentLang() === 'ar');

  readonly prevIcon = computed(() => getPrevArrowIcon(this.languageService.currentLang()));

  readonly submitIcon = computed(() => getSubmitArrowIcon(this.languageService.currentLang()));

  readonly prevIconPos = computed<'left' | 'right'>(() =>
    getLeadingIconPos(this.languageService.currentLang())
  );

  readonly submitIconPos = computed<'left' | 'right'>(() =>
    getSubmitIconPos(this.languageService.currentLang())
  );

  readonly countries = computed<SelectOption[]>(() => {
    this.languageService.currentLang();
    return COUNTRY_CODES.map(code => ({
      label: this.translate.instant(`ONBOARDING.BUSINESS_SETUP.COUNTRIES.${code}`),
      value: code,
    }));
  });

  readonly currencies = computed<SelectOption[]>(() => {
    this.languageService.currentLang();
    return CURRENCY_CODES.map(code => ({
      label: this.translate.instant(`ONBOARDING.BUSINESS_SETUP.CURRENCIES.${code}`),
      value: code,
    }));
  });

  cities = signal<SelectOption[]>(this.buildCityOptions('EG'));

  ngOnInit(): void {
    this.form = this.fb.group({
      businessName: ['', [Validators.required, Validators.minLength(2)]],
      country: ['EG', Validators.required],
      city: ['cairo', Validators.required],
      currency: ['EGP', Validators.required],
    });

    this.form
      .get('country')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(country => {
        const cityOptions = this.buildCityOptions(country);
        this.cities.set(cityOptions);
        if (cityOptions.length) {
          this.form.patchValue({ city: cityOptions[0].value });
        }
      });
  }

  private buildCityOptions(country: string): SelectOption[] {
    this.languageService.currentLang();
    const cityCodes = CITIES_BY_COUNTRY[country] ?? [];
    return cityCodes.map(code => ({
      label: this.translate.instant(`ONBOARDING.BUSINESS_SETUP.CITIES.${code}`),
      value: code,
    }));
  }

  selectActivity(id: ActivityTypeId): void {
    const activity = this.activityTypes.find(a => a.id === id);
    if (activity?.comingSoon) {
      return;
    }

    this.selectedActivityId.set(id);
  }

  isActivityDisabled(activity: ActivityType): boolean {
    return !!activity.comingSoon;
  }

  isInvalid(field: string): boolean {
    return isFieldInvalid(this.form, field);
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.setLogoFile(file);
    }
  }

  onLogoDragEnter(event: DragEvent): void {
    this.logoDragState.onEnter(event);
  }

  onLogoDragOver(event: DragEvent): void {
    this.logoDragState.onOver(event);
  }

  onLogoDragLeave(event: DragEvent): void {
    this.logoDragState.onLeave(event);
  }

  onLogoDrop(event: DragEvent): void {
    const file = this.logoDragState.onDrop(event);
    if (file) {
      this.setLogoFile(file);
    }
  }

  onRemoveLogo(): void {
    this.logoPreview.set(null);
    this.logoFile.set(null);
    const input = document.getElementById('logoInput') as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  onPrevious(): void {
    const entrySource = this.authService.getOnboardingEntrySource();

    if (entrySource === 'register') {
      this.authService.returnToRegister();
      return;
    }

    if (entrySource === 'login' || this.authService.hasActiveSession()) {
      this.authService.logout();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const formValue = this.form.getRawValue();
    const logoPreview = this.logoPreview();

    this.onboardingService
      .setupBusiness({
        businessName: formValue.businessName,
        businessType: ACTIVITY_TO_BUSINESS_TYPE[this.selectedActivityId()],
        countryCode: formValue.country,
        city: formValue.city,
        currencyCode: formValue.currency,
        logoFile: this.logoFile(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.onboardingState.setBusinessSetup({
            activityTypeId: this.selectedActivityId(),
            businessName: formValue.businessName,
            country: formValue.country,
            city: formValue.city,
            currency: formValue.currency,
            logoUrl: logoPreview,
            tenantId: result.tenantId,
            businessId: result.businessId,
          });
          this.isSubmitting.set(false);
          void this.router.navigate(['/onboarding/plan']);
        },
        error: (err: unknown) => {
          this.isSubmitting.set(false);
          this.submitError.set(extractApiError(err as HttpErrorResponse));
        },
      });
  }

  private setLogoFile(file: File): void {
    const validation = validateUploadFile(file, this.appConfig);
    if (!validation.valid) {
      showUploadValidationToast(this.messageService, this.translate, validation.errorKey!);
      return;
    }

    this.submitError.set(null);
    this.logoFile.set(file);

    const reader = new FileReader();
    reader.onload = () => this.logoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }
}
