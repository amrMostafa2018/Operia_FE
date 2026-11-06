import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds } from './e2e-fixtures';

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
  expect((await exportResponse.body()).length).toBeGreaterThan(1000);

  const otherHeaders = await authenticate(request, e2eAccount.tenantBPhone);
  const otherTenant = await request.get(`${apiBaseUrl}/revenue/report?${params}`, {
    headers: otherHeaders,
  });
  expect(otherTenant.status()).toBe(403);
});
