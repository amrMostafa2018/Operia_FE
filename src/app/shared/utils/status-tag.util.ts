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
