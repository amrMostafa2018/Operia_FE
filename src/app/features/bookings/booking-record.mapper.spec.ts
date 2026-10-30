import { CalendarBookingDto } from './appointments-api.service';
import { mapCalendarBooking } from './booking-record.mapper';
import {
  bookingLineDisplaysPrice,
  isBookingDetailsCatalogPurchaseLine,
} from './models/booking.model';

describe('mapCalendarBooking owned package pricing', () => {
  const baseBooking: CalendarBookingDto = {
    id: 'booking-1',
    bookingNumber: 'OP-1',
    status: 'Completed',
    customerId: 'customer-1',
    customerName: 'Customer 1',
    customerMobile: '01000000000',
    employeeId: 'employee-1',
    employeeName: 'Staff',
    branchId: 'branch-1',
    branchName: 'Branch',
    scheduledDate: '2026-09-23',
    startMinutes: 570,
    endMinutes: 600,
    source: 'control_panel',
    paymentMethod: 'cash',
    totalAmount: 0,
    paidAmount: 0,
    discountAmount: 0,
    createdAt: '2026-09-24T08:02:00Z',
    version: 'version-1',
    items: [],
  };

  it('does not treat a zero-price unlinked owned package as a new purchase', () => {
    const booking = mapCalendarBooking({
      ...baseBooking,
      items: [
        {
          id: 'item-1',
          name: '10 Sessions Offer',
          type: 'package',
          quantity: 1,
          durationMinutes: 30,
          unitPrice: 0,
          packageId: 'package-10',
          customerPackageId: 'owned-package-10',
          packageRemainingSessions: 2,
          packagePulseCount: null,
          packageTotal: 10,
          packageUsed: 8,
          packageSessionLinked: true,
        },
      ],
    });

    const line = booking.lineItems[0];
    expect(line.newPurchaseUnits).toBe(0);
    expect(isBookingDetailsCatalogPurchaseLine(line)).toBeFalse();
    expect(bookingLineDisplaysPrice(line)).toBeFalse();
  });

  it('keeps billed catalog purchases when unit price is greater than zero', () => {
    const booking = mapCalendarBooking({
      ...baseBooking,
      totalAmount: 5000,
      items: [
        {
          id: 'item-1',
          name: '10 Sessions Offer',
          type: 'package',
          quantity: 1,
          durationMinutes: 30,
          unitPrice: 5000,
          packageId: 'package-10',
          customerPackageId: null,
          packageRemainingSessions: null,
          packagePulseCount: null,
          packageTotal: null,
          packageUsed: null,
          packageSessionLinked: false,
        },
      ],
    });

    const line = booking.lineItems[0];
    expect(line.newPurchaseUnits).toBe(1);
    expect(isBookingDetailsCatalogPurchaseLine(line)).toBeTrue();
    expect(bookingLineDisplaysPrice(line)).toBeTrue();
  });
});
