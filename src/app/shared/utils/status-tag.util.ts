import { BookingStatus } from '@app/features/bookings/models/booking.model';
import { SubscriptionStatus } from '@app/features/operia-subscriptions/models/operia-subscriptions.model';

export type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast';

const BOOKING_STATUS_SEVERITY: Record<BookingStatus, TagSeverity> = {
  pending: 'warning',
  cancelled: 'danger',
  completed: 'info',
};

const BOOKING_STATUS_KEYS: Record<BookingStatus, string> = {
  pending: 'BOOKING_STATUS.PENDING',
  cancelled: 'BOOKING_STATUS.CANCELLED',
  completed: 'BOOKING_STATUS.COMPLETED',
};

const SUBSCRIPTION_STATUS_SEVERITY: Record<SubscriptionStatus, TagSeverity> = {
  active: 'success',
  expired: 'secondary',
  cancelled: 'danger',
  pending: 'warning',
};

const SUBSCRIPTION_STATUS_KEYS: Record<SubscriptionStatus, string> = {
  active: 'OPERIA_SUBSCRIPTIONS.STATUS.ACTIVE',
  expired: 'OPERIA_SUBSCRIPTIONS.STATUS.EXPIRED',
  cancelled: 'OPERIA_SUBSCRIPTIONS.STATUS.CANCELLED',
  pending: 'OPERIA_SUBSCRIPTIONS.STATUS.PENDING',
};

export function bookingStatusSeverity(status: BookingStatus): TagSeverity {
  return BOOKING_STATUS_SEVERITY[status];
}

export function bookingStatusKey(status: BookingStatus): string {
  return BOOKING_STATUS_KEYS[status];
}

export function subscriptionStatusSeverity(status: SubscriptionStatus): TagSeverity {
  return SUBSCRIPTION_STATUS_SEVERITY[status];
}

export function subscriptionStatusKey(status: SubscriptionStatus): string {
  return SUBSCRIPTION_STATUS_KEYS[status];
}

const STATUS_PILL_CLASS: Record<string, string> = {
  success: 'status-pill status-pill--success',
  warning: 'status-pill status-pill--warning',
  warn: 'status-pill status-pill--warning',
  danger: 'status-pill status-pill--danger',
  info: 'status-pill status-pill--info',
};

/** Maps a PrimeNG tag severity onto the customer-operations status pill. */
export function statusPillClass(severity: string | null | undefined): string {
  return STATUS_PILL_CLASS[severity ?? ''] ?? 'status-pill status-pill--neutral';
}

/** Maps a payment method onto the customer-operations type pill. */
export function paymentTypePillClass(method: string | null | undefined): string {
  const value = (method ?? '').trim().toLowerCase();
  if (!value) {
    return '';
  }
  if (value === 'cash') {
    return 'type-pill type-pill--cash';
  }
  if (value === 'installment') {
    return 'type-pill type-pill--installment';
  }
  if (value === 'owned') {
    return 'type-pill type-pill--owned';
  }
  if (value.includes('visa') || value.includes('card')) {
    return 'type-pill type-pill--card';
  }
  if (value === 'bank_transfer' || value === 'bank' || value === 'fawry') {
    return 'type-pill type-pill--transfer';
  }
  if (value === 'instapay' || value === 'e_wallet' || value === 'wallet') {
    return 'type-pill type-pill--wallet';
  }
  return 'type-pill type-pill--neutral';
}
