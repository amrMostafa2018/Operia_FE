import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds, queryE2eDatabase } from './e2e-fixtures';
import { catalogItem, confirmQuotedSale, expectCode } from './us-13-15-helpers';

test.describe('US-12–US-18 authorization and financial concurrency', () => {
  test('denies anonymous and staff access to protected financial operations', async ({
    request,
  }) => {
    const staff = await authenticate(request, e2eAccount.staffPhone);
    for (const path of [
      '/sales/catalog',
      '/customers/operations',
      '/customers/operations/export',
    ]) {
      const anonymous = await request.get(`${apiBaseUrl}${path}`);
      expect(anonymous.status(), `anonymous ${path}`).toBe(401);
      const forbidden = await request.get(`${apiBaseUrl}${path}`, { headers: staff });
      expect(forbidden.status(), `staff ${path}`).toBe(403);
    }
    for (const path of [
      '/sales/quote',
      '/sales/confirm',
      '/sales/collect',
      '/sales/book',
      '/bookings',
    ]) {
      const anonymous = await request.post(`${apiBaseUrl}${path}`, { data: {} });
      expect(anonymous.status(), `anonymous ${path}`).toBe(401);
      const forbidden = await request.post(`${apiBaseUrl}${path}`, { headers: staff, data: {} });
      expect(forbidden.status(), `staff ${path}`).toBe(403);
    }
  });

  test('does not reveal or collect another tenant’s sale', async ({ request }) => {
    const owner = await authenticate(request);
    const otherTenant = await authenticate(request, e2eAccount.tenantBPhone);
    const { sale } = await confirmQuotedSale(request, owner, {
      key: 'e2e-us12-18-cross-tenant',
      customerId: e2eIds.customer,
      offerId: e2eIds.cashServiceOffer,
    });
    const read = await request.get(`${apiBaseUrl}/sales/${sale.saleId}`, { headers: otherTenant });
    expect(read.status()).toBe(404);
    const collect = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers: otherTenant,
      data: { saleId: sale.saleId, idempotencyKey: 'foreign-collection', paymentConfirmed: true },
    });
    expect(collect.status()).toBe(404);
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}';`)
    ).toBe('0');
  });

  test('deduplicates concurrent sale confirmations and refuses a changed retry', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const draft = {
      customerId: e2eIds.customer,
      branchId: e2eIds.branch,
      items: [catalogItem(e2eIds.cashServiceOffer)],
    };
    const quote = await request.post(`${apiBaseUrl}/sales/quote`, { headers, data: draft });
    expect(quote.ok(), await quote.text()).toBeTruthy();
    const priced = await quote.json();
    const data = {
      ...draft,
      paymentMethod: 'cash',
      expectedGrandTotal: priced.grandTotal,
      expectedDueNow: priced.dueNow,
      idempotencyKey: 'e2e-us12-18-concurrent-confirmation',
      disposition: 'Later',
    };
    const [first, second] = await Promise.all([
      request.post(`${apiBaseUrl}/sales/confirm`, { headers, data }),
      request.post(`${apiBaseUrl}/sales/confirm`, { headers, data }),
    ]);
    expect(first.ok(), await first.text()).toBeTruthy();
    expect(second.ok(), await second.text()).toBeTruthy();
    const sale = await first.json();
    expect((await second.json()).saleId).toBe(sale.saleId);
    const changed = await request.post(`${apiBaseUrl}/sales/confirm`, {
      headers,
      data: { ...data, disposition: 'Close' },
    });
    await expectCode(changed, 409, 'SaleIdempotencyConflict');
    expect(
      queryE2eDatabase(`SELECT CONCAT(
      (SELECT COUNT(*) FROM dbo.Sales WHERE TenantId = '${e2eIds.tenantA}' AND IdempotencyKey = '${data.idempotencyKey}'), '|',
      (SELECT COUNT(*) FROM dbo.AuditLogs WHERE EntityId = '${sale.saleId}' AND Action = 'SaleConfirmed'), '|',
      (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}'));`)
    ).toBe('1|1|0');
  });

  test('serializes concurrent payment attempts and rejects an inconsistent retry', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const { sale } = await confirmQuotedSale(request, headers, {
      key: 'e2e-us12-18-concurrent-sale',
      customerId: e2eIds.customer,
      offerId: e2eIds.cashServiceOffer,
      disposition: 'Close',
    });
    const collect = (key: string) =>
      request.post(`${apiBaseUrl}/sales/collect`, {
        headers,
        data: { saleId: sale.saleId, idempotencyKey: key, paymentConfirmed: true },
      });
    const [first, second] = await Promise.all([collect('race-first'), collect('race-second')]);
    expect(first.ok(), await first.text()).toBeTruthy();
    expect(second.ok(), await second.text()).toBeTruthy();
    const firstResult = await first.json();
    const secondResult = await second.json();
    expect(firstResult.collectionId).toBe(secondResult.collectionId);
    expect(firstResult.amountCollected).toBe(300);
    expect(
      queryE2eDatabase(`SELECT CONCAT(
      (SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}' AND Confirmed = 1), '|',
      (SELECT COUNT(*) FROM dbo.CustomerPackages WHERE SaleId = '${sale.saleId}'), '|',
      (SELECT COUNT(*) FROM dbo.AuditLogs WHERE EntityId = '${sale.saleId}' AND Action = 'SalePaymentConfirmed'));`)
    ).toBe('1|1|1');

    const savedKey = queryE2eDatabase(
      `SELECT IdempotencyKey FROM dbo.SaleCollections WHERE Id = '${firstResult.collectionId}';`
    );
    const inconsistent = await request.post(`${apiBaseUrl}/sales/collect`, {
      headers,
      data: { saleId: sale.saleId, idempotencyKey: savedKey, paymentConfirmed: false },
    });
    await expectCode(inconsistent, 409, 'SaleCollectionAttemptConflict');
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.SaleCollections WHERE SaleId = '${sale.saleId}';`)
    ).toBe('1');
  });

  test('validates unlisted service boundaries and never persists invalid drafts', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const unlisted = {
      ...catalogItem(e2eIds.cashServiceOffer),
      offerId: null,
      unlistedName: 'Boundary Service',
      unlistedPrice: 0,
      unlistedDurationMinutes: 1,
    };
    const query = (items: unknown[]) =>
      request.post(`${apiBaseUrl}/sales/quote`, {
        headers,
        data: { customerId: e2eIds.customer, branchId: e2eIds.branch, items },
      });
    const valid = await query([unlisted]);
    expect(valid.ok(), await valid.text()).toBeTruthy();
    expect(await valid.json()).toMatchObject({ grandTotal: 0, dueNow: 0 });
    for (const [items, code] of [
      [[], 'SaleItemsRequired'],
      [[{ ...unlisted, quantity: 0 }], 'SaleQuantityInvalid'],
      [[{ ...unlisted, quantity: 101 }], 'SaleQuantityInvalid'],
      [[{ ...unlisted, unlistedName: '' }], 'SaleUnlistedNameInvalid'],
      [[{ ...unlisted, unlistedName: 'a'.repeat(201) }], 'SaleUnlistedNameInvalid'],
      [[{ ...unlisted, unlistedPrice: null }], 'SaleUnlistedPriceInvalid'],
      [[{ ...unlisted, unlistedPrice: -1 }], 'SaleUnlistedPriceInvalid'],
      [[{ ...unlisted, unlistedDurationMinutes: null }], 'SaleUnlistedDurationInvalid'],
      [[{ ...unlisted, unlistedDurationMinutes: 0 }], 'SaleUnlistedDurationInvalid'],
      [[{ ...unlisted, unlistedDurationMinutes: 1441 }], 'SaleUnlistedDurationInvalid'],
      [[unlisted, { ...unlisted, unlistedName: 'Second Service' }], 'SaleUnlistedLimit'],
    ] as [unknown[], string][]) {
      await expectCode(await query(items), 400, code);
      const confirmation = await request.post(`${apiBaseUrl}/sales/confirm`, {
        headers,
        data: {
          customerId: e2eIds.customer,
          branchId: e2eIds.branch,
          items,
          paymentMethod: null,
          expectedGrandTotal: 0,
          expectedDueNow: 0,
          idempotencyKey: 'invalid-boundary',
          disposition: 'Later',
        },
      });
      await expectCode(confirmation, 400, code);
    }
    for (const key of ['', 'x'.repeat(101)]) {
      const confirmation = await request.post(`${apiBaseUrl}/sales/confirm`, {
        headers,
        data: {
          customerId: e2eIds.customer,
          branchId: e2eIds.branch,
          items: [unlisted],
          paymentMethod: null,
          expectedGrandTotal: 0,
          expectedDueNow: 0,
          idempotencyKey: key,
          disposition: 'Later',
        },
      });
      await expectCode(confirmation, 400, 'SaleIdempotencyKeyInvalid');
      const response = await request.post(`${apiBaseUrl}/sales/collect`, {
        headers,
        data: { saleId: e2eIds.pendingSuccessSale, idempotencyKey: key, paymentConfirmed: true },
      });
      await expectCode(response, 400, 'SaleIdempotencyKeyInvalid');
    }
    expect(
      queryE2eDatabase(`SELECT CONCAT(
      (SELECT COUNT(*) FROM dbo.Packages WHERE TenantId = '${e2eIds.tenantA}' AND Name = 'Boundary Service'), '|',
      (SELECT COUNT(*) FROM dbo.Sales WHERE TenantId = '${e2eIds.tenantA}' AND ItemsSnapshotJson LIKE '%Boundary Service%'));`)
    ).toBe('0|0');
  });

  test('applies the customer grid filters together before totals and export', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const base = await request.get(`${apiBaseUrl}/customers/operations?mobile=01000000180`, {
      headers,
    });
    expect(base.ok(), await base.text()).toBeTruthy();
    const original = (await base.json()).rows.find(
      (row: { saleId: string }) => row.saleId === e2eIds.gridBaselineSale
    );
    expect(original).toBeTruthy();
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(original.operationDate));
    const filters = new URLSearchParams({
      fromDate: localDate,
      toDate: localDate,
      customer: original.customerName,
      mobile: '01000000180',
      service: original.service,
      serviceType: original.serviceType,
      status: original.purchaseStatus,
      paymentType: original.paymentType,
    });
    const filtered = await request.get(`${apiBaseUrl}/customers/operations?${filters}`, {
      headers,
    });
    expect(filtered.ok(), await filtered.text()).toBeTruthy();
    expect(await filtered.json()).toMatchObject({
      totalCount: 1,
      totalSales: 2000,
      totalCollected: 500,
      totalRemaining: 1500,
      rows: [expect.objectContaining({ saleId: e2eIds.gridBaselineSale })],
    });
    const exportResponse = await request.get(
      `${apiBaseUrl}/customers/operations/export?${filters}`,
      { headers }
    );
    expect(exportResponse.ok(), await exportResponse.text()).toBeTruthy();
    expect((await exportResponse.body()).subarray(0, 2).toString()).toBe('PK');
    filters.set('service', 'Nonexistent cross-filter test item');
    const excluded = await request.get(`${apiBaseUrl}/customers/operations?${filters}`, {
      headers,
    });
    expect(excluded.ok(), await excluded.text()).toBeTruthy();
    expect(await excluded.json()).toMatchObject({
      totalCount: 0,
      totalSales: 0,
      totalCollected: 0,
      totalRemaining: 0,
      rows: [],
    });
  });
});
