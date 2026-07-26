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
import { take } from 'rxjs';

import { DecimalPipe } from '@angular/common';

import { Router } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';

import { LanguageService } from '@core/services/language.service';
import { AppConfigService } from '@core/services/app-config.service';
import { OnboardingService } from '@core/services/onboarding.service';
import { OnboardingStateService } from '@core/services/onboarding-state.service';

import { extractApiError } from '@core/utils/api-error.util';
import { resolveUploadUrl } from '@core/utils/resolve-upload-url';
import {
  showUploadValidationToast,
  validateUploadFile,
} from '@app/shared/utils/file-upload.util';
import { getSubmitArrowIcon, getSubmitIconPos } from '@app/shared/utils/rtl.util';

import { ACTIVITY_TYPES } from '@app/features/onboarding/models/activity-type.model';

import {
  BillingType,
  OnboardingStatusDto,
  PendingAddBalancePlatformDto,
  SubscriptionPlanDto,
} from '@app/features/onboarding/models/onboarding.model';

const PLAN_FEATURE_KEYS: Record<string, string[]> = {
  'free-trial': ['all_features', 'max_3_employees', 'max_100_bookings'],

  starter: ['1_branch', 'max_5_employees', 'unlimited_bookings'],

  growth: ['max_3_branches', 'max_20_employees', 'advanced_reports', 'unlimited_bookings'],

  pro: ['unlimited_branches', 'unlimited_employees', 'api_whatsapp', 'support_24_7'],
};

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
  private readonly appConfig = inject(AppConfigService);
  private readonly messageService = inject(MessageService);

  readonly plans = signal<SubscriptionPlanDto[]>([]);

  readonly selectedPlanId = signal<string | null>(null);

  readonly billingType = signal<BillingType>(BillingType.Monthly);
  readonly usableBalance = signal(0);
  readonly tenantId = signal<string | null>(null);
  readonly subscriptionId = signal<string | null>(null);
  readonly subscriptionAmount = signal<number | null>(null);
  readonly pendingAddBalancePlatform = signal<PendingAddBalancePlatformDto | null>(null);
  readonly addBalancePlatformAmount = signal<number | null>(null);
  readonly addBalancePlatformScreenshot = signal<string | null>(null);
  readonly screenshotFile = signal<File | null>(null);
  readonly isSubmittingTopUp = signal(false);
  readonly topUpSubmitError = signal<string | null>(null);
  readonly topUpSubmitSuccess = signal<string | null>(null);
  readonly isActivating = signal(false);
  readonly isLoading = signal(true);

  readonly isSubmitting = signal(false);

  readonly submitError = signal<string | null>(null);

  readonly billingTypeEnum = BillingType;
  readonly acceptedImageAccept = this.appConfig.allowedMimeTypesAccept;

  readonly businessSetup = computed(() => this.onboardingState.businessSetup());

  readonly selectedActivity = computed(() => {
    const setup = this.businessSetup();

    const activityId = setup?.activityTypeId ?? 'laser_clinic';

    return ACTIVITY_TYPES.find(a => a.id === activityId) ?? ACTIVITY_TYPES[0];
  });

  readonly selectedPlan = computed(
    () => this.plans().find(p => p.planId === this.selectedPlanId()) ?? null
  );

  readonly displayPrice = computed(() => {
    const plan = this.selectedPlan();

    if (!plan) return 0;

    return this.billingType() === BillingType.Monthly ? plan.monthlyPrice : plan.yearlyPrice;
  });

  readonly isFreeTrial = computed(() => this.selectedPlan()?.code === 'free-trial');

  readonly requiredPlanAmount = computed(() => this.subscriptionAmount() ?? this.displayPrice());

  readonly canUserActivateSubscription = computed(() => {
    const subscriptionId = this.subscriptionId();
    const amount = this.requiredPlanAmount();
    if (!subscriptionId) {
      return false;
    }
    return this.usableBalance() >= amount;
  });

  readonly canActivatePlan = computed(() => {
    if (!this.selectedPlanId()) {
      return false;
    }
    if (this.isFreeTrial()) {
      return true;
    }
    return this.usableBalance() >= this.displayPrice();
  });

  readonly hasInsufficientBalance = computed(() => {
    if (this.isFreeTrial() || !this.subscriptionId()) {
      return false;
    }
    return this.usableBalance() < this.requiredPlanAmount();
  });

  readonly hasPendingAddBalancePlatform = computed(() => !!this.pendingAddBalancePlatform());

  readonly resolvedPendingScreenshotUrl = computed(() => {
    const pending = this.pendingAddBalancePlatform();
    return pending ? resolveUploadUrl(pending.screenShotUrl) : null;
  });

  readonly suggestedTopUpAmount = computed(() => {
    if (!this.hasInsufficientBalance()) {
      return null;
    }
    return Math.max(this.requiredPlanAmount() - this.usableBalance(), 0);
  });

  readonly isArabic = computed(() => this.languageService.currentLang() === 'ar');

  readonly submitIcon = computed(() => getSubmitArrowIcon(this.languageService.currentLang()));

  readonly submitIconPos = computed<'left' | 'right'>(() =>
    getSubmitIconPos(this.languageService.currentLang())
  );

  readonly currencyLabel = computed(() => {
    const currency = this.businessSetup()?.currency ?? 'EGP';

    this.languageService.currentLang();

    return this.translate.instant(`ONBOARDING.BUSINESS_SETUP.CURRENCIES.${currency}`);
  });

  readonly submitLabelKey = computed(() => {
    if (this.isFreeTrial()) {
      return 'ONBOARDING.PLAN_SELECTION.START_TRIAL';
    }
    return 'ONBOARDING.PLAN_SELECTION.ACTIVATE_SYSTEM';
  });

  ngOnInit(): void {
    this.onboardingService.invalidateStatus();
    this.loadOnboardingStatus();

    this.onboardingService
      .getPlans()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  onTopUpAmountChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const amount = value === '' ? null : Number(value);
    this.addBalancePlatformAmount.set(Number.isFinite(amount) ? amount : null);
  }

  onAddBalancePlatformScreenshotSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    const validation = validateUploadFile(file, this.appConfig);
    if (!validation.valid) {
      showUploadValidationToast(this.messageService, this.translate, validation.errorKey!);
      return;
    }

    this.topUpSubmitError.set(null);
    this.screenshotFile.set(file);

    const reader = new FileReader();
    reader.onload = () => this.addBalancePlatformScreenshot.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  onRemoveAddBalancePlatformScreenshot(): void {
    this.addBalancePlatformScreenshot.set(null);
    this.screenshotFile.set(null);
    const input = document.getElementById(
      'addBalancePlatformScreenshotInput'
    ) as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  onSubmitAddBalancePlatform(): void {
    const amount = this.addBalancePlatformAmount() ?? this.suggestedTopUpAmount();
    const screenshotFile = this.screenshotFile();

    if (!amount || amount <= 0) {
      this.topUpSubmitError.set(
        this.translate.instant('ONBOARDING.PLAN_SELECTION.BALANCE_TOP_UP.INVALID_AMOUNT')
      );
      return;
    }

    if (!screenshotFile) {
      this.topUpSubmitError.set(
        this.translate.instant('ONBOARDING.PLAN_SELECTION.SCREENSHOT_REQUIRED')
      );
      return;
    }

    this.isSubmittingTopUp.set(true);
    this.topUpSubmitError.set(null);
    this.topUpSubmitSuccess.set(null);

    this.onboardingService
      .addBalancePlatform({ amount, screenshotFile })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmittingTopUp.set(false);
          this.addBalancePlatformAmount.set(null);
          this.addBalancePlatformScreenshot.set(null);
          this.screenshotFile.set(null);
          this.topUpSubmitSuccess.set(
            this.translate.instant('ONBOARDING.PLAN_SELECTION.BALANCE_TOP_UP.SUBMITTED')
          );
          this.refreshOnboardingStatus();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmittingTopUp.set(false);
          this.topUpSubmitError.set(extractApiError(err));
        },
      });
  }

  onUserActivateSubscription(): void {
    this.activateSubscription(
      err => this.submitError.set(err),
      () => this.isActivating.set(true),
      () => this.isActivating.set(false)
    );
  }

  private activateSubscription(
    onError: (message: string) => void,
    onStart: () => void,
    onEnd: () => void
  ): void {
    const subscriptionId = this.subscriptionId();

    if (!subscriptionId) {
      onError(this.translate.instant('ONBOARDING.PLAN_SELECTION.NO_SUBSCRIPTION'));
      return;
    }

    if (!this.canUserActivateSubscription()) {
      onError(this.translate.instant('ONBOARDING.PLAN_SELECTION.INSUFFICIENT_BALANCE'));
      return;
    }

    onStart();
    this.submitError.set(null);

    this.onboardingService
      .activateSubscription(subscriptionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigate(['/dashboard']).then(navigated => {
            if (!navigated) {
              onEnd();
            }
          });
        },
        error: (err: HttpErrorResponse) => {
          onEnd();
          onError(extractApiError(err));
        },
      });
  }

  private loadOnboardingStatus(): void {
    this.onboardingService
      .getStatus()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(status => this.applyOnboardingStatus(status));
  }

  private refreshOnboardingStatus(): void {
    this.onboardingService.invalidateStatus();
    this.onboardingService
      .getStatus()
      .pipe(take(1))
      .subscribe(status => this.applyOnboardingStatus(status));
  }

  private applyOnboardingStatus(status: OnboardingStatusDto): void {
    this.usableBalance.set(status.usableBalance ?? 0);
    this.tenantId.set(status.tenantId);
    this.subscriptionId.set(status.subscriptionId);
    this.subscriptionAmount.set(status.subscriptionAmount);
    this.pendingAddBalancePlatform.set(status.pendingAddBalancePlatform);

    if (!this.businessSetup() && status.business) {
      this.onboardingState.setBusinessSetup({
        activityTypeId: 'laser_clinic',
        businessName: status.business.businessName,
        country: status.business.countryCode,
        city: status.business.city,
        currency: status.business.currencyCode,
        logoUrl: null,
        tenantId: status.tenantId ?? undefined,
        businessId: status.businessId ?? undefined,
      });
    }
  }

  onSubmit(): void {
    if (!this.canActivatePlan()) {
      return;
    }

    if (this.canUserActivateSubscription()) {
      this.onUserActivateSubscription();
      return;
    }

    const planId = this.selectedPlanId();

    if (!planId) {
      return;
    }

    this.isSubmitting.set(true);

    this.submitError.set(null);

    this.onboardingService
      .complete({
        planId,

        billingType: this.billingType(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.subscriptionId.set(result.subscriptionId);
          this.subscriptionAmount.set(this.displayPrice());
          this.refreshOnboardingStatus();

          if (this.usableBalance() >= this.displayPrice()) {
            this.onUserActivateSubscription();
            return;
          }

          this.isSubmitting.set(false);
        },

        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);

          this.submitError.set(extractApiError(err));
        },
      });
  }

  planPrice(plan: SubscriptionPlanDto): number {
    return this.billingType() === BillingType.Monthly ? plan.monthlyPrice : plan.yearlyPrice;
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

  billingPeriodLabel(): string {
    return this.billingType() === BillingType.Monthly
      ? 'ONBOARDING.PLAN_SELECTION.PER_MONTH'
      : 'ONBOARDING.PLAN_SELECTION.PER_YEAR';
  }

  private planCodeKey(code: string): string {
    return code.replace(/-/g, '_').toUpperCase();
  }
}
