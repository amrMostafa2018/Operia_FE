import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import {
  apiBaseUrl,
  authenticate,
  e2eAccount,
  e2eIds,
  performUiLogin,
  queryE2eDatabase,
} from './e2e-fixtures';

function worksheetXml(workbook: Buffer): string {
  const eocd = workbook.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Excel workbook has no ZIP directory');
  let offset = workbook.readUInt32LE(eocd + 16);
  const entries = workbook.readUInt16LE(eocd + 10);
  for (let index = 0; index < entries; index++) {
    if (workbook.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const method = workbook.readUInt16LE(offset + 10);
    const size = workbook.readUInt32LE(offset + 20);
    const nameLength = workbook.readUInt16LE(offset + 28);
    const extraLength = workbook.readUInt16LE(offset + 30);
    const commentLength = workbook.readUInt16LE(offset + 32);
    const name = workbook.subarray(offset + 46, offset + 46 + nameLength).toString();
    if (name === 'xl/worksheets/sheet1.xml') {
      const local = workbook.readUInt32LE(offset + 42);
      const start =
        local + 30 + workbook.readUInt16LE(local + 26) + workbook.readUInt16LE(local + 28);
      const data = workbook.subarray(start, start + size);
      if (method === 0) return data.toString();
      if (method === 8) return inflateRawSync(data).toString();
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('Excel worksheet is missing');
}

test.describe('US-18: customer operations grid', () => {
  test('filters the displayed grid and downloads the matching Excel export', async ({ page }) => {
    await performUiLogin(page);
    await page.goto('/customers');
    const grid = page.locator('.customer-operations');
    await grid.getByPlaceholder('Mobile').fill('01000000180');
    const search = page.waitForResponse(
      response =>
        response.url().includes('/customers/operations?') &&
        new URL(response.url()).searchParams.get('mobile') === '01000000180'
    );
    await grid.locator('.filter-actions .primary').click();
    expect((await search).ok()).toBeTruthy();
    await expect(grid.locator('tbody tr')).toHaveCount(2);
    await expect(grid.locator('tbody .mobile')).toHaveText(['01000000180', '01000000180']);
    const download = page.waitForEvent('download');
    const exported = page.waitForResponse(
      response =>
        response.url().includes('/customers/operations/export?') &&
        new URL(response.url()).searchParams.get('mobile') === '01000000180'
    );
    await grid.locator('button.export').click();
    expect((await exported).ok()).toBeTruthy();
    const file = await download;
    expect(file.suggestedFilename()).toBe('customer-operations.xlsx');
    const contents = await readFile(await file.path());
    expect(contents.subarray(0, 2).toString()).toBe('PK');
    const sheet = worksheetXml(contents);
    expect(sheet.match(/<row\b/g)).toHaveLength(3); // header plus the two displayed operations
    expect(sheet.match(/01000000180/g)).toHaveLength(2);
    expect(sheet).toContain('US-18 Grid Customer');
  });

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
