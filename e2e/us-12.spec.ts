import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import {
  apiBaseUrl,
  authenticate,
  e2eAccount,
  e2eIds,
  performUiLogin,
  queryE2eDatabase,
} from './e2e-fixtures';

type Headers = Record<string, string>;

interface DraftItem {
  offerId: string | null;
  ownedCustomerPackageId: string | null;
  unlistedName: string | null;
  unlistedPrice: number | null;
  unlistedDurationMinutes: number | null;
  paymentOption: 'cash' | 'installment' | 'owned';
  quantity: number;
}

function catalogItem(offerId: string, paymentOption: 'cash' | 'installment' = 'cash'): DraftItem {
  return {
    offerId,
    ownedCustomerPackageId: null,
    unlistedName: null,
    unlistedPrice: null,
    unlistedDurationMinutes: null,
    paymentOption,
    quantity: 1,
  };
}

function errorCodes(responseBody: { errorCodes?: Record<string, string | string[]> }): string[] {
  return Object.values(responseBody.errorCodes ?? {}).flatMap(value =>
    Array.isArray(value) ? value : [value]
  );
}

async function expectErrorCode(response: APIResponse, status: number, code: string): Promise<void> {
  expect(response.status()).toBe(status);
  expect(errorCodes(await response.json())).toContain(code);
}

async function updateOffer(
  request: APIRequestContext,
  headers: Headers,
  offerId: string,
  overrides: { name?: string; price?: number; isActive?: boolean }
): Promise<void> {
  const read = await request.get(`${apiBaseUrl}/packages/${offerId}`, { headers });
  expect(read.ok()).toBeTruthy();
  const offer = await read.json();
  const update = await request.put(`${apiBaseUrl}/packages/${offerId}`, {
    headers,
    data: {
      name: overrides.name ?? offer.name,
      isActive: overrides.isActive ?? offer.status === 'active',
      offerType: offer.offerType,
      description: offer.description,
      serviceCategoryId: offer.serviceCategoryId,
      subServiceCategoryId: offer.subServiceCategoryId,
      sessionDurationMinutes: offer.sessionDurationMinutes,
      sessionCount: offer.sessionCount,
      pulseCount: offer.pulseCount,
      packageExpiryMonths: offer.packageExpiryMonths,
      price: overrides.price ?? offer.price,
      discountCode: offer.discountCode,
      discountPercent: offer.discountPercent,
      cashEnabled: offer.cashEnabled,
      installmentEnabled: offer.installmentEnabled,
      installmentPrice: offer.installmentPrice,
      firstPayment: offer.firstPayment,
      installmentCount: offer.installmentCount,
      installments: offer.installments.map((row: { amount: number; sessionsUnlocked: number }) => ({
        amount: row.amount,
        sessionsUnlocked: row.sessionsUnlocked,
      })),
      allStaff: offer.allStaff,
      staffIds: offer.staffIds,
    },
  });
  expect(update.ok()).toBeTruthy();
}

test.describe('US-12: Build and confirm a sale', () => {
  test('shows scoped catalog, customer, payment choices, owned balance, and confirms the UI draft', async ({
    page,
  }) => {
    const salesBefore = Number(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Sales WHERE TenantId = '${e2eIds.tenantA}';`)
    );

    await performUiLogin(page);
    await page.getByRole('button', { name: 'Sell Service / Offer' }).click();
    const dialog = page.locator('.sale-builder-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('E2E Sale Cash Service', { exact: true })).toBeVisible();
    await expect(dialog.getByText('E2E Sale Installment Package', { exact: true })).toBeVisible();
    await expect(dialog.getByText('US-07 to US-12 E2E Category', { exact: true })).toBeVisible();

    await dialog.locator('#sale-mobile').fill(e2eAccount.customerMobile);
    await dialog.locator('.mobile-search button[type="submit"]').click();
    await expect(dialog.getByText('US-07 Test Customer', { exact: true })).toBeVisible();
    const ownedChoice = dialog.locator('.owned-list button').filter({
      hasText: 'E2E Owned Session Package',
    });
    await expect(ownedChoice).toContainText('3 available');

    const installmentCard = dialog.locator('.catalog-card').filter({
      hasText: 'E2E Sale Installment Package',
    });
    await installmentCard.getByRole('button', { name: 'Add' }).click();
    const installmentRow = dialog.locator('.selected-panel tbody tr').filter({
      hasText: 'E2E Sale Installment Package',
    });
    await installmentRow.locator('select').selectOption('installment');

    const cashCard = dialog.locator('.catalog-card').filter({ hasText: 'E2E Sale Cash Service' });
    await cashCard.getByRole('button', { name: 'Add' }).click();
    await ownedChoice.click();

    const dueNow = dialog.locator('.summary-row.due strong');
    const grandTotal = dialog
      .locator('.summary-row')
      .filter({ hasText: 'Sale total' })
      .locator('strong');
    await expect(dueNow).toContainText('800');
    await expect(grandTotal).toHaveText('2300');
    const ownedRow = dialog.locator('.selected-panel tbody tr').filter({
      hasText: 'E2E Owned Session Package',
    });
    await expect(ownedRow).toContainText('Owned session');
    await expect(ownedRow.locator('td').nth(4)).toHaveText('0');

    const cashRow = dialog.locator('.selected-panel tbody tr').filter({
      hasText: 'E2E Sale Cash Service',
    });
    await cashRow.getByRole('button', { name: 'Remove row' }).click();
    await expect(dueNow).toContainText('500');
    expect(
      Number(
        queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Sales WHERE TenantId = '${e2eIds.tenantA}';`)
      )
    ).toBe(salesBefore);

    await dialog.getByRole('button', { name: 'Add one unlisted service' }).click();
    await dialog.locator('#sale-unlisted-name').fill('E2E One-off UI Service');
    await dialog.locator('#sale-unlisted-price').fill('125');
    await dialog.locator('#sale-unlisted-duration').fill('25');
    await dialog.locator('.unlisted-form').getByRole('button', { name: 'Add' }).click();
    await expect(dialog.locator('.selected-panel tbody')).toContainText('E2E One-off UI Service');
    await expect(dueNow).toContainText('625');

    const confirmResponse = page.waitForResponse(
      response =>
        response.request().method() === 'POST' && response.url().endsWith('/sales/confirm')
    );
    await dialog.getByRole('button', { name: 'Confirm and book later' }).click();
    const response = await confirmResponse;
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result).toMatchObject({ status: 'PendingCollection', grandTotal: 2125, dueNow: 625 });
    await expect(
      page.getByText('Sale saved. Collection and booking remain pending.')
    ).toBeVisible();

    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.Sales
         WHERE TenantId = '${e2eIds.tenantA}' AND Id = '${result.saleId}'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
         WHERE TenantId = '${e2eIds.tenantA}' AND EntityId = '${result.saleId}'
           AND Action = 'SaleConfirmed'));`)
    ).toMatch(/^1\|1$/);
  });

  test('requotes and confirms mixed items through the API without fabricating payment, purchase, or booking results', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const items: DraftItem[] = [
      catalogItem(e2eIds.saleInstallmentOffer, 'installment'),
      catalogItem(e2eIds.cashServiceOffer),
      {
        offerId: null,
        ownedCustomerPackageId: e2eIds.ownedSessionPurchase,
        unlistedName: null,
        unlistedPrice: null,
        unlistedDurationMinutes: null,
        paymentOption: 'owned',
        quantity: 1,
      },
      {
        offerId: null,
        ownedCustomerPackageId: null,
        unlistedName: 'E2E One-off API Service',
        unlistedPrice: 125,
        unlistedDurationMinutes: 25,
        paymentOption: 'cash',
        quantity: 1,
      },
    ];
    const quote = await request.post(`${apiBaseUrl}/sales/quote`, {
      headers,
      data: { customerId: e2eIds.customer, branchId: e2eIds.branch, items },
    });
    expect(quote.ok()).toBeTruthy();
    const priced = await quote.json();
    expect(priced).toMatchObject({ subtotal: 2425, discount: 0, grandTotal: 2425, dueNow: 925 });
    expect(priced.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          offerId: e2eIds.saleInstallmentOffer,
          paymentOption: 'installment',
          finalAmount: 2000,
          dueNow: 500,
        }),
        expect.objectContaining({
          offerId: e2eIds.cashServiceOffer,
          paymentOption: 'cash',
          finalAmount: 300,
          dueNow: 300,
        }),
        expect.objectContaining({
          ownedCustomerPackageId: e2eIds.ownedSessionPurchase,
          paymentOption: 'owned',
          finalAmount: 0,
          dueNow: 0,
        }),
        expect.objectContaining({ name: 'E2E One-off API Service', dueNow: 125 }),
      ])
    );

    const confirmation = {
      customerId: e2eIds.customer,
      branchId: e2eIds.branch,
      items,
      paymentMethod: 'cash',
      expectedGrandTotal: 2425,
      expectedDueNow: 925,
      idempotencyKey: 'e2e-us12-api-confirmation',
    };
    const first = await request.post(`${apiBaseUrl}/sales/confirm`, {
      headers,
      data: confirmation,
    });
    expect(first.ok()).toBeTruthy();
    const firstResult = await first.json();
    expect(firstResult).toMatchObject({
      status: 'PendingCollection',
      grandTotal: 2425,
      dueNow: 925,
    });

    const retry = await request.post(`${apiBaseUrl}/sales/confirm`, {
      headers,
      data: confirmation,
    });
    expect(retry.ok()).toBeTruthy();
    await expect(retry.json()).resolves.toMatchObject({ saleId: firstResult.saleId });

    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.Sales
         WHERE TenantId = '${e2eIds.tenantA}'
           AND IdempotencyKey = 'e2e-us12-api-confirmation'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
         WHERE TenantId = '${e2eIds.tenantA}' AND EntityId = '${firstResult.saleId}'
           AND Action = 'SaleConfirmed'), '|',
        (SELECT COUNT(*) FROM dbo.CustomerPackages
         WHERE TenantId = '${e2eIds.tenantA}'
           AND PackageId IN ('${e2eIds.saleInstallmentOffer}', '${e2eIds.cashServiceOffer}')), '|',
        (SELECT COUNT(*) FROM dbo.BookingPackageReservations
         WHERE TenantId = '${e2eIds.tenantA}'
           AND CustomerPackageId = '${e2eIds.ownedSessionPurchase}'), '|',
        (SELECT CONCAT(Used, ':', ISNULL(ReservedSessions, 0)) FROM dbo.CustomerPackages
         WHERE TenantId = '${e2eIds.tenantA}' AND Id = '${e2eIds.ownedSessionPurchase}'));`)
    ).toMatch(/^1\|1\|0\|0\|1:0$/);

    const savedSnapshot = queryE2eDatabase(
      `SELECT ItemsSnapshotJson FROM dbo.Sales
       WHERE TenantId = '${e2eIds.tenantA}' AND Id = '${firstResult.saleId}';`
    );
    const snapshots = JSON.parse(savedSnapshot) as {
      Name: string;
      OfferId: string | null;
      FinalAmount: number;
    }[];
    expect(snapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Name: 'E2E Sale Installment Package',
          OfferId: e2eIds.saleInstallmentOffer,
          FinalAmount: 2000,
        }),
        expect.objectContaining({
          Name: 'E2E One-off API Service',
          OfferId: null,
          FinalAmount: 125,
        }),
      ])
    );

    await updateOffer(request, headers, e2eIds.saleInstallmentOffer, {
      name: 'E2E Renamed After Sale',
      price: 1999,
    });
    expect(
      queryE2eDatabase(
        `SELECT ItemsSnapshotJson FROM dbo.Sales
         WHERE TenantId = '${e2eIds.tenantA}' AND Id = '${firstResult.saleId}';`
      )
    ).toBe(savedSnapshot);

    const catalog = await request.get(`${apiBaseUrl}/sales/catalog`, { headers });
    expect(catalog.ok()).toBeTruthy();
    const catalogNames = (await catalog.json()).items.map((item: { name: string }) => item.name);
    expect(catalogNames).not.toContain('E2E One-off API Service');
  });

  test('refuses confirmation after an offer becomes inactive and writes no sale or audit', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const items = [catalogItem(e2eIds.staleSaleOffer)];
    const quote = await request.post(`${apiBaseUrl}/sales/quote`, {
      headers,
      data: { customerId: e2eIds.customer, branchId: e2eIds.branch, items },
    });
    expect(quote.ok()).toBeTruthy();
    const priced = await quote.json();
    expect(priced).toMatchObject({ grandTotal: 225, dueNow: 225 });

    await updateOffer(request, headers, e2eIds.staleSaleOffer, { isActive: false });
    const confirm = await request.post(`${apiBaseUrl}/sales/confirm`, {
      headers,
      data: {
        customerId: e2eIds.customer,
        branchId: e2eIds.branch,
        items,
        paymentMethod: 'cash',
        expectedGrandTotal: 225,
        expectedDueNow: 225,
        idempotencyKey: 'e2e-us12-stale-confirmation',
      },
    });
    await expectErrorCode(confirm, 409, 'SaleOfferUnavailable');
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.Sales
         WHERE TenantId = '${e2eIds.tenantA}'
           AND IdempotencyKey = 'e2e-us12-stale-confirmation'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
         WHERE TenantId = '${e2eIds.tenantA}' AND Action = 'SaleConfirmed'
           AND EntityId IN (SELECT Id FROM dbo.Sales
             WHERE TenantId = '${e2eIds.tenantA}'
               AND IdempotencyKey = 'e2e-us12-stale-confirmation')));`)
    ).toMatch(/^0\|0$/);
  });

  test('scopes the sale catalog and quote to the authenticated tenant', async ({ request }) => {
    const tenantBHeaders = await authenticate(request, e2eAccount.tenantBPhone);
    const catalog = await request.get(`${apiBaseUrl}/sales/catalog`, { headers: tenantBHeaders });
    expect(catalog.ok()).toBeTruthy();
    const ids = (await catalog.json()).items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(e2eIds.cashServiceOffer);
    expect(ids).not.toContain(e2eIds.saleInstallmentOffer);

    const quote = await request.post(`${apiBaseUrl}/sales/quote`, {
      headers: tenantBHeaders,
      data: {
        customerId: null,
        branchId: null,
        items: [catalogItem(e2eIds.cashServiceOffer)],
      },
    });
    await expectErrorCode(quote, 409, 'SaleOfferUnavailable');

    const foreignBranchConfirm = await request.post(`${apiBaseUrl}/sales/confirm`, {
      headers: tenantBHeaders,
      data: {
        customerId: e2eIds.customer,
        branchId: e2eIds.branch,
        items: [catalogItem(e2eIds.cashServiceOffer)],
        paymentMethod: 'cash',
        expectedGrandTotal: 300,
        expectedDueNow: 300,
        idempotencyKey: 'e2e-us12-tenant-b',
      },
    });
    await expectErrorCode(foreignBranchConfirm, 403, 'SaleBranchUnavailable');
  });
});
