import { expect, test } from '@playwright/test';
import {
  apiBaseUrl,
  authenticate,
  e2eAccount,
  e2eIds,
  performUiLogin,
  queryE2eDatabase,
} from './e2e-fixtures';
import { catalogItem, confirmQuotedSale, expectCode } from './us-13-15-helpers';

test.describe('US-13: direct customer', () => {
  test('keeps two service sales under one anonymous ledger', async ({ request }) => {
    const headers = await authenticate(request);
    const first = await confirmQuotedSale(request, headers, {
      key: 'e2e-us13-direct-first',
      directCustomer: true,
      offerId: e2eIds.directServiceOffer,
    });
    const second = await confirmQuotedSale(request, headers, {
      key: 'e2e-us13-direct-second',
      directCustomer: true,
      offerId: e2eIds.directServiceOffer,
    });
    expect(first.sale).toMatchObject({ status: 'PendingCollection', dueNow: 350 });
    expect(second.sale.saleId).not.toBe(first.sale.saleId);

    const ledger = await request.get(`${apiBaseUrl}/customers/direct-sales?page=1`, { headers });
    expect(ledger.ok()).toBeTruthy();
    const direct = await ledger.json();
    expect(direct.totalSales).toBe(2);
    expect(direct.sales.map((sale: { saleId: string }) => sale.saleId)).toEqual(
      expect.arrayContaining([first.sale.saleId, second.sale.saleId])
    );
    expect(
      queryE2eDatabase(`SELECT CONCAT(COUNT(DISTINCT c.Id), '|',
        MIN(LEN(c.MobileNumber)), '|', COUNT(p.Id), '|', COUNT(sc.Id))
        FROM dbo.Sales s JOIN dbo.Customers c ON c.Id = s.CustomerId
        LEFT JOIN dbo.CustomerPackages p ON p.SaleId = s.Id
        LEFT JOIN dbo.SaleCollections sc ON sc.SaleId = s.Id
        WHERE s.TenantId = '${e2eIds.tenantA}'
          AND s.Id IN ('${first.sale.saleId}', '${second.sale.saleId}')
          AND c.IsDirect = 1;`)
    ).toBe('1|0|0|0');
  });

  test('refuses a package or someone else’s owned balance for direct mode', async ({ request }) => {
    const headers = await authenticate(request);
    const packageQuote = await request.post(`${apiBaseUrl}/sales/quote`, {
      headers,
      data: {
        customerId: null,
        directCustomer: true,
        branchId: e2eIds.branch,
        items: [catalogItem(e2eIds.saleInstallmentOffer)],
      },
    });
    await expectCode(packageQuote, 409, 'SaleDirectServiceOnly');

    const ownedQuote = await request.post(`${apiBaseUrl}/sales/quote`, {
      headers,
      data: {
        customerId: null,
        directCustomer: true,
        branchId: e2eIds.branch,
        items: [
          {
            ...catalogItem(e2eIds.ownedSessionOffer),
            offerId: null,
            ownedCustomerPackageId: e2eIds.ownedSessionPurchase,
            paymentOption: 'owned',
          },
        ],
      },
    });
    await expectCode(ownedQuote, 409, 'SaleDirectServiceOnly');
  });

  test('clears registered selection when direct mode is entered and left', async ({ page }) => {
    await performUiLogin(page);
    await page.getByRole('button', { name: 'Sell Service / Offer' }).click();
    const dialog = page.locator('.sale-builder-dialog');
    await dialog.locator('#sale-mobile').fill(e2eAccount.customerMobile);
    await dialog.locator('.mobile-search button[type="submit"]').click();
    await expect(dialog.locator('.customer-name')).toHaveText('US-07 Test Customer');
    await dialog.locator('.customer-choice button').nth(1).click();
    await expect(dialog.locator('#sale-mobile')).toHaveCount(0);
    await expect(dialog.locator('.customer-name')).toHaveCount(0);
    await dialog.locator('.customer-choice button').first().click();
    await expect(dialog.locator('#sale-mobile')).toHaveValue('');
    await expect(dialog.locator('.customer-name')).not.toHaveText('US-07 Test Customer');
  });
});
