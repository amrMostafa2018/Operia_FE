import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds, queryE2eDatabase } from './e2e-fixtures';
import { createServiceBooking, expectCode, futureDate } from './us-13-15-helpers';

test.describe('US-21: paid refund and center block', () => {
  test('caps two real refunds, cancels the reserved appointment, and audits once', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const actionUrl = `${apiBaseUrl}/customers/${e2eIds.refundCustomer}/purchases/${e2eIds.refundPurchase}/action`;
    const before = await request.get(actionUrl, { headers });
    expect(before.ok(), await before.text()).toBeTruthy();
    expect(await before.json()).toMatchObject({
      paid: 5000,
      refunded: 0,
      remainingRefundable: 5000,
      purchaseStatus: 'active',
    });

    const endpoint = `${apiBaseUrl}/customers/purchases/${e2eIds.refundPurchase}/cancel-refund`;
    const initiallyExcess = await request.post(endpoint, {
      headers,
      data: { amount: 5001, idempotencyKey: 'e2e-us21-initial-excess' },
    });
    await expectCode(initiallyExcess, 409, 'CustomerRefundExceedsPaid');
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.RefundTransactions
      WHERE CustomerPackageId = '${e2eIds.refundPurchase}';`)
    ).toBe('0');
    const firstRequest = {
      amount: 1500,
      idempotencyKey: 'e2e-us21-first-refund',
      note: 'E2E partial refund',
    };
    const first = await request.post(endpoint, { headers, data: firstRequest });
    expect(first.ok(), await first.text()).toBeTruthy();
    const firstResult = await first.json();
    expect(firstResult).toMatchObject({
      amount: 1500,
      totalRefunded: 1500,
      remainingRefundable: 3500,
      purchaseStatus: 'cancelled',
    });
    const history = await request.get(
      `${apiBaseUrl}/customers/${e2eIds.refundCustomer}/purchases/${e2eIds.refundPurchase}/history`,
      { headers }
    );
    expect(history.ok(), await history.text()).toBeTruthy();
    const entry = (await history.json()).items.find(
      (item: { action: string; referenceId: string }) =>
        item.action === 'RefundPosted' && item.referenceId === firstResult.refundId
    );
    expect(entry).toMatchObject({ amount: 1500, reason: 'E2E partial refund' });
    expect(entry.actor).toBeTruthy();
    expect(Number.isNaN(Date.parse(entry.atUtc))).toBeFalsy();

    const repeated = await request.post(endpoint, { headers, data: firstRequest });
    expect(repeated.ok(), await repeated.text()).toBeTruthy();
    expect((await repeated.json()).refundId).toBe(firstResult.refundId);

    const excess = await request.post(endpoint, {
      headers,
      data: { amount: 3501, idempotencyKey: 'e2e-us21-excess-refund' },
    });
    await expectCode(excess, 409, 'CustomerRefundExceedsPaid');

    const second = await request.post(endpoint, {
      headers,
      data: { amount: 3500, idempotencyKey: 'e2e-us21-final-refund' },
    });
    expect(second.ok(), await second.text()).toBeTruthy();
    expect(await second.json()).toMatchObject({
      totalRefunded: 5000,
      remainingRefundable: 0,
    });
    const after = await request.get(actionUrl, { headers });
    expect(await after.json()).toMatchObject({
      paid: 5000,
      refunded: 5000,
      remainingRefundable: 0,
      purchaseStatus: 'cancelled',
    });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.RefundTransactions
          WHERE TenantId = '${e2eIds.tenantA}' AND CustomerPackageId = '${e2eIds.refundPurchase}'), '|',
        (SELECT SUM(Amount) FROM dbo.RefundTransactions
          WHERE TenantId = '${e2eIds.tenantA}' AND CustomerPackageId = '${e2eIds.refundPurchase}'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
          WHERE TenantId = '${e2eIds.tenantA}' AND Action = 'RefundPosted'
          AND EntityId IN (SELECT Id FROM dbo.RefundTransactions
            WHERE CustomerPackageId = '${e2eIds.refundPurchase}')), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
          WHERE TenantId = '${e2eIds.tenantA}' AND Action = 'PurchaseCancelled'
          AND EntityId = '${e2eIds.refundPurchase}'), '|',
        (SELECT COUNT(*) FROM dbo.Bookings
          WHERE Id = '${e2eIds.refundBooking}' AND Status = 3), '|',
        (SELECT COUNT(*) FROM dbo.BookingPackageReservations
          WHERE BookingId = '${e2eIds.refundBooking}' AND CancellationAtUtc IS NOT NULL))`)
    ).toBe('2|5000.00|2|1|1|1');

    const otherTenant = await authenticate(request, e2eAccount.tenantBPhone);
    const hidden = await request.post(endpoint, {
      headers: otherTenant,
      data: { amount: 1, idempotencyKey: 'e2e-us21-cross-tenant' },
    });
    expect(hidden.status()).toBe(404);
  });

  test('blocks and unblocks distinct customers through the API and records both states', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const blockUrl = `${apiBaseUrl}/customers/${e2eIds.blockCustomer}/block`;
    const blockAction = await request.get(
      `${apiBaseUrl}/customers/${e2eIds.blockCustomer}/sales/${e2eIds.blockSale}/action`,
      { headers }
    );
    expect(blockAction.ok(), await blockAction.text()).toBeTruthy();
    const blockVersion = (await blockAction.json()).customerVersion;
    const blocked = await request.put(blockUrl, {
      headers,
      data: { isBlocked: true, reason: 'E2E center restriction', version: blockVersion },
    });
    expect(blocked.ok(), await blocked.text()).toBeTruthy();
    expect(await blocked.json()).toMatchObject({
      isBlocked: true,
      reason: 'E2E center restriction',
    });
    const blockedBooking = await createServiceBooking(request, headers, {
      key: 'e2e-us21-blocked-booking',
      customerId: e2eIds.blockCustomer,
      date: futureDate(210),
      startMinutes: 600,
    });
    await expectCode(blockedBooking, 409, 'CustomerBlocked');
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Bookings
      WHERE TenantId = '${e2eIds.tenantA}' AND IdempotencyKey = 'e2e-us21-blocked-booking';`)
    ).toBe('0');
    const tenantB = await authenticate(request, e2eAccount.tenantBPhone);
    const otherCenterCustomer = await request.post(`${apiBaseUrl}/customers/registration`, {
      headers: tenantB,
      data: { fullName: 'US-21 Other Center Customer', mobileNumber: '01000000210' },
    });
    expect(otherCenterCustomer.status(), await otherCenterCustomer.text()).toBe(201);
    const otherCustomer = await otherCenterCustomer.json();
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT CAST(IsBlocked AS int) FROM dbo.Customers WHERE Id = '${e2eIds.blockCustomer}'), '|',
        (SELECT CAST(IsBlocked AS int) FROM dbo.Customers WHERE Id = '${otherCustomer.id}'));`)
    ).toBe('1|0');

    const unblockAction = await request.get(
      `${apiBaseUrl}/customers/${e2eIds.unblockCustomer}/sales/${e2eIds.unblockSale}/action`,
      { headers }
    );
    expect(unblockAction.ok(), await unblockAction.text()).toBeTruthy();
    expect(await unblockAction.json()).toMatchObject({
      isBlocked: true,
      blockReason: 'Existing center restriction',
    });
    const unblocked = await request.put(`${apiBaseUrl}/customers/${e2eIds.unblockCustomer}/block`, {
      headers,
      data: {
        isBlocked: false,
        reason: null,
        version: (await unblockAction.json()).customerVersion,
      },
    });
    expect(unblocked.ok(), await unblocked.text()).toBeTruthy();
    expect(await unblocked.json()).toMatchObject({ isBlocked: false, reason: null });

    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.AuditLogs WHERE TenantId = '${e2eIds.tenantA}'
          AND EntityId = '${e2eIds.blockCustomer}' AND Action = 'CustomerBlocked'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs WHERE TenantId = '${e2eIds.tenantA}'
          AND EntityId = '${e2eIds.unblockCustomer}' AND Action = 'CustomerUnblocked'))`)
    ).toBe('1|1');
  });
});
