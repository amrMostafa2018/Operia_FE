import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eIds, queryE2eDatabase } from './e2e-fixtures';
import {
  catalogItem,
  confirmQuotedSale,
  createServiceBooking,
  expectCode,
  futureDate,
} from './us-13-15-helpers';

test.describe('US-14: confirm cash or installment collection', () => {
  test('collects only the first installment from its own pending sale', async ({ request }) => {
    const headers = await authenticate(request);
    const data = {
      saleId: e2eIds.pendingSuccessSale,
      idempotencyKey: 'e2e-us14-success-collection',
      paymentConfirmed: true,
    };
    const first = await request.post(`${apiBaseUrl}/sales/collect`, { headers, data });
    expect(first.ok(), await first.text()).toBeTruthy();
    const result = await first.json();
    expect(result).toMatchObject({
      saleId: e2eIds.pendingSuccessSale,
      paymentConfirmed: true,
      amountCollected: 500,
      saleStatus: 'Closed',
    });
    const retry = await request.post(`${apiBaseUrl}/sales/collect`, { headers, data });
    expect(retry.ok()).toBeTruthy();
    await expect(retry.json()).resolves.toMatchObject({ collectionId: result.collectionId });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${e2eIds.pendingSuccessSale}' AND Confirmed = 1), '|',
        (SELECT SUM(Amount) FROM dbo.SaleCollections WHERE SaleId = '${e2eIds.pendingSuccessSale}' AND Confirmed = 1), '|',
        (SELECT COUNT(*) FROM dbo.CustomerPackages WHERE SaleId = '${e2eIds.pendingSuccessSale}' AND AmountDue = 1500), '|',
        (SELECT COUNT(*) FROM dbo.Bookings WHERE SaleId = '${e2eIds.pendingSuccessSale}'));`)
    ).toBe('1|500.00|1|0');
  });

  test('keeps a failed first payment unpaid and permits one later successful attempt', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const failedInput = {
      saleId: e2eIds.pendingFailureSale,
      idempotencyKey: 'e2e-us14-failed-collection',
      paymentConfirmed: false,
    };
    const failed = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: failedInput,
    });
    expect(failed.ok(), await failed.text()).toBeTruthy();
    expect(await failed.json()).toMatchObject({
      paymentConfirmed: false,
      amountCollected: 0,
      saleStatus: 'PendingCollection',
    });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.CustomerPackages WHERE SaleId = '${e2eIds.pendingFailureSale}'), '|',
        (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${e2eIds.pendingFailureSale}' AND Confirmed = 1));`)
    ).toBe('0|0');
    const retry = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: failedInput,
    });
    expect(retry.ok()).toBeTruthy();
    const success = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: {
        ...failedInput,
        idempotencyKey: 'e2e-us14-recovered-collection',
        paymentConfirmed: true,
      },
    });
    expect(success.ok(), await success.text()).toBeTruthy();
    expect(await success.json()).toMatchObject({ paymentConfirmed: true, amountCollected: 500 });
    expect(
      queryE2eDatabase(`SELECT CONCAT(COUNT(*), '|', SUM(CASE WHEN Confirmed = 1 THEN Amount ELSE 0 END))
        FROM dbo.SaleCollections WHERE SaleId = '${e2eIds.pendingFailureSale}';`)
    ).toBe('2|500.00');
  });

  test('leaves an API-confirmed installment sale pending and rejects service installments', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const { sale } = await confirmQuotedSale(request, headers, {
      key: 'e2e-us14-draft-only',
      customerId: e2eIds.customer,
      offerId: e2eIds.saleInstallmentOffer,
      paymentOption: 'installment',
      disposition: 'Later',
    });
    expect(sale).toMatchObject({ status: 'PendingCollection', grandTotal: 2000, dueNow: 500 });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}'), '|',
        (SELECT COUNT(*) FROM dbo.CustomerPackages WHERE SaleId = '${sale.saleId}'), '|',
        (SELECT COUNT(*) FROM dbo.Bookings WHERE SaleId = '${sale.saleId}'));`)
    ).toBe('0|0|0');
    const payment = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: {
        saleId: sale.saleId,
        idempotencyKey: 'e2e-us14-later-payment',
        paymentConfirmed: true,
      },
    });
    expect(payment.ok(), await payment.text()).toBeTruthy();
    expect(await payment.json()).toMatchObject({
      saleStatus: 'ReadyToBook',
      paymentConfirmed: true,
    });
    const state = await request.get(`${apiBaseUrl}/sales/${sale.saleId}`, { headers });
    expect(state.ok(), await state.text()).toBeTruthy();
    expect(await state.json()).toMatchObject({ disposition: 'Later', bookingId: null });
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Bookings WHERE SaleId = '${sale.saleId}';`)
    ).toBe('0');
    const invalid = await request.post(`${apiBaseUrl}/sales/quote`, {
      headers,
      data: {
        customerId: e2eIds.customer,
        branchId: e2eIds.branch,
        items: [catalogItem(e2eIds.directServiceOffer, 'installment')],
      },
    });
    await expectCode(invalid, 409, 'SalePaymentOptionUnavailable');
  });

  test('retains collection and returns recovery when Book Now loses its slot', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const date = futureDate(21);
    const occupied = await createServiceBooking(request, headers, {
      key: 'e2e-us14-occupied-slot',
      customerId: e2eIds.customer,
      date,
      startMinutes: 600,
    });
    expect(occupied.ok(), await occupied.text()).toBeTruthy();
    const { sale } = await confirmQuotedSale(request, headers, {
      key: 'e2e-us14-book-now',
      customerId: e2eIds.customer,
      offerId: e2eIds.cashServiceOffer,
      disposition: 'BookNow',
    });
    const collect = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: {
        saleId: sale.saleId,
        idempotencyKey: 'e2e-us14-book-now-payment',
        paymentConfirmed: true,
      },
    });
    expect(collect.ok(), await collect.text()).toBeTruthy();
    const booking = await request.post(`${apiBaseUrl}/sales/book`, {
      headers,
      data: {
        saleId: sale.saleId,
        employeeId: e2eIds.staffEmployee,
        scheduledDate: date,
        startMinutes: 600,
        endMinutes: 645,
      },
    });
    expect(booking.ok(), await booking.text()).toBeTruthy();
    expect(await booking.json()).toMatchObject({
      status: 'BookingPending',
      bookingId: null,
      recoveryCode: 'BookingSlotUnavailable',
    });
    const saved = await request.get(`${apiBaseUrl}/sales/${sale.saleId}`, { headers });
    expect(saved.ok()).toBeTruthy();
    expect(await saved.json()).toMatchObject({ paymentConfirmed: true, bookingId: null });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}' AND Confirmed = 1), '|',
        (SELECT COUNT(*) FROM dbo.Bookings WHERE SaleId = '${sale.saleId}'));`)
    ).toBe('1|0');
  });
});
