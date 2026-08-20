export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export type BillingPeriod = 'yearly' | 'monthly';

export type SubscriptionExportFormat = 'excel' | 'pdf';

export interface SubscriptionRow {
  id: string;
  planCode: string;
  planName: string;
  billingPeriod: BillingPeriod;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
}

export interface SubscriptionFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  planCode: string | null;
  status: SubscriptionStatus | null;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface TenantSubscriptionApiDto {
  id: string;
  planCode: string;
  planName: string;
  billingType: string;
  amount: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface PagedResultApiDto<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export const SUBSCRIPTION_STATUS_OPTIONS: {
  labelKey: string;
  value: SubscriptionStatus;
}[] = [
  { labelKey: 'OPERIA_SUBSCRIPTIONS.STATUS.ACTIVE', value: 'active' },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.STATUS.EXPIRED', value: 'expired' },
  { labelKey: 'OPERIA_SUBSCRIPTIONS.STATUS.CANCELLED', value: 'cancelled' },
];

export function mapSubscriptionDto(dto: TenantSubscriptionApiDto): SubscriptionRow {
  return {
    id: dto.id,
    planCode: dto.planCode,
    planName: dto.planName,
    billingPeriod: dto.billingType === 'monthly' ? 'monthly' : 'yearly',
    amount: dto.amount,
    currency: dto.currency,
    startDate: formatApiDate(dto.startDate),
    endDate: formatApiDate(dto.endDate),
    status: dto.status as SubscriptionStatus,
  };
}

function formatApiDate(value: string | null): string {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}
