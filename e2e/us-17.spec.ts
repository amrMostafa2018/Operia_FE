import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiBaseUrl, authenticate, e2eIds, queryE2eDatabase } from './e2e-fixtures';
import { confirmQuotedSale, expectCode, futureDate } from './us-13-15-helpers';

test.describe('US-17: collect payment before confirming a booking', () => {
  test('recovers a lost collection response without a duplicate payment or booking', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const { sale } = await confirmQuotedSale(request, headers, {
      key: 'e2e-us17-unknown-sale',
      customerId: e2eIds.customer,
      offerId: e2eIds.cashServiceOffer,
      disposition: 'BookNow',
    });
    const bookingInput = {
      saleId: sale.saleId,
      employeeId: e2eIds.staffEmployee,
      scheduledDate: futureDate(207),
      startMinutes: 600,
      endMinutes: 645,
    };
    const beforePayment = await request.post(`${apiBaseUrl}/sales/book`, {
      headers,
      data: bookingInput,
    });
    await expectCode(beforePayment, 409, 'SaleBookingUnavailable');

    const paymentInput = {
      saleId: sale.saleId,
      idempotencyKey: 'e2e-us17-unknown-collection',
      paymentConfirmed: true,
    };
    // Forward the payment, then drop the client connection after the server replies.
    const proxy = createServer(async (incoming, outgoing) => {
      try {
        const body: Buffer[] = [];
        for await (const chunk of incoming) body.push(Buffer.from(chunk));
        await fetch(`${apiBaseUrl}/sales/collect`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: Buffer.concat(body),
        });
        outgoing.destroy();
      } catch (error) {
        outgoing.destroy(error as Error);
      }
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    try {
      const port = (proxy.address() as AddressInfo).port;
      await expect(
        request.post(`http://127.0.0.1:${port}/collect`, {
          headers,
          data: paymentInput,
          maxRetries: 0,
        })
      ).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve, reject) =>
        proxy.close(error => (error ? reject(error) : resolve()))
      );
    }
    // The client has an unknown result; recover from server state before retrying.
    const recovered = await request.get(`${apiBaseUrl}/sales/${sale.saleId}`, { headers });
    expect(recovered.ok(), await recovered.text()).toBeTruthy();
    expect(await recovered.json()).toMatchObject({ paymentConfirmed: true, bookingId: null });

    const retry = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: paymentInput,
    });
    expect(retry.ok(), await retry.text()).toBeTruthy();
    expect(await retry.json()).toMatchObject({ paymentConfirmed: true });
    const booked = await request.post(`${apiBaseUrl}/sales/book`, { headers, data: bookingInput });
    expect(booked.ok(), await booked.text()).toBeTruthy();
    const booking = await booked.json();
    expect(booking.status).toBe('Booked');
    const bookingRetry = await request.post(`${apiBaseUrl}/sales/book`, {
      headers,
      data: bookingInput,
    });
    expect(bookingRetry.ok(), await bookingRetry.text()).toBeTruthy();
    expect(await bookingRetry.json()).toMatchObject({ bookingId: booking.bookingId });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}' AND Confirmed = 1), '|',
        (SELECT COUNT(*) FROM dbo.Bookings WHERE SaleId = '${sale.saleId}'));`)
    ).toBe('1|1');
  });

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
