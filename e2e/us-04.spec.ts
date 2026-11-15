import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds } from './e2e-fixtures';
import { confirmQuotedSale } from './us-13-15-helpers';

test.describe('US-04: dashboard payment review counter and confirm flow', () => {
  test('pendingReviewCount tracks submit, confirm, and cancel paths', async ({ request }) => {
    const headers = await authenticate(request);
    const summaryUrl = `${apiBaseUrl}/dashboard/summary`;

    const beforeRes = await request.get(summaryUrl, { headers });
    expect(beforeRes.ok(), await beforeRes.text()).toBeTruthy();
    const before = await beforeRes.json();
    const beforePending = before.pendingReviewCount ?? 0;
    const beforeRevenue = before.todayRevenue as number;

    const { sale } = await confirmQuotedSale(request, headers, {
      key: 'e2e-us04-review-sale',
      customerId: e2eIds.customer,
      offerId: e2eIds.cashServiceOffer,
      disposition: 'Later',
    });

    const submitted = await request.post(`${apiBaseUrl}/revenue/payments/review`, {
      headers,
      multipart: { saleId: sale.saleId, idempotencyKey: 'e2e-us04-review-submit' },
    });
    expect(submitted.ok(), await submitted.text()).toBeTruthy();
    const payment = await submitted.json();

    const pendingSummary = await (
      await request.get(summaryUrl, { headers })
    ).json();
    expect(pendingSummary.pendingReviewCount).toBe(beforePending + 1);

    const reportRes = await request.get(
      `${apiBaseUrl}/revenue/report?status=UnderReview&pageSize=50`,
      { headers }
    );
    expect(reportRes.ok()).toBeTruthy();
    const report = await reportRes.json();
    const pendingRow = report.items.find(
      (row: { paymentId: string }) => row.paymentId === payment.paymentId
    );
    expect(pendingRow).toBeTruthy();
    expect(report.total).toBeGreaterThanOrEqual(pendingSummary.pendingReviewCount);
    const collectedAmount = pendingRow.amount as number;

    const confirmUrl = `${apiBaseUrl}/revenue/payments/${payment.paymentId}/confirm`;
    expect((await request.post(confirmUrl, { headers })).ok()).toBeTruthy();

    const afterConfirm = await (await request.get(summaryUrl, { headers })).json();
    expect(afterConfirm.pendingReviewCount).toBe(beforePending);
    expect(afterConfirm.todayRevenue).toBe(beforeRevenue + collectedAmount);

    const { sale: cancelSale } = await confirmQuotedSale(request, headers, {
      key: 'e2e-us04-cancel-sale',
      customerId: e2eIds.customer,
      offerId: e2eIds.cashServiceOffer,
      disposition: 'Later',
    });
    const cancelSubmit = await request.post(`${apiBaseUrl}/revenue/payments/review`, {
      headers,
      multipart: { saleId: cancelSale.saleId, idempotencyKey: 'e2e-us04-cancel-submit' },
    });
    expect(cancelSubmit.ok()).toBeTruthy();
    const cancelPayment = await cancelSubmit.json();
    const midSummary = await (await request.get(summaryUrl, { headers })).json();
    expect(midSummary.pendingReviewCount).toBe(beforePending + 1);

    await request.post(
      `${apiBaseUrl}/revenue/payments/${cancelPayment.paymentId}/cancel`,
      { headers }
    );
    const afterCancel = await (await request.get(summaryUrl, { headers })).json();
    expect(afterCancel.pendingReviewCount).toBe(beforePending);
    expect(afterCancel.todayRevenue).toBe(afterConfirm.todayRevenue);

    const refundRows = await request.get(
      `${apiBaseUrl}/revenue/report?search=${encodeURIComponent(cancelPayment.paymentId)}`,
      { headers }
    );
    expect(refundRows.ok()).toBeTruthy();
    const refundReport = await refundRows.json();
    expect(
      refundReport.items.some((row: { kind: string }) => row.kind === 'Refund')
    ).toBe(false);
  });

  test('staff without review permission cannot confirm pending payment', async ({ request }) => {
    const headers = await authenticate(request);
    const staff = await authenticate(request, e2eAccount.staffPhone);
    const { sale } = await confirmQuotedSale(request, headers, {
      key: 'e2e-us04-staff-sale',
      customerId: e2eIds.customer,
      offerId: e2eIds.cashServiceOffer,
      disposition: 'Later',
    });
    const submitted = await request.post(`${apiBaseUrl}/revenue/payments/review`, {
      headers,
      multipart: { saleId: sale.saleId, idempotencyKey: 'e2e-us04-staff-block' },
    });
    expect(submitted.ok()).toBeTruthy();
    const payment = await submitted.json();
    expect((await request.post(
      `${apiBaseUrl}/revenue/payments/${payment.paymentId}/confirm`,
      { headers: staff }
    )).status()).toBe(403);
  });
});