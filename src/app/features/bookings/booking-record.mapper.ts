import { CalendarBookingDto } from './appointments-api.service';
import { BookingRecord } from './models/booking.model';

/** Converts an API calendar record into the booking model used by the UI. */
export function mapCalendarBooking(record: CalendarBookingDto): BookingRecord {
  return {
    id: record.id,
    bookingNumber: record.bookingNumber,
    status: record.status.toLowerCase() as BookingRecord['status'],
    clientId: record.customerId,
    clientName: record.customerName,
    clientMobile: record.customerMobile,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    branchId: record.branchId,
    branchName: record.branchName,
    sourceKey: 'BOOKINGS.SOURCE.CONTROL_PANEL',
    scheduledDate: new Date(`${record.scheduledDate}T00:00:00`),
    startMinutes: record.startMinutes,
    slotDurationMinutes: record.endMinutes - record.startMinutes,
    lineItems: record.items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      price: item.unitPrice,
      durationMinutes: item.durationMinutes,
      packageSessionLinked: item.packageSessionLinked,
      catalogPackageId: item.packageId,
      customerPackageId: item.customerPackageId,
      packageRemainingSessions: item.packageRemainingSessions,
      packagePulseCount: item.packagePulseCount,
    })),
    paymentMethod: record.paymentMethod as BookingRecord['paymentMethod'],
    totalAmount: record.totalAmount,
    paidAmount: record.paidAmount,
    discount: record.discountAmount,
    createdAt: new Date(record.createdAt),
    version: record.version,
  };
}
