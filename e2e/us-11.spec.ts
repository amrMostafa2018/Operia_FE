import { expect, test, type APIResponse, type Page } from '@playwright/test';
import {
  apiBaseUrl,
  authenticate,
  e2eAccount,
  e2eIds,
  performUiLogin,
  queryE2eDatabase,
} from './e2e-fixtures';

function errorCodes(responseBody: { errorCodes?: Record<string, string | string[]> }): string[] {
  return Object.values(responseBody.errorCodes ?? {}).flatMap(value =>
    Array.isArray(value) ? value : [value]
  );
}

async function expectErrorCode(response: APIResponse, status: number, code: string): Promise<void> {
  expect(response.status()).toBe(status);
  expect(errorCodes(await response.json())).toContain(code);
}

async function openInquiryPurchase(page: Page, purchaseName: string) {
  await page.locator('.quick-actions .secondary-action').click();
  const dialog = page.locator('.customer-inquiry-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[formcontrolname="mobile"]').fill(e2eAccount.customerMobile);
  await dialog.locator('.search-btn').click();
  await expect(dialog.getByText(e2eAccount.customerMobile)).toBeVisible();

  const card = dialog.locator('.record-card').filter({ hasText: purchaseName });
  await expect(card).toBeVisible();
  if (!(await card.getAttribute('class'))?.includes('is-expanded')) {
    await card.locator('.record-toggle').click();
  }
  await expect(card.locator('.record-body')).toBeVisible();
  return { dialog, card };
}

test.describe('US-11: Collect one installment and respect released sessions', () => {
  test('collects the eligible installment through the real inquiry UI and refreshes bookable balance', async ({
    page,
    request,
  }) => {
    const headers = await authenticate(request);
    const before = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.uiCollectionPurchase}/inquiry`,
      { headers }
    );
    expect(before.ok()).toBeTruthy();
    await expect(before.json()).resolves.toMatchObject({
      id: e2eIds.uiCollectionPurchase,
      amountRemaining: 1500,
      nextInstallmentNumber: 1,
      nextInstallmentEligible: true,
      nextInstallmentAmount: 500,
      sessions: { total: 10, used: 0, remaining: 10, bookable: 0 },
      collections: [],
    });

    await performUiLogin(page);
    const { card } = await openInquiryPurchase(page, 'E2E Collect in UI');
    await expect(card.locator('.bookable-count strong')).toHaveText('0');
    await card.getByRole('button', { name: 'Pay new installment' }).click();

    const paymentDialog = page.getByRole('dialog', { name: 'Pay new installment' });
    await expect(paymentDialog).toContainText('E2E Collect in UI');
    await expect(paymentDialog).toContainText('500');
    await paymentDialog.locator('#collection-payment-method').selectOption('cash');
    const collectionResponse = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/customers/purchases/${e2eIds.uiCollectionPurchase}/installments`)
    );
    await paymentDialog.getByRole('button', { name: 'Record confirmed payment' }).click();
    expect((await collectionResponse).ok()).toBeTruthy();
    await expect(page.getByText('Installment collection recorded.')).toBeVisible();
    await expect(card.locator('.bookable-count strong')).toHaveText('3');
    await expect(card).toContainText('Complete the sessions released by the previous installment');

    const after = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.uiCollectionPurchase}/inquiry`,
      { headers }
    );
    expect(after.ok()).toBeTruthy();
    await expect(after.json()).resolves.toMatchObject({
      amountRemaining: 1000,
      nextInstallmentNumber: 2,
      nextInstallmentEligible: false,
      sessions: { total: 10, used: 0, remaining: 10, bookable: 3 },
      collections: [{ installmentNumber: 1, amount: 500, paymentMethod: 'cash' }],
    });

    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.InstallmentCollections
         WHERE TenantId = '${e2eIds.tenantA}'
           AND CustomerPackageId = '${e2eIds.uiCollectionPurchase}'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
         WHERE TenantId = '${e2eIds.tenantA}'
           AND EntityId = '${e2eIds.uiCollectionPurchase}'
           AND Action = 'InstallmentCollected'));`)
    ).toMatch(/^1\|1$/);
  });

  test('stores one collection, one release, and one audit for an idempotent API retry', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const url = `${apiBaseUrl}/customers/purchases/${e2eIds.apiCollectionPurchase}/installments`;
    const data = { paymentMethod: 'cash', idempotencyKey: 'e2e-us11-api-collection-1' };

    const first = await request.post(url, { headers, data });
    expect(first.ok()).toBeTruthy();
    const firstResult = await first.json();
    expect(firstResult).toMatchObject({
      installmentNumber: 1,
      amount: 500,
      amountRemaining: 1000,
      releasedSessions: 3,
      fullyPaid: false,
    });

    const retry = await request.post(url, { headers, data });
    expect(retry.ok()).toBeTruthy();
    await expect(retry.json()).resolves.toMatchObject({
      collectionId: firstResult.collectionId,
      installmentNumber: 1,
      amountRemaining: 1000,
      releasedSessions: 3,
      fullyPaid: false,
    });

    const detail = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.apiCollectionPurchase}/inquiry`,
      { headers }
    );
    expect(detail.ok()).toBeTruthy();
    await expect(detail.json()).resolves.toMatchObject({
      amountPaid: 1000,
      amountRemaining: 1000,
      nextInstallmentNumber: 2,
      nextInstallmentEligible: false,
      sessions: { total: 10, used: 0, remaining: 10, bookable: 3 },
      collections: [{ id: firstResult.collectionId, installmentNumber: 1 }],
    });

    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.InstallmentCollections
         WHERE TenantId = '${e2eIds.tenantA}'
           AND CustomerPackageId = '${e2eIds.apiCollectionPurchase}'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
         WHERE TenantId = '${e2eIds.tenantA}'
           AND EntityId = '${e2eIds.apiCollectionPurchase}'
           AND Action = 'InstallmentCollected'));`)
    ).toMatch(/^1\|1$/);
  });

  test('keeps the next installment progress-locked and rejects raw remaining balance as entitlement', async ({
    page,
    request,
  }) => {
    const headers = await authenticate(request);
    const detail = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.lockedCollectionPurchase}/inquiry`,
      { headers }
    );
    expect(detail.ok()).toBeTruthy();
    await expect(detail.json()).resolves.toMatchObject({
      amountRemaining: 1000,
      nextInstallmentNumber: 2,
      nextInstallmentEligible: false,
      sessions: { total: 10, used: 2, remaining: 8, bookable: 1 },
      collections: [{ installmentNumber: 1, amount: 500 }],
    });

    const collection = await request.post(
      `${apiBaseUrl}/customers/purchases/${e2eIds.lockedCollectionPurchase}/installments`,
      {
        headers,
        data: { paymentMethod: 'cash', idempotencyKey: 'e2e-us11-locked-attempt' },
      }
    );
    await expectErrorCode(collection, 409, 'CustomerInstallmentNotEligible');
    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.InstallmentCollections
         WHERE TenantId = '${e2eIds.tenantA}'
           AND CustomerPackageId = '${e2eIds.lockedCollectionPurchase}'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
         WHERE TenantId = '${e2eIds.tenantA}'
           AND EntityId = '${e2eIds.lockedCollectionPurchase}'
           AND Action = 'InstallmentCollected'));`)
    ).toMatch(/^1\|0$/);

    const zeroReleaseOwnedQuote = await request.post(`${apiBaseUrl}/sales/quote`, {
      headers,
      data: {
        customerId: e2eIds.customer,
        branchId: e2eIds.branch,
        items: [
          {
            offerId: null,
            ownedCustomerPackageId: e2eIds.finalCollectionPurchase,
            unlistedName: null,
            unlistedPrice: null,
            unlistedDurationMinutes: null,
            paymentOption: 'owned',
            quantity: 1,
          },
        ],
      },
    });
    await expectErrorCode(zeroReleaseOwnedQuote, 409, 'SaleOwnedSessionUnavailable');

    await performUiLogin(page);
    const { card } = await openInquiryPurchase(page, 'E2E Progress Locked');
    await expect(card).toContainText('Complete the sessions released by the previous installment');
    await expect(card.getByRole('button', { name: 'Pay new installment' })).toHaveCount(0);
  });

  test('collects the final installment through the API and releases every remaining session once', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const url = `${apiBaseUrl}/customers/purchases/${e2eIds.finalCollectionPurchase}/installments`;
    const data = { paymentMethod: 'cash', idempotencyKey: 'e2e-us11-final-collection' };

    const first = await request.post(url, { headers, data });
    expect(first.ok()).toBeTruthy();
    const result = await first.json();
    expect(result).toMatchObject({
      installmentNumber: 3,
      amount: 500,
      amountRemaining: 0,
      releasedSessions: 10,
      fullyPaid: true,
    });

    const retry = await request.post(url, { headers, data });
    expect(retry.ok()).toBeTruthy();
    await expect(retry.json()).resolves.toMatchObject({
      collectionId: result.collectionId,
      amountRemaining: 0,
      releasedSessions: 10,
      fullyPaid: true,
    });

    const detail = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.finalCollectionPurchase}/inquiry`,
      { headers }
    );
    expect(detail.ok()).toBeTruthy();
    const details = await detail.json();
    expect(details).toMatchObject({
      paymentStatus: 'fullyPaid',
      amountRemaining: 0,
      nextInstallmentNumber: null,
      sessions: { total: 10, used: 6, remaining: 4, bookable: 4 },
    });
    expect(details.collections).toHaveLength(3);

    expect(
      queryE2eDatabase(`SELECT CONCAT(
        (SELECT COUNT(*) FROM dbo.InstallmentCollections
         WHERE TenantId = '${e2eIds.tenantA}'
           AND CustomerPackageId = '${e2eIds.finalCollectionPurchase}'), '|',
        (SELECT COUNT(*) FROM dbo.AuditLogs
         WHERE TenantId = '${e2eIds.tenantA}'
           AND EntityId = '${e2eIds.finalCollectionPurchase}'
           AND Action = 'InstallmentCollected'));`)
    ).toMatch(/^3\|1$/);
  });

  test('enforces collection permission and tenant scope at the API boundary', async ({
    request,
  }) => {
    const staffHeaders = await authenticate(request, e2eAccount.staffPhone);
    const forbidden = await request.post(
      `${apiBaseUrl}/customers/purchases/${e2eIds.apiCollectionPurchase}/installments`,
      {
        headers: staffHeaders,
        data: { paymentMethod: 'cash', idempotencyKey: 'e2e-us11-staff-forbidden' },
      }
    );
    expect(forbidden.status()).toBe(403);

    const tenantBHeaders = await authenticate(request, e2eAccount.tenantBPhone);
    const foreignRead = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.apiCollectionPurchase}/inquiry`,
      { headers: tenantBHeaders }
    );
    await expectErrorCode(foreignRead, 404, 'CustomerPurchaseNotFound');

    const foreignCollection = await request.post(
      `${apiBaseUrl}/customers/purchases/${e2eIds.apiCollectionPurchase}/installments`,
      {
        headers: tenantBHeaders,
        data: { paymentMethod: 'cash', idempotencyKey: 'e2e-us11-tenant-b' },
      }
    );
    await expectErrorCode(foreignCollection, 404, 'CustomerPurchaseNotFound');
  });
});
