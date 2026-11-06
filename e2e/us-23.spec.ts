import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds, queryE2eDatabase } from './e2e-fixtures';

test.describe('US-23: tenant-timezone, branch-scoped collected revenue', () => {
  test('counts confirmed movements and applies real payment and refund actions once', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const summaryUrl = `${apiBaseUrl}/revenue/summary?branchId=${e2eIds.revenueBranch}`;
    const starting = await request.get(summaryUrl, { headers });
    expect(starting.ok(), await starting.text()).toBeTruthy();
    const baseline = await starting.json();
    const localDay = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        day: 'numeric',
      }).format(new Date())
    );
    expect(baseline.month).toMatchObject({
      transactionCount: 4,
      grossCollected: 6950,
      refunds: 0,
      netCollected: 6950,
    });
    expect(baseline.today).toMatchObject({
      transactionCount: localDay === 1 ? 4 : 2,
      grossCollected: localDay === 1 ? 6950 : 5250,
      refunds: 0,
      netCollected: localDay === 1 ? 6950 : 5250,
    });
    const dashboardBefore = await request.get(`${apiBaseUrl}/dashboard/revenue`, {
      headers,
    });
    expect(dashboardBefore.ok(), await dashboardBefore.text()).toBeTruthy();
    const dashboardBaseline = await dashboardBefore.json();

    const payment = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: {
        saleId: e2eIds.revenuePaymentSale,
        idempotencyKey: 'e2e-us23-payment',
        paymentConfirmed: true,
      },
    });
    expect(payment.ok(), await payment.text()).toBeTruthy();
    expect(await payment.json()).toMatchObject({
      paymentConfirmed: true,
      amountCollected: 300,
    });
    const afterPayment = await request.get(summaryUrl, { headers });
    expect(afterPayment.ok(), await afterPayment.text()).toBeTruthy();
    const collected = await afterPayment.json();
    expect(collected.today.transactionCount).toBe(baseline.today.transactionCount + 1);
    expect(collected.today.grossCollected).toBe(baseline.today.grossCollected + 300);
    expect(collected.month.transactionCount).toBe(5);
    expect(collected.month.grossCollected).toBe(7250);

    const refund = await request.post(
      `${apiBaseUrl}/customers/purchases/${e2eIds.revenueTodayPurchase}/cancel-refund`,
      {
        headers,
        data: {
          amount: 1500,
          idempotencyKey: 'e2e-us23-revenue-refund',
          note: 'E2E revenue period',
        },
      }
    );
    expect(refund.ok(), await refund.text()).toBeTruthy();
    expect(await refund.json()).toMatchObject({
      amount: 1500,
      remainingRefundable: 3500,
    });
    const afterRefund = await request.get(summaryUrl, { headers });
    expect(afterRefund.ok(), await afterRefund.text()).toBeTruthy();
    const final = await afterRefund.json();
    expect(final.today).toMatchObject({
      transactionCount: collected.today.transactionCount,
      grossCollected: collected.today.grossCollected,
      refunds: 1500,
      netCollected: collected.today.grossCollected - 1500,
    });
    expect(final.month).toMatchObject({
      transactionCount: 5,
      grossCollected: 7250,
      refunds: 1500,
      netCollected: 5750,
    });

    const dashboardAfter = await request.get(`${apiBaseUrl}/dashboard/revenue`, {
      headers,
    });
    expect(dashboardAfter.ok(), await dashboardAfter.text()).toBeTruthy();
    expect(await dashboardAfter.json()).toMatchObject({
      today: dashboardBaseline.today - 1200,
      month: dashboardBaseline.month - 1200,
    });
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections
          WHERE SaleId = '${e2eIds.revenuePaymentSale}' AND Confirmed = 1), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
          WHERE TenantId = '${e2eIds.tenantA}' AND Action = 'SalePaymentConfirmed'
          AND EntityId = '${e2eIds.revenuePaymentSale}'), '|',
        (SELECT COUNT(*) FROM dbo.RefundTransactions
          WHERE CustomerPackageId = '${e2eIds.revenueTodayPurchase}'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
          WHERE TenantId = '${e2eIds.tenantA}' AND Action = 'RefundPosted'
          AND EntityId IN (SELECT Id FROM dbo.RefundTransactions
            WHERE CustomerPackageId = '${e2eIds.revenueTodayPurchase}')))`)
    ).toBe('1|1|1|1');
  });

  test('denies the other tenant access to the selected branch ledger', async ({ request }) => {
    const headers = await authenticate(request, e2eAccount.tenantBPhone);
    const response = await request.get(
      `${apiBaseUrl}/revenue/summary?branchId=${e2eIds.revenueBranch}`,
      { headers }
    );
    expect(response.status()).toBe(403);
  });
});
