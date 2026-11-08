import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds, queryE2eDatabase } from './e2e-fixtures';
import { catalogItem, confirmQuotedSale, expectCode } from './us-13-15-helpers';
import { worksheetXml } from './workbook-reader';

test('US-24 report and export include the branch installment once', async ({ request }) => {
  const headers = await authenticate(request);
  const params = `branchId=${e2eIds.revenueBranch}&pageSize=100`;
  const response = await request.get(`${apiBaseUrl}/revenue/report?${params}`, { headers });
  expect(response.ok(), await response.text()).toBeTruthy();
  const report = await response.json();
  const installmentId = 'INS-e2e70000-0000-4000-8000-000000000235';
  expect(
    report.items.filter((row: { transactionId: string }) => row.transactionId === installmentId)
  ).toHaveLength(1);
  expect(
    report.items.find((row: { transactionId: string }) => row.transactionId === installmentId)
  ).toMatchObject({
    kind: 'Installment',
    amount: 500,
    status: 'Paid',
  });
  const paid = report.items.filter((row: { status: string }) => row.status === 'Paid');
  expect(report.totals.grossCollections).toBe(
    paid.reduce((sum: number, row: { amount: number }) => sum + row.amount, 0)
  );
  expect(report.totals.netCollected).toBe(report.totals.grossCollections - report.totals.refunds);
  expect(report.total).toBe(report.items.length);

  const exportResponse = await request.get(
    `${apiBaseUrl}/revenue/report/export?branchId=${e2eIds.revenueBranch}`,
    { headers }
  );
  expect(exportResponse.ok(), await exportResponse.text()).toBeTruthy();
  expect(exportResponse.headers()['content-type']).toContain('spreadsheetml.sheet');
  const worksheet = worksheetXml(await exportResponse.body());
  expect(worksheet.match(/<row\b/g)).toHaveLength(report.total + 4);
  for (const row of report.items) {
    expect(worksheet).toContain(row.transactionId);
  }
  const numericCell = (row: number) => {
    const cell = worksheet.match(new RegExp(`<c r="I${row}"[^>]*>(.*?)</c>`));
    expect(cell, `amount in row ${row}`).not.toBeNull();
    expect(cell![0]).not.toContain('t="inlineStr"');
    return Number(cell![1].match(/<v>(.*?)<\/v>/)?.[1]);
  };
  expect(numericCell(report.total + 3)).toBe(report.totals.grossCollections);
  expect(numericCell(report.total + 4)).toBe(report.totals.refunds);
  expect(numericCell(report.total + 5)).toBe(report.totals.netCollected);

  const allIds: string[] = [];
  for (let page = 1; page <= Math.ceil(report.total / 2); page++) {
    const response = await request.get(
      `${apiBaseUrl}/revenue/report?branchId=${e2eIds.revenueBranch}&pageSize=2&page=${page}`,
      { headers }
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const paged = await response.json();
    expect(paged.total).toBe(report.total);
    expect(paged.totals).toEqual(report.totals);
    allIds.push(...paged.items.map((row: { transactionId: string }) => row.transactionId));
  }
  expect(new Set(allIds).size).toBe(report.total);
  expect(allIds).toEqual(report.items.map((row: { transactionId: string }) => row.transactionId));

  const otherHeaders = await authenticate(request, e2eAccount.tenantBPhone);
  const otherTenant = await request.get(`${apiBaseUrl}/revenue/report?${params}`, {
    headers: otherHeaders,
  });
  expect(otherTenant.status()).toBe(403);
});

test('US-24 keeps a submitted payment out of revenue until an authorized review', async ({
  request,
}) => {
  const headers = await authenticate(request);
  const staff = await authenticate(request, e2eAccount.staffPhone);
  const otherTenant = await authenticate(request, e2eAccount.tenantBPhone);
  const { sale } = await confirmQuotedSale(request, headers, {
    key: 'e2e-us24-review-sale',
    customerId: e2eIds.customer,
    offerId: e2eIds.cashServiceOffer,
    disposition: 'Later',
  });
  const reportUrl = `${apiBaseUrl}/revenue/report?branchId=${e2eIds.branch}&serviceId=${e2eIds.cashServiceOffer}&pageSize=100`;
  const beforeResponse = await request.get(reportUrl, { headers });
  expect(beforeResponse.ok(), await beforeResponse.text()).toBeTruthy();
  const before = await beforeResponse.json();
  for (const idempotencyKey of ['', 'x'.repeat(101)]) {
    const invalid = await request.post(`${apiBaseUrl}/revenue/payments/review`, {
      headers,
      multipart: { saleId: sale.saleId, idempotencyKey },
    });
    await expectCode(invalid, 400, 'SaleIdempotencyKeyInvalid');
  }
  const submitted = await request.post(`${apiBaseUrl}/revenue/payments/review`, {
    headers,
    multipart: { saleId: sale.saleId, idempotencyKey: 'e2e-us24-review-attempt' },
  });
  expect(submitted.ok(), await submitted.text()).toBeTruthy();
  const payment = await submitted.json();
  expect(payment.status).toBe('UnderReview');
  const pendingResponse = await request.get(reportUrl, { headers });
  expect(pendingResponse.ok(), await pendingResponse.text()).toBeTruthy();
  const pending = await pendingResponse.json();
  expect(pending.items).toContainEqual(
    expect.objectContaining({
      paymentId: payment.paymentId,
      status: 'UnderReview',
      hasProof: false,
      amount: 300,
    })
  );
  expect(pending.totals.grossCollections).toBe(before.totals.grossCollections);
  const confirmUrl = `${apiBaseUrl}/revenue/payments/${payment.paymentId}/confirm`;
  expect((await request.post(confirmUrl, { headers: staff })).status()).toBe(403);
  expect((await request.post(confirmUrl, { headers: otherTenant })).status()).toBe(404);
  const [confirmed, retry] = await Promise.all([
    request.post(confirmUrl, { headers }),
    request.post(confirmUrl, { headers }),
  ]);
  expect(confirmed.ok(), await confirmed.text()).toBeTruthy();
  expect(retry.ok(), await retry.text()).toBeTruthy();
  expect(await confirmed.json()).toMatchObject({ paymentId: payment.paymentId, status: 'Paid' });
  expect(await retry.json()).toMatchObject({ paymentId: payment.paymentId, status: 'Paid' });
  const afterResponse = await request.get(reportUrl, { headers });
  expect(afterResponse.ok(), await afterResponse.text()).toBeTruthy();
  const after = await afterResponse.json();
  expect(after.totals.grossCollections).toBe(before.totals.grossCollections + 300);
  expect(
    queryE2eDatabase(`SELECT CONCAT(
    (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}' AND Confirmed = 1), '|',
    (SELECT COUNT(*) FROM dbo.AuditLogs WHERE EntityId = '${payment.paymentId}' AND Action = 'RevenuePaymentConfirmed'));`)
  ).toBe('1|1');
});

test('US-24 protects transfer proof and keeps it pending until confirmation', async ({
  request,
}) => {
  const headers = await authenticate(request);
  const staff = await authenticate(request, e2eAccount.staffPhone);
  const other = await authenticate(request, e2eAccount.tenantBPhone);
  const settingsUrl = `${apiBaseUrl}/settings/payment-methods`;
  const settingsResponse = await request.get(settingsUrl, { headers });
  expect(settingsResponse.ok(), await settingsResponse.text()).toBeTruthy();
  const originalSettings = await settingsResponse.json();
  try {
    const enabled = await request.put(settingsUrl, {
      headers,
      data: { ...originalSettings, bankTransferEnabled: true },
    });
    expect(enabled.ok(), await enabled.text()).toBeTruthy();
    const draft = {
      customerId: e2eIds.customer,
      branchId: e2eIds.branch,
      items: [catalogItem(e2eIds.cashServiceOffer)],
    };
    const quoteResponse = await request.post(`${apiBaseUrl}/sales/quote`, { headers, data: draft });
    expect(quoteResponse.ok(), await quoteResponse.text()).toBeTruthy();
    const quote = await quoteResponse.json();
    const saleResponse = await request.post(`${apiBaseUrl}/sales/confirm`, {
      headers,
      data: {
        ...draft,
        paymentMethod: 'bank_transfer',
        expectedGrandTotal: quote.grandTotal,
        expectedDueNow: quote.dueNow,
        idempotencyKey: 'e2e-us24-proof-sale',
        disposition: 'Later',
      },
    });
    expect(saleResponse.ok(), await saleResponse.text()).toBeTruthy();
    const sale = await saleResponse.json();
    const reportUrl = `${apiBaseUrl}/revenue/report?branchId=${e2eIds.branch}&serviceId=${e2eIds.cashServiceOffer}&pageSize=100`;
    const before = await request.get(reportUrl, { headers });
    expect(before.ok(), await before.text()).toBeTruthy();
    const beforeReport = await before.json();
    const proof = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const submit = await request.post(`${apiBaseUrl}/revenue/payments/review`, {
      headers,
      multipart: {
        saleId: sale.saleId,
        idempotencyKey: 'e2e-us24-proof-submission',
        proof: { name: 'evidence.png', mimeType: 'image/png', buffer: proof },
      },
    });
    expect(submit.ok(), await submit.text()).toBeTruthy();
    const payment = await submit.json();
    const pending = await request.get(reportUrl, { headers });
    expect(pending.ok(), await pending.text()).toBeTruthy();
    const report = await pending.json();
    expect(report.totals.grossCollections).toBe(beforeReport.totals.grossCollections);
    expect(report.items).toContainEqual(
      expect.objectContaining({
        paymentId: payment.paymentId,
        status: 'UnderReview',
        hasProof: true,
      })
    );
    const proofUrl = `${apiBaseUrl}/revenue/payments/${payment.paymentId}/proof`;
    const retrieved = await request.get(proofUrl, { headers });
    expect(retrieved.ok(), await retrieved.text()).toBeTruthy();
    expect(retrieved.headers()['content-type']).toContain('image/png');
    expect(await retrieved.body()).toEqual(proof);
    expect((await request.get(proofUrl, { headers: staff })).status()).toBe(403);
    expect((await request.get(proofUrl, { headers: other })).status()).toBe(404);
    const confirm = await request.post(
      `${apiBaseUrl}/revenue/payments/${payment.paymentId}/confirm`,
      { headers }
    );
    expect(confirm.ok(), await confirm.text()).toBeTruthy();
    expect(await confirm.json()).toMatchObject({ status: 'Paid' });
  } finally {
    const restored = await request.put(settingsUrl, { headers, data: originalSettings });
    expect(restored.ok(), await restored.text()).toBeTruthy();
  }
});
