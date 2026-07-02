import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';

import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ACTIVITY_TYPES, ActivityType, ActivityTypeId } from '../models/activity-type.model';

interface SelectOption<T = string> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-business-setup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    TranslatePipe,
  ],
  templateUrl: './business-setup.component.html',
  styleUrl: './business-setup.component.scss',
})
export class BusinessSetupComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);

  form!: FormGroup;
  isSubmitting = signal(false);
  selectedActivityId = signal<ActivityTypeId>('laser_clinic');
  logoPreview = signal<string | null>(null);
  isLogoDragOver = signal(false);

  private logoDragCounter = 0;

  readonly activityTypes = ACTIVITY_TYPES;

  readonly selectedActivity = computed(() =>
    this.activityTypes.find(a => a.id === this.selectedActivityId()) ?? this.activityTypes[0]
  );

  readonly isArabic = computed(() => this.languageService.currentLang() === 'ar');

  readonly prevIcon = computed(() =>
    this.languageService.currentLang() === 'ar' ? 'pi pi-arrow-right' : 'pi pi-arrow-left'
  );

  readonly submitIcon = computed(() =>
    this.languageService.currentLang() === 'ar' ? 'pi pi-arrow-left' : 'pi pi-arrow-right'
  );

  readonly prevIconPos = computed<'left' | 'right'>(() =>
    this.languageService.currentLang() === 'ar' ? 'right' : 'left'
  );

  readonly submitIconPos = computed<'left' | 'right'>(() =>
    this.languageService.currentLang() === 'ar' ? 'left' : 'right'
  );

  readonly countries: SelectOption[] = [
    { label: 'مصر', value: 'EG' },
    { label: 'السعودية', value: 'SA' },
    { label: 'الإمارات', value: 'AE' },
    { label: 'الكويت', value: 'KW' },
    { label: 'قطر', value: 'QA' },
    { label: 'البحرين', value: 'BH' },
    { label: 'عُمان', value: 'OM' },
    { label: 'الأردن', value: 'JO' },
  ];

  readonly citiesByCountry: Record<string, SelectOption[]> = {
    EG: [
      { label: 'القاهرة', value: 'cairo' },
      { label: 'الإسكندرية', value: 'alexandria' },
      { label: 'الجيزة', value: 'giza' },
      { label: 'شرم الشيخ', value: 'sharm' },
    ],
    SA: [
      { label: 'الرياض', value: 'riyadh' },
      { label: 'جدة', value: 'jeddah' },
      { label: 'الدمام', value: 'dammam' },
    ],
    AE: [
      { label: 'دبي', value: 'dubai' },
      { label: 'أبوظبي', value: 'abu_dhabi' },
      { label: 'الشارقة', value: 'sharjah' },
    ],
    KW: [{ label: 'الكويت', value: 'kuwait_city' }],
    QA: [{ label: 'الدوحة', value: 'doha' }],
    BH: [{ label: 'المنامة', value: 'manama' }],
    OM: [{ label: 'مسقط', value: 'muscat' }],
    JO: [{ label: 'عمّان', value: 'amman' }],
  };

  readonly currencies: SelectOption[] = [
    { label: 'جنيه مصري (EGP)', value: 'EGP' },
    { label: 'ريال سعودي (SAR)', value: 'SAR' },
    { label: 'درهم إماراتي (AED)', value: 'AED' },
    { label: 'دولار أمريكي (USD)', value: 'USD' },
  ];

  cities = signal<SelectOption[]>(this.citiesByCountry['EG']);

  ngOnInit(): void {
    this.form = this.fb.group({
      businessName: ['', [Validators.required, Validators.minLength(2)]],
      country: ['EG', Validators.required],
      city: ['cairo', Validators.required],
      currency: ['EGP', Validators.required],
    });

    this.form.get('country')?.valueChanges.subscribe(country => {
      const cities = this.citiesByCountry[country] ?? [];
      this.cities.set(cities);
      if (cities.length) {
        this.form.patchValue({ city: cities[0].value });
      }
    });
  }

  selectActivity(id: ActivityTypeId): void {
    this.selectedActivityId.set(id);
  }

  isActivitySelected(activity: ActivityType): boolean {
    return this.selectedActivityId() === activity.id;
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.setLogoFile(file);
    }
  }

  onLogoDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.logoDragCounter++;
    this.isLogoDragOver.set(true);
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.logoDragCounter--;
    if (this.logoDragCounter <= 0) {
      this.logoDragCounter = 0;
      this.isLogoDragOver.set(false);
    }
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.logoDragCounter = 0;
    this.isLogoDragOver.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.setLogoFile(file);
    }
  }

  onRemoveLogo(): void {
    this.logoPreview.set(null);
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

    if (entrySource === 'login' || this.authService.isAuthenticated()) {
      this.authService.logout();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    // TODO: integrate with backend API when available
    this.authService.markOnboardingComplete(this.selectedActivityId());
    this.router.navigate(['/dashboard']);
  }

  private setLogoFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this.logoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }
}
