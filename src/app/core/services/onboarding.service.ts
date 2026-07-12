import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, shareReplay, tap } from 'rxjs';

import { environment } from '@env/environment';
import { AuthStore } from '@core/store/auth.store';
import { OnboardingStateService } from '@core/services/onboarding-state.service';
import {
  ActivityTypeId,
} from '@app/features/onboarding/models/activity-type.model';
import {
  AddBalancePlatformRequest,
  AddBalancePlatformResultDto,
  BusinessType,
  CompleteOnboardingRequest,
  normalizeOnboardingStatus,
  OnboardingResultDto,
  OnboardingStatusDto,
  SetupBusinessRequest,
  SetupBusinessResultDto,
  SubscriptionPlanDto,
} from '@app/features/onboarding/models/onboarding.model';

const BUSINESS_TYPE_TO_ACTIVITY: Record<BusinessType, ActivityTypeId> = {
  [BusinessType.LaserClinic]: 'laser_clinic',
  [BusinessType.AppointmentClinic]: 'appointment_clinic',
  [BusinessType.Salon]: 'salon',
};

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly onboardingState = inject(OnboardingStateService);
  private readonly baseUrl = `${environment.apiUrl}/onboarding`;

  private statusCache$: Observable<OnboardingStatusDto> | null = null;

  getStatus(): Observable<OnboardingStatusDto> {
    if (!this.statusCache$) {
      this.statusCache$ = this.http.get<OnboardingStatusDto>(`${this.baseUrl}/status`).pipe(
        map(status => normalizeOnboardingStatus(status)),
        tap(status => {
          this.syncBusinessSetupFromStatus(status);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.statusCache$;
  }

  getPlans(): Observable<SubscriptionPlanDto[]> {
    return this.http.get<SubscriptionPlanDto[]>(`${this.baseUrl}/plans`);
  }

  setupBusiness(request: SetupBusinessRequest): Observable<SetupBusinessResultDto> {
    const form = new FormData();
    form.append('businessName', request.businessName);
    form.append('businessType', String(request.businessType));
    form.append('countryCode', request.countryCode);
    form.append('city', request.city);
    form.append('currencyCode', request.currencyCode);

    if (request.logoFile) {
      form.append('logo', request.logoFile);
    }

    return this.http.post<SetupBusinessResultDto>(`${this.baseUrl}/setup-business`, form).pipe(
      tap(() => this.invalidateStatus()),
    );
  }

  complete(request: CompleteOnboardingRequest): Observable<OnboardingResultDto> {
    return this.http.post<OnboardingResultDto>(`${this.baseUrl}/complete`, request).pipe(
      tap(() => this.invalidateStatus()),
    );
  }

  activateSubscription(subscriptionId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/activate`, { subscriptionId }).pipe(
      tap(() => this.invalidateStatus()),
    );
  }

  addBalancePlatform(request: AddBalancePlatformRequest): Observable<AddBalancePlatformResultDto> {
    const form = new FormData();
    form.append('amount', String(request.amount));
    form.append('screenshot', request.screenshotFile);

    return this.http.post<AddBalancePlatformResultDto>(`${this.baseUrl}/add-balance-platform`, form).pipe(
      tap(() => this.invalidateStatus()),
    );
  }

  invalidateStatus(): void {
    this.statusCache$ = null;
  }

  private syncBusinessSetupFromStatus(status: OnboardingStatusDto): void {
    const businessName = status.business?.businessName;

    if (businessName) {
      const user = this.authStore.currentUser();
      if (user && user.businessName !== businessName) {
        this.authStore.setUser({ ...user, businessName });
      }
    }

    if (this.onboardingState.businessSetup() || !status.business) {
      return;
    }

    this.onboardingState.setBusinessSetup({
      activityTypeId: BUSINESS_TYPE_TO_ACTIVITY[status.business.businessType] ?? 'laser_clinic',
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
