import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds, performUiLogin } from './e2e-fixtures';

test.describe('US-22: scoped customer audit history', () => {
  test('opens the selected customer history in the UI', async ({ page }) => {
    await performUiLogin(page);
    await page.goto('/customers');
    const grid = page.locator('.customer-operations');
    await grid.getByPlaceholder('Mobile').fill('01000000212');
    await grid.locator('.filter-actions .primary').click();
    const row = grid.locator('tbody tr').filter({ hasText: 'US-22 History Customer' });
    await expect(row).toHaveCount(1);
    await row.locator('.menu-toggle').click();
    await page.getByRole('menuitem', { name: /Change history/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Customer change history' });
    await expect(dialog.locator('.history-event')).toHaveCount(12);
    await expect(dialog.getByRole('button', { name: 'Next page' })).toHaveCount(0);
  });

  test('pages a selected customer without duplicating or leaking another customer', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const url = `${apiBaseUrl}/customers/${e2eIds.historyCustomer}/sales/${e2eIds.historySale}/history`;
    const first = await request.get(url, { headers });
    expect(first.ok(), await first.text()).toBeTruthy();
    const firstPage = await first.json();
    expect(firstPage.total).toBe(12);
    expect(firstPage.items).toHaveLength(10);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPage.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'CustomerBlockReasonChanged',
          referenceId: e2eIds.historyCustomer,
        }),
      ])
    );

    const second = await request.get(`${url}?cursor=${encodeURIComponent(firstPage.nextCursor)}`, {
      headers,
    });
    expect(second.ok(), await second.text()).toBeTruthy();
    const secondPage = await second.json();
    expect(secondPage.total).toBe(12);
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.nextCursor).toBeNull();
    const ids = [...firstPage.items, ...secondPage.items].map(item => item.id);
    expect(new Set(ids).size).toBe(12);
    expect(ids).toEqual([...ids].sort().reverse());

    const other = await request.get(
      `${apiBaseUrl}/customers/${e2eIds.historyOtherCustomer}/sales/${e2eIds.historyOtherSale}/history`,
      { headers }
    );
    expect(other.ok(), await other.text()).toBeTruthy();
    expect(await other.json()).toMatchObject({ total: 1 });
  });

  test('does not expose another tenant history or bypass the history permission', async ({
    request,
  }) => {
    const url = `${apiBaseUrl}/customers/${e2eIds.historyCustomer}/sales/${e2eIds.historySale}/history`;
    const otherTenant = await authenticate(request, e2eAccount.tenantBPhone);
    const hidden = await request.get(url, { headers: otherTenant });
    expect(hidden.status()).toBe(404);

    const staff = await authenticate(request, e2eAccount.staffPhone);
    const denied = await request.get(url, { headers: staff });
    expect(denied.status()).toBe(403);
  });
});
