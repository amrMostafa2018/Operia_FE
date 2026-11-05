import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds, queryE2eDatabase } from './e2e-fixtures';

test.describe('US-18: customer operations grid', () => {
  test('updates the filtered grid through a real collection and exports the same filter', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const query = 'mobile=01000000180&page=1&pageSize=10';
    const before = await request.get(`${apiBaseUrl}/customers/operations?${query}`, { headers });
    expect(before.ok(), await before.text()).toBeTruthy();
    expect(await before.json()).toMatchObject({
      totalCount: 2,
      totalSales: 2300,
      totalCollected: 500,
      totalRemaining: 1800,
      rows: expect.arrayContaining([
        expect.objectContaining({
          saleId: e2eIds.gridBaselineSale,
          id: e2eIds.gridBaselinePurchase,
          mobile: '01000000180',
          total: 2000,
          collected: 500,
          remaining: 1500,
          paymentStatus: 'partial',
          installmentDueStatus: 'due',
        }),
        expect.objectContaining({
          saleId: e2eIds.gridMutationSale,
          collected: 0,
          remaining: 300,
          paymentStatus: 'unpaid',
        }),
      ]),
    });

    const collection = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: {
        saleId: e2eIds.gridMutationSale,
        idempotencyKey: 'e2e-us18-grid-collection',
        paymentConfirmed: true,
      },
    });
    expect(collection.ok(), await collection.text()).toBeTruthy();

    const after = await request.get(`${apiBaseUrl}/customers/operations?${query}`, { headers });
    expect(after.ok(), await after.text()).toBeTruthy();
    const grid = await after.json();
    expect(grid).toMatchObject({
      totalCount: 2,
      totalSales: 2300,
      totalCollected: 800,
      totalRemaining: 1500,
    });
    expect(grid.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          saleId: e2eIds.gridMutationSale,
          collected: 300,
          remaining: 0,
          paymentStatus: 'fullyPaid',
        }),
      ])
    );
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.SaleCollections
          WHERE SaleId = '${e2eIds.gridMutationSale}' AND Confirmed = 1), '|',
        (SELECT COUNT(*) FROM dbo.CustomerPackages
          WHERE SaleId = '${e2eIds.gridMutationSale}' AND AmountDue = 0))`)
    ).toBe('1|1');

    const exported = await request.get(
      `${apiBaseUrl}/customers/operations/export?mobile=01000000180`,
      { headers }
    );
    expect(exported.ok(), await exported.text()).toBeTruthy();
    expect(exported.headers()['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(exported.headers()['content-disposition']).toContain('customer-operations.xlsx');
    const workbook = await exported.body();
    expect(workbook.subarray(0, 2).toString()).toBe('PK');
    expect(workbook.length).toBeGreaterThan(1000);
  });

  test('keeps each reserved tenant on its own operations ledger', async ({ request }) => {
    const tenantAHeaders = await authenticate(request);
    const tenantBHeaders = await authenticate(request, e2eAccount.tenantBPhone);
    const service = encodeURIComponent('E2E US-18 Tenant B Package');

    const hidden = await request.get(`${apiBaseUrl}/customers/operations?service=${service}`, {
      headers: tenantAHeaders,
    });
    expect(hidden.ok(), await hidden.text()).toBeTruthy();
    expect(await hidden.json()).toMatchObject({ totalCount: 0, rows: [] });

    const visible = await request.get(`${apiBaseUrl}/customers/operations?service=${service}`, {
      headers: tenantBHeaders,
    });
    expect(visible.ok(), await visible.text()).toBeTruthy();
    expect(await visible.json()).toMatchObject({
      totalCount: 1,
      totalSales: 900,
      totalCollected: 900,
      totalRemaining: 0,
      rows: [expect.objectContaining({ saleId: e2eIds.tenantBGridSale })],
    });
  });
});
