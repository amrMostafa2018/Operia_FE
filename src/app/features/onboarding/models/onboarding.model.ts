import { ActivityTypeId } from '@app/features/onboarding/models/activity-type.model';

export enum OnboardingStep {
  Setup = 1,
  Plan = 2,
  Pending = 3,
  Active = 4,
}

export enum BusinessType {
  LaserClinic = 1,
  AppointmentClinic = 2,
  Salon = 3,
}

export enum BillingType {
  Monthly = 1,
  Yearly = 2,
}

export interface BusinessSummaryDto {
  businessName: string;
  businessType: BusinessType;
  countryCode: string;
  city: string;
  currencyCode: string;
}

export interface OnboardingStatusDto {
  step: OnboardingStep;
  tenantId: string | null;
  businessId: string | null;
  subscriptionId: string | null;
  business: BusinessSummaryDto | null;
  usableBalance: number;
  totalBalance: number;
  subscriptionAmount: number | null;
  pendingAddBalancePlatform: PendingAddBalancePlatformDto | null;
}

export interface PendingAddBalancePlatformDto {
  id: string;
  amount: number;
  screenShotUrl: string;
}

export interface AddBalancePlatformRequest {
  amount: number;
  screenShotUrl: string;
}

export interface AddBalancePlatformResultDto {
  revenueId: string;
  amount: number;
}

export interface SubscriptionPlanDto {
  planId: string;
  name: string;
  code: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  features: string[];
  isActive: boolean;
}

export interface SetupBusinessRequest {
  businessName: string;
  businessType: BusinessType;
  countryCode: string;
  city: string;
  currencyCode: string;
  logoUrl?: string | null;
}

export interface SetupBusinessResultDto {
  tenantId: string;
  businessId: string;
}

export interface CompleteOnboardingRequest {
  planId: string;
  billingType: BillingType;
  screenShotUrl: string;
}

export interface OnboardingResultDto {
  tenantId: string;
  businessId: string;
  subscriptionId: string;
  status: string;
}

export interface BusinessSetupState {
  activityTypeId: ActivityTypeId;
  businessName: string;
  country: string;
  city: string;
  currency: string;
  logoUrl: string | null;
  tenantId?: string;
  businessId?: string;
}

export const ACTIVITY_TO_BUSINESS_TYPE: Record<ActivityTypeId, BusinessType> = {
  laser_clinic: BusinessType.LaserClinic,
  appointment_clinic: BusinessType.AppointmentClinic,
  salon: BusinessType.Salon,
  other: BusinessType.LaserClinic,
};

export const ONBOARDING_ROUTES: Record<OnboardingStep, string> = {
  [OnboardingStep.Setup]: '/onboarding/setup',
  [OnboardingStep.Plan]: '/onboarding/plan',
  [OnboardingStep.Pending]: '/onboarding/plan',
  [OnboardingStep.Active]: '/dashboard',
};

export function onboardingRouteForStep(step: OnboardingStep): string {
  return ONBOARDING_ROUTES[step] ?? '/onboarding/setup';
}

type OnboardingStatusApi = OnboardingStatusDto & {
  balance?: number;
  UsableBalance?: number;
  TotalBalance?: number;
  pendingBalanceTopUp?: PendingAddBalancePlatformDto | null;
  PendingAddBalancePlatform?: PendingAddBalancePlatformDto | null;
  PendingBalanceTopUp?: PendingAddBalancePlatformDto | null;
};

export function normalizeOnboardingStatus(status: OnboardingStatusApi): OnboardingStatusDto {
  const usableBalance =
    status.usableBalance ?? status.UsableBalance ?? status.balance ?? 0;
  const totalBalance =
    status.totalBalance ?? status.TotalBalance ?? usableBalance;
  const pendingAddBalancePlatform =
    status.pendingAddBalancePlatform
    ?? status.PendingAddBalancePlatform
    ?? status.pendingBalanceTopUp
    ?? status.PendingBalanceTopUp
    ?? null;

  return {
    ...status,
    usableBalance,
    totalBalance,
    pendingAddBalancePlatform,
  };
}
