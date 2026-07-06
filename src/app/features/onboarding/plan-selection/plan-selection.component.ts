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

import { DecimalPipe } from '@angular/common';

import { Router } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';



import { ButtonModule } from 'primeng/button';



import { LanguageService } from '@core/services/language.service';

import { OnboardingService } from '@core/services/onboarding.service';

import { OnboardingStateService } from '@core/services/onboarding-state.service';

import { extractApiError } from '@core/utils/api-error.util';

import { getSubmitArrowIcon } from '@app/shared/utils/rtl.util';

import { ACTIVITY_TYPES } from '@app/features/onboarding/models/activity-type.model';

import {

  BillingType,

  SubscriptionPlanDto,

} from '@app/features/onboarding/models/onboarding.model';



const PLAN_FEATURE_KEYS: Record<string, string[]> = {

  'free-trial': ['all_features', 'max_3_employees', 'max_100_bookings'],

  starter: ['1_branch', 'max_5_employees', 'unlimited_bookings'],

  growth: ['max_3_branches', 'max_20_employees', 'advanced_reports', 'unlimited_bookings'],

  pro: ['unlimited_branches', 'unlimited_employees', 'api_whatsapp', 'support_24_7'],
};

const PAYMENT_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

@Component({

  selector: 'app-plan-selection',

  standalone: true,

  imports: [ButtonModule, TranslatePipe, DecimalPipe],

  templateUrl: './plan-selection.component.html',

  styleUrl: './plan-selection.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,

})

export class PlanSelectionComponent implements OnInit {

  private readonly router = inject(Router);

  private readonly onboardingService = inject(OnboardingService);

  private readonly onboardingState = inject(OnboardingStateService);

  private readonly languageService = inject(LanguageService);

  private readonly translate = inject(TranslateService);

  private readonly destroyRef = inject(DestroyRef);



  readonly plans = signal<SubscriptionPlanDto[]>([]);

  readonly selectedPlanId = signal<string | null>(null);

  readonly billingType = signal<BillingType>(BillingType.Monthly);

  readonly screenShotPreview = signal<string | null>(null);

  readonly isLoading = signal(true);

  readonly isSubmitting = signal(false);

  readonly submitError = signal<string | null>(null);



  readonly billingTypeEnum = BillingType;

  readonly promoBenefitKeys = [

    'ONBOARDING.PLAN_SELECTION.PROMO_BENEFIT_1',

    'ONBOARDING.PLAN_SELECTION.PROMO_BENEFIT_2',

    'ONBOARDING.PLAN_SELECTION.PROMO_BENEFIT_3',

    'ONBOARDING.PLAN_SELECTION.PROMO_BENEFIT_4',

  ];



  readonly businessSetup = computed(() => this.onboardingState.businessSetup());



  readonly selectedActivity = computed(() => {

    const setup = this.businessSetup();

    const activityId = setup?.activityTypeId ?? 'laser_clinic';

    return ACTIVITY_TYPES.find(a => a.id === activityId) ?? ACTIVITY_TYPES[0];

  });



  readonly selectedPlan = computed(() =>

    this.plans().find(p => p.planId === this.selectedPlanId()) ?? null

  );



  readonly displayPrice = computed(() => {

    const plan = this.selectedPlan();

    if (!plan) return 0;

    return this.billingType() === BillingType.Monthly

      ? plan.monthlyPrice

      : plan.yearlyPrice;

  });



  readonly vatAmount = computed(() => Math.round(this.displayPrice() * 0.14));



  readonly totalPrice = computed(() => this.displayPrice() + this.vatAmount());



  readonly isFreeTrial = computed(() => this.selectedPlan()?.code === 'free-trial');

  readonly isArabic = computed(() => this.languageService.currentLang() === 'ar');



  readonly prevIcon = computed(() =>

    this.languageService.currentLang() === 'ar' ? 'pi pi-arrow-right' : 'pi pi-arrow-left'

  );



  readonly submitIcon = computed(() =>

    getSubmitArrowIcon(this.languageService.currentLang())

  );



  readonly prevIconPos = computed<'left' | 'right'>(() =>

    this.languageService.currentLang() === 'ar' ? 'right' : 'left'

  );



  readonly submitIconPos = computed<'left' | 'right'>(() =>

    this.languageService.currentLang() === 'ar' ? 'left' : 'right'

  );



  readonly currencyLabel = computed(() => {

    const currency = this.businessSetup()?.currency ?? 'EGP';

    this.languageService.currentLang();

    return this.translate.instant(`ONBOARDING.BUSINESS_SETUP.CURRENCIES.${currency}`);

  });



  readonly totalLabelKey = computed(() =>

    this.billingType() === BillingType.Monthly

      ? 'ONBOARDING.PLAN_SELECTION.TOTAL_MONTHLY'

      : 'ONBOARDING.PLAN_SELECTION.TOTAL_YEARLY'

  );



  readonly submitLabelKey = computed(() =>

    this.isFreeTrial()

      ? 'ONBOARDING.PLAN_SELECTION.START_TRIAL'

      : 'ONBOARDING.PLAN_SELECTION.COMPLETE_PAYMENT'

  );



  ngOnInit(): void {

    this.onboardingService.getPlans().pipe(

      takeUntilDestroyed(this.destroyRef)

    ).subscribe({

      next: plans => {

        this.plans.set(plans);

        const growth = plans.find(p => p.code === 'growth') ?? plans[0];

        if (growth) {

          this.selectedPlanId.set(growth.planId);

        }

        this.isLoading.set(false);

      },

      error: () => this.isLoading.set(false),

    });

  }



  selectPlan(planId: string): void {

    this.selectedPlanId.set(planId);

    this.submitError.set(null);

  }



  setBillingType(type: BillingType): void {
    this.billingType.set(type);
  }

  onScreenshotSelected(event: Event): void {

    const file = (event.target as HTMLInputElement).files?.[0];

    if (!file?.type.startsWith('image/')) {

      return;

    }



    const reader = new FileReader();

    reader.onload = () => this.screenShotPreview.set(reader.result as string);

    reader.readAsDataURL(file);

  }



  onPrevious(): void {

    void this.router.navigate(['/onboarding/setup']);

  }



  onSubmit(): void {

    const planId = this.selectedPlanId();

    if (!planId) {

      return;

    }



    const screenShotUrl = this.isFreeTrial() ? PAYMENT_PLACEHOLDER : this.screenShotPreview();
    if (!screenShotUrl) {

      this.submitError.set(this.translate.instant('ONBOARDING.PLAN_SELECTION.SCREENSHOT_REQUIRED'));

      return;

    }



    this.isSubmitting.set(true);

    this.submitError.set(null);



    this.onboardingService.complete({

      planId,

      billingType: this.billingType(),

      screenShotUrl,

    }).pipe(

      takeUntilDestroyed(this.destroyRef)

    ).subscribe({

      next: () => {

        this.isSubmitting.set(false);

        void this.router.navigate(['/onboarding/pending']);

      },

      error: (err: HttpErrorResponse) => {

        this.isSubmitting.set(false);

        this.submitError.set(extractApiError(err));

      },

    });

  }



  planPrice(plan: SubscriptionPlanDto): number {

    return this.billingType() === BillingType.Monthly

      ? plan.monthlyPrice

      : plan.yearlyPrice;

  }



  isPlanSelected(plan: SubscriptionPlanDto): boolean {

    return this.selectedPlanId() === plan.planId;

  }



  planFeatureKeys(plan: SubscriptionPlanDto): string[] {

    if (plan.features.length > 0) {

      return plan.features;

    }

    return PLAN_FEATURE_KEYS[plan.code] ?? [];

  }



  planDescriptionKey(plan: SubscriptionPlanDto): string {

    return `ONBOARDING.PLAN_SELECTION.PLANS.${this.planCodeKey(plan.code)}.DESCRIPTION`;

  }



  planCtaKey(plan: SubscriptionPlanDto): string {

    if (plan.code === 'free-trial') {

      return 'ONBOARDING.PLAN_SELECTION.START_TRIAL';

    }

    if (this.isPlanSelected(plan)) {

      return this.billingType() === BillingType.Monthly

        ? 'ONBOARDING.PLAN_SELECTION.CHOOSE_MONTHLY'

        : 'ONBOARDING.PLAN_SELECTION.CHOOSE_YEARLY';

    }

    return 'ONBOARDING.PLAN_SELECTION.SELECT_PLAN';

  }



  billingPeriodLabel(): string {

    return this.billingType() === BillingType.Monthly

      ? 'ONBOARDING.PLAN_SELECTION.PER_MONTH'

      : 'ONBOARDING.PLAN_SELECTION.PER_YEAR';

  }



  private planCodeKey(code: string): string {

    return code.replace(/-/g, '_').toUpperCase();

  }

}


