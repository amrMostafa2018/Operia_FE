import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eIds, queryE2eDatabase } from './e2e-fixtures';
import { expectCode, futureDate } from './us-13-15-helpers';

test.describe('US-17: collect payment before confirming a booking', () => {
  test('collects the success scenario and creates the booking through the sale API', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const collection = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: {
        saleId: e2eIds.bookingCollectionSuccessSale,
        idempotencyKey: 'e2e-us17-success-collection',
        paymentConfirmed: true,
      },
    });
    expect(collection.ok(), await collection.text()).toBeTruthy();
    expect(await collection.json()).toMatchObject({
      saleStatus: 'ReadyToBook',
      paymentConfirmed: true,
      amountCollected: 300,
    });

    const booking = await request.post(`${apiBaseUrl}/sales/book`, {
      headers,
      data: {
        saleId: e2eIds.bookingCollectionSuccessSale,
        employeeId: e2eIds.staffEmployee,
        scheduledDate: futureDate(205),
        startMinutes: 600,
        endMinutes: 645,
      },
    });
    expect(booking.ok(), await booking.text()).toBeTruthy();
    expect(await booking.json()).toMatchObject({ status: 'Booked' });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections
          WHERE SaleId = '${e2eIds.bookingCollectionSuccessSale}' AND Confirmed = 1), '|',
        (SELECT COUNT(*) FROM dbo.Bookings
          WHERE SaleId = '${e2eIds.bookingCollectionSuccessSale}'), '|',
        (SELECT COUNT(*) FROM dbo.CustomerPackages
          WHERE SaleId = '${e2eIds.bookingCollectionSuccessSale}'))`)
    ).toBe('1|1|1');
  });

  test('records the failure scenario without creating a paid booking', async ({ request }) => {
    const headers = await authenticate(request);
    const collection = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: {
        saleId: e2eIds.bookingCollectionFailureSale,
        idempotencyKey: 'e2e-us17-failed-collection',
        paymentConfirmed: false,
      },
    });
    expect(collection.ok(), await collection.text()).toBeTruthy();
    expect(await collection.json()).toMatchObject({
      saleStatus: 'PendingCollection',
      paymentConfirmed: false,
      amountCollected: 0,
    });

    const booking = await request.post(`${apiBaseUrl}/sales/book`, {
      headers,
      data: {
        saleId: e2eIds.bookingCollectionFailureSale,
        employeeId: e2eIds.staffEmployee,
        scheduledDate: futureDate(205),
        startMinutes: 660,
        endMinutes: 705,
      },
    });
    await expectCode(booking, 409, 'SaleBookingUnavailable');
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections
          WHERE SaleId = '${e2eIds.bookingCollectionFailureSale}' AND Confirmed = 0), '|',
        (SELECT COUNT(*) FROM dbo.CustomerPackages
          WHERE SaleId = '${e2eIds.bookingCollectionFailureSale}'), '|',
        (SELECT COUNT(*) FROM dbo.Bookings
          WHERE SaleId = '${e2eIds.bookingCollectionFailureSale}'))`)
    ).toBe('1|0|0');
  });

  test('books an owned session for zero new charge without performing it', async ({ request }) => {
    const headers = await authenticate(request);
    const booking = await request.post(`${apiBaseUrl}/bookings`, {
      headers,
      data: {
        idempotencyKey: 'e2e-us17-owned-session',
        customerId: e2eIds.customer,
        branchId: e2eIds.branch,
        employeeId: e2eIds.staffEmployee,
        scheduledDate: futureDate(206),
        startMinutes: 540,
        endMinutes: 580,
        items: [
          {
            packageId: e2eIds.ownedSessionOffer,
            customerPackageId: e2eIds.ownedSessionPurchase,
            quantity: 1,
          },
        ],
        paymentMethod: null,
      },
    });
    expect(booking.status(), await booking.text()).toBe(201);
    const saved = await booking.json();
    expect(saved.status).toBe('Booked');
    expect(
      queryE2eDatabase(`SELECT CONCAT(b.TotalAmount, '|', b.PaidAmount, '|', p.Used, '|',
        p.ReservedSessions, '|', COUNT(r.Id))
        FROM dbo.Bookings b
        JOIN dbo.CustomerPackages p ON p.Id = '${e2eIds.ownedSessionPurchase}'
        LEFT JOIN dbo.BookingPackageReservations r ON r.BookingId = b.Id
        WHERE b.Id = '${saved.id}'
        GROUP BY b.TotalAmount, b.PaidAmount, p.Used, p.ReservedSessions;`)
    ).toBe('0.00|0.00|1|1|1');
  });
});
