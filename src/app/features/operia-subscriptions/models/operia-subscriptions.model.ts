export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export type PaymentMethod = 'bank_transfer' | 'instapay' | 'visa';

export type BillingPeriod = 'yearly' | 'monthly';

export type PlanCode = 'growth' | 'basic';

export interface SubscriptionRow {
  id: number;
  invoiceNumber: string;
  planCode: PlanCode;
  planNameKey: string;
  planDescriptionKey: string;
  billingPeriod: BillingPeriod;
  amount: number;
  paymentMethod: PaymentMethod;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
}

export const MOCK_SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: 1,
    invoiceNumber: 'SUB-250610-001',
    planCode: 'growth',
    planNameKey: 'OPERIA_SUBSCRIPTIONS.PLANS.GROWTH',
    planDescriptionKey: 'ONBOARDING.PLAN_SELECTION.PLANS.GROWTH.DESCRIPTION',
    billingPeriod: 'yearly',
    amount: 12500,
    paymentMethod: 'bank_transfer',
    startDate: '10/06/2025',
    endDate: '09/06/2026',
    status: 'active',
  },
  {
    id: 2,
    invoiceNumber: 'SUB-240610-002',
    planCode: 'basic',
    planNameKey: 'OPERIA_SUBSCRIPTIONS.PLANS.BASIC',
    planDescriptionKey: 'ONBOARDING.PLAN_SELECTION.PLANS.STARTER.DESCRIPTION',
    billingPeriod: 'yearly',
    amount: 8500,
    paymentMethod: 'instapay',
    startDate: '10/06/2024',
    endDate: '09/06/2025',
    status: 'expired',
  },
  {
    id: 3,
    invoiceNumber: 'SUB-250410-003',
    planCode: 'growth',
    planNameKey: 'OPERIA_SUBSCRIPTIONS.PLANS.GROWTH',
    planDescriptionKey: 'ONBOARDING.PLAN_SELECTION.PLANS.GROWTH.DESCRIPTION',
    billingPeriod: 'yearly',
    amount: 12500,
    paymentMethod: 'visa',
    startDate: '10/04/2025',
    endDate: '09/04/2026',
    status: 'active',
  },
  {
    id: 4,
    invoiceNumber: 'SUB-250303-004',
    planCode: 'growth',
    planNameKey: 'OPERIA_SUBSCRIPTIONS.PLANS.GROWTH',
    planDescriptionKey: 'ONBOARDING.PLAN_SELECTION.PLANS.GROWTH.DESCRIPTION',
    billingPeriod: 'yearly',
    amount: 12500,
    paymentMethod: 'bank_transfer',
    startDate: '03/03/2025',
    endDate: '02/03/2026',
    status: 'cancelled',
  },
  {
    id: 5,
    invoiceNumber: 'SUB-231210-011',
    planCode: 'basic',
    planNameKey: 'OPERIA_SUBSCRIPTIONS.PLANS.BASIC',
    planDescriptionKey: 'ONBOARDING.PLAN_SELECTION.PLANS.STARTER.DESCRIPTION',
    billingPeriod: 'yearly',
    amount: 8500,
    paymentMethod: 'visa',
    startDate: '10/12/2023',
    endDate: '09/12/2024',
    status: 'expired',
  },
];

export const SUBSCRIPTION_STATUS_OPTIONS: {
  labelKey: string;
  value: SubscriptionStatus | null;
}[] = [
  { labelKey: 'OPERIA_SUBSCRIPTIONS.ALL_STATUSES', value: null },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.STATUS.ACTIVE', value: 'active' },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.STATUS.EXPIRED', value: 'expired' },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.STATUS.CANCELLED', value: 'cancelled' },
];

export const PLAN_OPTIONS: { labelKey: string; value: PlanCode | null }[] = [
  { labelKey: 'OPERIA_SUBSCRIPTIONS.ALL_PLANS', value: null },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.PLANS.GROWTH', value: 'growth' },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.PLANS.BASIC', value: 'basic' },
];

export const PAYMENT_METHOD_OPTIONS: {
  labelKey: string;
  value: PaymentMethod | null;
}[] = [
  { labelKey: 'OPERIA_SUBSCRIPTIONS.ALL_PAYMENT_METHODS', value: null },
  {
    labelKey: 'OPERIA_SUBSCRIPTIONS.PAYMENT_METHODS.BANK_TRANSFER',
    value: 'bank_transfer',
  },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.PAYMENT_METHODS.INSTAPAY', value: 'instapay' },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.PAYMENT_METHODS.VISA', value: 'visa' },
];
