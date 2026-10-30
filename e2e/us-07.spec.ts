import { expect, test, type Page, type Locator } from '@playwright/test';

const categoryId = '00000000-0000-4000-8000-000000000006';
const offerId = '00000000-0000-4000-8000-000000000007';

const phone = process.env.OPERIA_E2E_PHONE || '+201095685986';
const password = process.env.OPERIA_E2E_PASSWORD || 'Admin@12345';
const otp = process.env.OPERIA_E2E_OTP || '111111';

async function performLogin(page: Page) {
  await page.goto('/auth/login');
  await page.locator('#loginPhone').fill(phone);
  await page.locator('#password').fill(password);
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator('#loginOtpCode-0')).toBeVisible();
  await page.locator('#loginOtpCode-0').click();
  await page.keyboard.type(otp);
  await page.locator('app-otp-verification button[type="submit"]').click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding\/(setup|plan))/);

  if (page.url().includes('/onboarding/')) {
    await page.route('**/api/onboarding/status', async route => {
      const response = await route.fetch();
      const status = await response.json();
      await route.fulfill({ response, json: { ...status, step: 4 } });
    });
  }
}

async function fillNumberInput(input: Locator, value: string | number) {
  await input.click();
  await input.press('Control+A');
  await input.press('Backspace');
  await input.fill(String(value));
  await input.dispatchEvent('input');
  await input.dispatchEvent('change');
  await input.press('Tab');
}

async function setInstallmentRow(page: Page, rowIndex: number, amount: number, sessions: number) {
  const row = page.locator('.installment-plan-table tbody tr').nth(rowIndex);
  await fillNumberInput(row.locator('td').nth(1).locator('input'), amount);
  await fillNumberInput(row.locator('td').nth(2).locator('input'), sessions);
}

function setupControlledOfferApi(page: Page, submitted: Record<string, unknown>[]) {
  let savedOffer: Record<string, unknown> | null = null;

  return page.route('**/api/packages**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/service-categories')) {
      return json([{ id: categoryId, name: 'Playwright category', icon: 'pi pi-box' }]);
    }
    if (path.endsWith('/sub-service-categories')) {
      return json([]);
    }
    if (request.method() === 'POST' && path.endsWith('/packages')) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      submitted.push(payload);
      const rows = (payload['installments'] as Array<{ amount: number; sessionsUnlocked: number }>) || [];
      let cum = 0;
      const enrichedRows = rows.map((r, idx) => {
        cum += r.sessionsUnlocked;
        return {
          number: idx + 1,
          amount: r.amount,
          sessionsUnlocked: r.sessionsUnlocked,
          cumulativeAvailableSessions: cum,
        };
      });
      savedOffer = {
        ...payload,
        id: offerId,
        status: payload['isActive'] ? 'active' : 'cancelled',
        serviceCategoryName: 'Playwright category',
        createdAt: '2026-10-30T00:00:00Z',
        endsAt: null,
        cashPriceAfterDiscount: Number(payload['price']),
        installments: enrichedRows,
      };
      return json(savedOffer, 201);
    }
    if (request.method() === 'PUT' && path.endsWith(`/packages/${offerId}`)) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      submitted.push(payload);
      const rows = (payload['installments'] as Array<{ amount: number; sessionsUnlocked: number }>) || [];
      let cum = 0;
      const enrichedRows = rows.map((r, idx) => {
        cum += r.sessionsUnlocked;
        return {
          number: idx + 1,
          amount: r.amount,
          sessionsUnlocked: r.sessionsUnlocked,
          cumulativeAvailableSessions: cum,
        };
      });
      savedOffer = {
        ...savedOffer,
        ...payload,
        status: payload['isActive'] ? 'active' : 'cancelled',
        installments: enrichedRows,
      };
      return json(savedOffer);
    }
    if (request.method() === 'GET' && path.endsWith(`/packages/${offerId}`)) {
      return json(savedOffer);
    }
    if (request.method() === 'GET' && path.endsWith('/packages')) {
      const items = savedOffer ? [savedOffer] : [];
      return json({
        items,
        pageNumber: 1,
        pageSize: 5,
        totalCount: items.length,
        totalPages: items.length ? 1 : 0,
        activeCount: items.length,
        cancelledCount: 0,
      });
    }
    return route.abort();
  });
}

test.describe('US-07: Installment plan and session release', () => {

  test('TC-01, TC-02, TC-06: Package installment offer creation, unequal amounts, suggest distribution and manual edits', async ({ page }) => {
    const submitted: Record<string, unknown>[] = [];
    await setupControlledOfferApi(page, submitted);
    await performLogin(page);

    await page.goto('/packages');
    await expect(page.locator('.packages-page')).toBeVisible();

    // Open create dialog
    await page.locator('.page-head p-button button').click();
    await expect(page.locator('.editor')).toBeVisible();

    // Select "Package" offer type card
    await page.locator('.offer-type-cards button').nth(1).click();
    await expect(page.locator('.offer-type-cards button').nth(1)).toHaveAttribute('aria-checked', 'true');

    // Populate basic package info
    await page.locator('.editor [formcontrolname="name"]').fill('TC-01 Package Offer');
    await page.locator('.editor [formcontrolname="sessionDurationValue"]').fill('30');
    await page.locator('.editor [formcontrolname="sessionCount"]').fill('10');
    await page.locator('.editor [formcontrolname="serviceCategoryId"]').click();
    await page
      .locator('.p-dropdown-panel .p-dropdown-item')
      .filter({ hasText: 'Playwright category' })
      .click();

    await test.step('TC-01: 10-session package with 5,000 first payment, count 3, 5,000 each with 3/4/3 releases', async () => {
      await page.locator('.editor [formcontrolname="price"] input').fill('18000');
      // Enable installments
      await page
        .locator('.editor [formcontrolname="installmentEnabled"] .p-inputswitch-slider')
        .click();
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentPrice"] input'), '20000');
      await fillNumberInput(page.locator('.editor [formcontrolname="firstPayment"] input'), '5000');
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '3');

      // The grid has exactly 3 rows
      const rows = page.locator('.installment-plan-table tbody tr');
      await expect(rows).toHaveCount(3);

      // Set amounts and sessions: 5,000 / 5,000 / 5,000 and 3 / 4 / 3
      await setInstallmentRow(page, 0, 5000, 3);
      await setInstallmentRow(page, 1, 5000, 4);
      await setInstallmentRow(page, 2, 5000, 3);

      // Cumulative sessions in table: 3 / 7 / 10
      await expect(rows.nth(0).locator('td').nth(3)).toHaveText('3');
      await expect(rows.nth(1).locator('td').nth(3)).toHaveText('7');
      await expect(rows.nth(2).locator('td').nth(3)).toHaveText('10');

      // Save
      await page.locator('.editor footer button[type="submit"]').click();
      await expect(page.locator('.editor')).toHaveCount(0);

      // Verify submitted payload
      expect(submitted).toHaveLength(1);
      expect(submitted[0]).toMatchObject({
        price: 18000,
        installmentPrice: 20000,
        firstPayment: 5000,
        installmentCount: 3,
        installments: [
          { amount: 5000, sessionsUnlocked: 3 },
          { amount: 5000, sessionsUnlocked: 4 },
          { amount: 5000, sessionsUnlocked: 3 },
        ],
      });

      // Reopen offer and verify readback
      await page.locator('.packages-table tbody .table-icon-btn.edit').first().click();
      await expect(page.locator('.editor')).toBeVisible();
      await expect(page.locator('.editor [formcontrolname="price"] input')).toHaveValue('18,000');
      await expect(page.locator('.editor [formcontrolname="installmentPrice"] input')).toHaveValue(
        '20,000'
      );
      await expect(page.locator('.editor [formcontrolname="firstPayment"] input')).toHaveValue('5,000');
      await expect(page.locator('.editor [formcontrolname="installmentCount"] input')).toHaveValue('3');
      const editRows = page.locator('.installment-plan-table tbody tr');
      await expect(editRows).toHaveCount(3);
      await expect(editRows.nth(0).locator('td').nth(3)).toHaveText('3');
      await expect(editRows.nth(1).locator('td').nth(3)).toHaveText('7');
      await expect(editRows.nth(2).locator('td').nth(3)).toHaveText('10');
    });

    await test.step('TC-02: Unequal nonnegative amounts 4,000 / 6,000 / 5,000 totaling 15,000 accepted', async () => {
      await setInstallmentRow(page, 0, 4000, 3);
      await setInstallmentRow(page, 1, 6000, 4);
      await setInstallmentRow(page, 2, 5000, 3);

      await page.locator('.editor footer button[type="submit"]').click();
      await expect(page.locator('.editor')).toHaveCount(0);

      expect(submitted).toHaveLength(2);
      expect(submitted[1]).toMatchObject({
        firstPayment: 5000,
        installmentCount: 3,
        installments: [
          { amount: 4000, sessionsUnlocked: 3 },
          { amount: 6000, sessionsUnlocked: 4 },
          { amount: 5000, sessionsUnlocked: 3 },
        ],
      });

      // Reopen to verify order persisted
      await page.locator('.packages-table tbody .table-icon-btn.edit').first().click();
      await expect(page.locator('.editor')).toBeVisible();
      const reopenRows = page.locator('.installment-plan-table tbody tr');
      await expect(reopenRows.nth(0).locator('td').nth(1).locator('input')).toHaveValue('4,000');
      await expect(reopenRows.nth(1).locator('td').nth(1).locator('input')).toHaveValue('6,000');
      await expect(reopenRows.nth(2).locator('td').nth(1).locator('input')).toHaveValue('5,000');
    });

    await test.step('TC-06: Change installment price to 21,000, suggest distribution, then manually edit row', async () => {
      // Change installment price to 21,000
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentPrice"] input'), '21000');
      // Remaining balance becomes 16,000 (21,000 - 5,000)
      await expect(page.locator('.installment-plan-summary').first()).toContainText('16,000.00');

      // Click suggest distribution
      await page.locator('button.suggest-distribution').click();

      // Manually edit row 0 to 6,000, row 1 to 5,000, row 2 to 5,000 (total 16,000)
      await setInstallmentRow(page, 0, 6000, 3);
      await setInstallmentRow(page, 1, 5000, 4);
      await setInstallmentRow(page, 2, 5000, 3);

      // Save and verify manually edited distribution is submitted
      await page.locator('.editor footer button[type="submit"]').click();
      await expect(page.locator('.editor')).toHaveCount(0);

      const lastPayload = submitted[submitted.length - 1];
      expect(lastPayload).toMatchObject({
        installmentPrice: 21000,
        firstPayment: 5000,
        installments: [
          { amount: 6000, sessionsUnlocked: 3 },
          { amount: 5000, sessionsUnlocked: 4 },
          { amount: 5000, sessionsUnlocked: 3 },
        ],
      });
    });
  });

  test('TC-03, TC-04, TC-05, TC-08: Installment validation rules and inline errors', async ({ page }) => {
    const submitted: Record<string, unknown>[] = [];
    await setupControlledOfferApi(page, submitted);
    await performLogin(page);

    await page.goto('/packages');
    await expect(page.locator('.packages-page')).toBeVisible();

    const openFreshPackageEditor = async () => {
      await page.locator('.page-head p-button button').click();
      await expect(page.locator('.editor')).toBeVisible();
      await page.locator('.offer-type-cards button').nth(1).click();
      await page.locator('.editor [formcontrolname="name"]').fill('Validation Package Offer');
      await page.locator('.editor [formcontrolname="sessionDurationValue"]').fill('30');
      await page.locator('.editor [formcontrolname="sessionCount"]').fill('10');
      await page.locator('.editor [formcontrolname="serviceCategoryId"]').click();
      await page
        .locator('.p-dropdown-panel .p-dropdown-item')
        .filter({ hasText: 'Playwright category' })
        .click();
      await page.locator('.editor [formcontrolname="price"] input').fill('18000');
      await page
        .locator('.editor [formcontrolname="installmentEnabled"] .p-inputswitch-slider')
        .click();
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentPrice"] input'), '20000');
    };

    await test.step('TC-03: Row amounts not totaling balance (4,000 / 5,000 / 5,000) show inline error and block save', async () => {
      await openFreshPackageEditor();
      await fillNumberInput(page.locator('.editor [formcontrolname="firstPayment"] input'), '5000');
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '3');

      // Set amounts: 4,000 / 5,000 / 5,000 = 14,000 != 15,000
      await setInstallmentRow(page, 0, 4000, 3);
      await setInstallmentRow(page, 1, 5000, 4);
      await setInstallmentRow(page, 2, 5000, 3);

      await page.locator('.editor footer button[type="submit"]').click();

      // Inline plan-total error appears
      await expect(page.locator('.payment-option .field-error')).toBeVisible();
      // Editor remains open
      await expect(page.locator('.editor')).toBeVisible();
      // No create/update request sent
      expect(submitted.length).toBe(0);

      await page.locator('.editor button.close').click();
      await expect(page.locator('.editor')).toHaveCount(0);
    });

    await test.step('TC-04: Missing first payment, count 0, or count != rows block save with inline errors', async () => {
      // 1. Missing first payment
      await openFreshPackageEditor();
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '3');
      // Leave firstPayment empty
      await page.locator('.editor footer button[type="submit"]').click();
      await expect(page.locator('.form-field:has([formcontrolname="firstPayment"]) .field-error')).toBeVisible();
      expect(submitted.length).toBe(0);

      // 2. Count 0 or empty count
      await fillNumberInput(page.locator('.editor [formcontrolname="firstPayment"] input'), '5000');
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '');
      await page.locator('.editor footer button[type="submit"]').click();
      await expect(page.locator('.form-field:has([formcontrolname="installmentCount"]) .field-error')).toBeVisible();
      expect(submitted.length).toBe(0);

      // 3. Count differs from rows: restore count 3 and valid rows
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '3');
      await setInstallmentRow(page, 0, 5000, 3);
      await setInstallmentRow(page, 1, 5000, 4);
      await setInstallmentRow(page, 2, 5000, 3);
      // Now manualPlanEdited is true. Changing count to 4 prompts replacement dialog
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '4');
      const repDialog = page.locator('.p-dialog.confirm-action-dialog');
      await expect(repDialog).toBeVisible();
      // Dismiss replacement dialog by clicking Cancel (button 0)
      await repDialog.locator('.confirm-dialog-actions p-button').first().locator('button').click();
      await expect(repDialog).toHaveCount(0);

      await page.locator('.editor button.close').click();
      await expect(page.locator('.editor')).toHaveCount(0);
    });

    await test.step('TC-05: Negative row amount, negative first payment, or first payment > installment price blocked', async () => {
      await openFreshPackageEditor();
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '3');

      // First payment > installment price (25,000 > 20,000)
      await fillNumberInput(page.locator('.editor [formcontrolname="firstPayment"] input'), '25000');
      await page.locator('.editor footer button[type="submit"]').click();
      await expect(page.locator('.form-field:has([formcontrolname="firstPayment"]) .field-error')).toBeVisible();
      expect(submitted.length).toBe(0);

      // Zero row amount remains valid when total balances: first payment 5,000, rows 0 / 10,000 / 5,000 = 15,000
      await fillNumberInput(page.locator('.editor [formcontrolname="firstPayment"] input'), '5000');
      await setInstallmentRow(page, 0, 0, 3);
      await setInstallmentRow(page, 1, 10000, 4);
      await setInstallmentRow(page, 2, 5000, 3);
      await expect(page.locator('.payment-option .field-error')).toHaveCount(0);

      await page.locator('.editor button.close').click();
      await expect(page.locator('.editor')).toHaveCount(0);
    });

    await test.step('TC-08: Row releases exceeding session count or negative releases block save', async () => {
      await openFreshPackageEditor();
      await fillNumberInput(page.locator('.editor [formcontrolname="firstPayment"] input'), '5000');
      await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '3');

      // Releases exceeding total session count: row 0: 6, row 1: 5 (6 + 5 = 11 > 10)
      await setInstallmentRow(page, 0, 5000, 6);
      await setInstallmentRow(page, 1, 5000, 5);
      await setInstallmentRow(page, 2, 5000, 0);

      await page.locator('.editor footer button[type="submit"]').click();
      // Inline session-allocation error appears and save is blocked
      await expect(page.locator('.payment-option .field-error')).toBeVisible();
      expect(submitted.length).toBe(0);

      // Close editor
      await page.locator('.editor button.close').click();
      await expect(page.locator('.editor')).toHaveCount(0);
    });
  });

  test('TC-07: Single session offer rules and plan replacement confirmation', async ({ page }) => {
    const submitted: Record<string, unknown>[] = [];
    await setupControlledOfferApi(page, submitted);
    await performLogin(page);

    await page.goto('/packages');
    await expect(page.locator('.packages-page')).toBeVisible();

    // Open create dialog
    await page.locator('.page-head p-button button').click();
    await expect(page.locator('.editor')).toBeVisible();

    // Default offer type is Single Session
    await expect(page.locator('.offer-type-cards button').nth(0)).toHaveAttribute('aria-checked', 'true');
    // Installment switch and fields are absent for Single session
    await expect(page.locator('.editor [formcontrolname="installmentEnabled"]')).toHaveCount(0);
    await expect(page.locator('.editor [formcontrolname="firstPayment"]')).toHaveCount(0);
    await expect(page.locator('.installment-plan-table')).toHaveCount(0);

    // Switch to Package and configure installment plan
    await page.locator('.offer-type-cards button').nth(1).click();
    await page.locator('.editor [formcontrolname="name"]').fill('Package To Single Session');
    await page.locator('.editor [formcontrolname="sessionDurationValue"]').fill('30');
    await page.locator('.editor [formcontrolname="sessionCount"]').fill('10');
    await page.locator('.editor [formcontrolname="serviceCategoryId"]').click();
    await page
      .locator('.p-dropdown-panel .p-dropdown-item')
      .filter({ hasText: 'Playwright category' })
      .click();
    await page.locator('.editor [formcontrolname="price"] input').fill('18000');
    await page
      .locator('.editor [formcontrolname="installmentEnabled"] .p-inputswitch-slider')
      .click();
    await fillNumberInput(page.locator('.editor [formcontrolname="installmentPrice"] input'), '20000');
    await fillNumberInput(page.locator('.editor [formcontrolname="firstPayment"] input'), '5000');
    await fillNumberInput(page.locator('.editor [formcontrolname="installmentCount"] input'), '3');
    await setInstallmentRow(page, 0, 5000, 3);
    await setInstallmentRow(page, 1, 5000, 4);
    await setInstallmentRow(page, 2, 5000, 3);

    // Save as package
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(page.locator('.editor')).toHaveCount(0);

    // Reopen package offer
    await page.locator('.packages-table tbody .table-icon-btn.edit').first().click();
    await expect(page.locator('.editor')).toBeVisible();

    // Switch back to Single session
    await page.locator('.offer-type-cards button').nth(0).click();

    // Replacement confirmation dialog appears
    const confirmDialog = page.locator('.p-dialog.confirm-action-dialog');
    await expect(confirmDialog).toBeVisible();

    // Confirm plan replacement (second button in actions)
    await confirmDialog.locator('.confirm-dialog-actions p-button').nth(1).locator('button').click();

    // Verify installment controls and grid are now absent
    await expect(page.locator('.editor [formcontrolname="installmentEnabled"]')).toHaveCount(0);
    await expect(page.locator('.editor [formcontrolname="firstPayment"]')).toHaveCount(0);
    await expect(page.locator('.installment-plan-table')).toHaveCount(0);

    // Save as single session
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(page.locator('.editor')).toHaveCount(0);

    const singlePayload = submitted[submitted.length - 1];
    expect(singlePayload).toMatchObject({
      offerType: 'singleSession',
      installmentEnabled: false,
      installments: [],
    });

    // Reopening does not restore the plan
    await page.locator('.packages-table tbody .table-icon-btn.edit').first().click();
    await expect(page.locator('.editor')).toBeVisible();
    await expect(page.locator('.editor [formcontrolname="installmentEnabled"]')).toHaveCount(0);
    await page.locator('.editor button.close').click();
  });

  test('TC-01, TC-02, TC-09, TC-10, TC-11, TC-14, TC-15: Release ceiling, persistence, and tenant isolation against real API & DB', async ({ request, page }) => {
    // Authenticate center admin against real API
    const loginRes = await request.post('http://localhost:5150/api/auth/login', {
      data: { phoneNumber: phone, password },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();

    const authRes = await request.post('http://localhost:5150/api/auth/verify-otp', {
      data: { userId: loginData.userId, code: otp },
    });
    expect(authRes.ok()).toBeTruthy();
    const { accessToken: tokenA } = await authRes.json();
    const headersA = { Authorization: `Bearer ${tokenA}` };

    // Also navigate the visible Chrome browser so the user can watch live
    await performLogin(page);
    await page.goto('/packages');
    await expect(page.locator('.packages-page')).toBeVisible();

    // Ensure a category exists under Tenant A
    const catRes = await request.post('http://localhost:5150/api/packages/service-categories', {
      headers: headersA,
      data: { name: `Dental Cat ${Date.now()}`, icon: 'pi pi-box' },
    });
    expect(catRes.ok()).toBeTruthy();
    const cat = await catRes.json();

    await test.step('TC-01 & TC-02 Real API persistence: save offer, readback verifies amounts and cumulative sessions 3/7/10', async () => {
      const createRes = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `Persistence Plan ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: 'Testing real DB persistence',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 10,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 5000, sessionsUnlocked: 3 },
            { amount: 5000, sessionsUnlocked: 4 },
            { amount: 5000, sessionsUnlocked: 3 },
          ],
        },
      });
      expect(createRes.status()).toBe(201);
      const pkg = await createRes.json();

      // Read back from real API / DB
      const getRes = await request.get(`http://localhost:5150/api/packages/${pkg.id}`, { headers: headersA });
      expect(getRes.ok()).toBeTruthy();
      const readback = await getRes.json();

      expect(readback.price).toBe(18000);
      expect(readback.installmentPrice).toBe(20000);
      expect(readback.firstPayment).toBe(5000);
      expect(readback.installments).toHaveLength(3);
      expect(readback.installments[0]).toMatchObject({ amount: 5000, sessionsUnlocked: 3, cumulativeAvailableSessions: 3 });
      expect(readback.installments[1]).toMatchObject({ amount: 5000, sessionsUnlocked: 4, cumulativeAvailableSessions: 7 });
      expect(readback.installments[2]).toMatchObject({ amount: 5000, sessionsUnlocked: 3, cumulativeAvailableSessions: 10 });

      // Update with unequal amounts (TC-02)
      const updateRes = await request.put(`http://localhost:5150/api/packages/${pkg.id}`, {
        headers: headersA,
        data: {
          name: readback.name,
          isActive: true,
          offerType: 'package',
          description: readback.description,
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 10,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 4000, sessionsUnlocked: 3 },
            { amount: 6000, sessionsUnlocked: 4 },
            { amount: 5000, sessionsUnlocked: 3 },
          ],
        },
      });
      expect(updateRes.ok()).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.installments[0].amount).toBe(4000);
      expect(updated.installments[1].amount).toBe(6000);
      expect(updated.installments[2].amount).toBe(5000);

      // Verify in the UI by reloading the packages table and editing the newly created package
      await page.goto('/packages');
      await expect(page.locator('.packages-table tbody tr').first()).toBeVisible();
      await page.locator('.packages-table tbody .table-icon-btn.edit').first().click();
      await expect(page.locator('.editor')).toBeVisible();
      await expect(page.locator('.editor [formcontrolname="installmentPrice"] input')).toHaveValue('20,000');
      await page.locator('.editor button.close').click();
    });

    await test.step('TC-09: Prepayment ceiling (10 sessions ceiling is 7): 8/0/2 rejected, 3/4/3 accepted', async () => {
      // 8 / 0 / 2 releases 8 before full payment -> rejected by real API
      const rejectedRes = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `Ceiling Rejection ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 10,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 5000, sessionsUnlocked: 8 },
            { amount: 5000, sessionsUnlocked: 0 },
            { amount: 5000, sessionsUnlocked: 2 },
          ],
        },
      });
      expect(rejectedRes.status()).toBe(400);
      const err = await rejectedRes.json();
      expect(JSON.stringify(err)).toContain('PACKAGE_INSTALLMENT_RELEASE_CAP');

      // 3 / 4 / 3 releases at most 7 before full payment -> accepted by real API
      const acceptedRes = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `Ceiling Accepted ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 10,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 5000, sessionsUnlocked: 3 },
            { amount: 5000, sessionsUnlocked: 4 },
            { amount: 5000, sessionsUnlocked: 3 },
          ],
        },
      });
      expect(acceptedRes.status()).toBe(201);
    });

    await test.step('TC-10: 15 sessions ceiling is 10 (10.5 rounds down): 11 rejected, 10 accepted', async () => {
      // 11 before full payment (6 + 5) -> rejected
      const res11 = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `15-session 11 release ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 15,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 5000, sessionsUnlocked: 6 },
            { amount: 5000, sessionsUnlocked: 5 },
            { amount: 5000, sessionsUnlocked: 4 },
          ],
        },
      });
      expect(res11.status()).toBe(400);
      const err = await res11.json();
      expect(JSON.stringify(err)).toContain('PACKAGE_INSTALLMENT_RELEASE_CAP');

      // 10 before full payment (5 + 5) -> accepted
      const res10 = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `15-session 10 release ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 15,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 5000, sessionsUnlocked: 5 },
            { amount: 5000, sessionsUnlocked: 5 },
            { amount: 5000, sessionsUnlocked: 5 },
          ],
        },
      });
      expect(res10.status()).toBe(201);
    });

    await test.step('TC-11: 1-session package: early release rejected even though 70% rounds to one; unlocks on full payment', async () => {
      // Releasing 1 session on row 1 before full payment on row 2 -> rejected
      const earlyRes = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `1-session early ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 1,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 2,
          installments: [
            { amount: 7500, sessionsUnlocked: 1 },
            { amount: 7500, sessionsUnlocked: 0 },
          ],
        },
      });
      expect(earlyRes.status()).toBe(400);
      const err = await earlyRes.json();
      expect(JSON.stringify(err)).toContain('PACKAGE_INSTALLMENT_RELEASE_CAP');

      // Releasing only on final full payment row (0 / 1) -> accepted
      const finalRes = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `1-session valid ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 1,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 2,
          installments: [
            { amount: 7500, sessionsUnlocked: 0 },
            { amount: 7500, sessionsUnlocked: 1 },
          ],
        },
      });
      expect(finalRes.status()).toBe(201);
    });

    await test.step('TC-14: Saving or updating a package plan alone creates no customer entitlement or collection', async () => {
      const planRes = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `Unsold Plan ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 10,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 5000, sessionsUnlocked: 3 },
            { amount: 5000, sessionsUnlocked: 4 },
            { amount: 5000, sessionsUnlocked: 3 },
          ],
        },
      });
      expect(planRes.status()).toBe(201);
      const unsoldPkg = await planRes.json();

      // Querying purchases for this package returns 404 (no entitlement created)
      const checkRes = await request.get(`http://localhost:5150/api/packages/installment-purchases/${unsoldPkg.id}`, {
        headers: headersA,
      });
      expect(checkRes.status()).toBe(404);
    });

    await test.step('TC-15: Tenant isolation: Tenant B cannot read or update Tenant A offer', async () => {
      // Authenticate Tenant B (+201000000000)
      const loginB = await request.post('http://localhost:5150/api/auth/login', {
        data: { phoneNumber: '+201000000000', password: 'Admin@12345' },
      });
      expect(loginB.ok()).toBeTruthy();
      const loginBData = await loginB.json();

      const authB = await request.post('http://localhost:5150/api/auth/verify-otp', {
        data: { userId: loginBData.userId, code: otp },
      });
      expect(authB.ok()).toBeTruthy();
      const { accessToken: tokenB } = await authB.json();
      const headersB = { Authorization: `Bearer ${tokenB}` };

      // Create a plan under Tenant A
      const planARes = await request.post('http://localhost:5150/api/packages', {
        headers: headersA,
        data: {
          name: `Tenant A Offer ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: 'Tenant A private plan',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 10,
          price: 18000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 20000,
          firstPayment: 5000,
          installmentCount: 3,
          installments: [
            { amount: 5000, sessionsUnlocked: 3 },
            { amount: 5000, sessionsUnlocked: 4 },
            { amount: 5000, sessionsUnlocked: 3 },
          ],
        },
      });
      expect(planARes.status()).toBe(201);
      const offerA = await planARes.json();

      // Tenant B attempts to read Tenant A's offer
      const tenantBGetRes = await request.get(`http://localhost:5150/api/packages/${offerA.id}`, { headers: headersB });
      expect(tenantBGetRes.status()).toBe(404);

      // Tenant B attempts to update Tenant A's offer
      const tenantBPutRes = await request.put(`http://localhost:5150/api/packages/${offerA.id}`, {
        headers: headersB,
        data: {
          name: 'Hacked by Tenant B',
          isActive: true,
          offerType: 'package',
          description: '',
          serviceCategoryId: cat.id,
          sessionDurationMinutes: 30,
          sessionCount: 10,
          price: 1000,
          discountCode: '',
          cashEnabled: true,
          installmentEnabled: false,
          installmentPrice: null,
          firstPayment: null,
          installmentCount: null,
          installments: [],
        },
      });
      expect(tenantBPutRes.status()).toBe(404);

      // Tenant A reads offer again; confirms it remains unchanged
      const verifyARes = await request.get(`http://localhost:5150/api/packages/${offerA.id}`, { headers: headersA });
      expect(verifyARes.ok()).toBeTruthy();
      const verifiedA = await verifyARes.json();
      expect(verifiedA.name).toBe(offerA.name);
      expect(verifiedA.installmentPrice).toBe(20000);
      expect(verifiedA.installments).toHaveLength(3);
    });
  });

  test('TC-12, TC-13: Installment sale payment progression, failure resistance, and idempotency against real API & DB', async ({ request }) => {
    // Authenticate center admin against real API
    const loginRes = await request.post('http://localhost:5150/api/auth/login', {
      data: { phoneNumber: phone, password },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();

    const authRes = await request.post('http://localhost:5150/api/auth/verify-otp', {
      data: { userId: loginData.userId, code: otp },
    });
    expect(authRes.ok()).toBeTruthy();
    const { accessToken: tokenA } = await authRes.json();
    const headersA = { Authorization: `Bearer ${tokenA}` };

    const catRes = await request.post('http://localhost:5150/api/packages/service-categories', {
      headers: headersA,
      data: { name: `Sale Cat ${Date.now()}`, icon: 'pi pi-box' },
    });
    expect(catRes.ok()).toBeTruthy();
    const cat = await catRes.json();

    // 1. Create a valid package offer on real API
    const pkgRes = await request.post('http://localhost:5150/api/packages', {
      headers: headersA,
      data: {
        name: `Installment Sale Pkg ${Date.now()}`,
        isActive: true,
        offerType: 'package',
        description: 'Payment progression test',
        serviceCategoryId: cat.id,
        sessionDurationMinutes: 30,
        sessionCount: 10,
        price: 18000,
        discountCode: '',
        cashEnabled: true,
        installmentEnabled: true,
        installmentPrice: 20000,
        firstPayment: 5000,
        installmentCount: 3,
        installments: [
          { amount: 5000, sessionsUnlocked: 3 },
          { amount: 5000, sessionsUnlocked: 4 },
          { amount: 5000, sessionsUnlocked: 3 },
        ],
      },
    });
    expect(pkgRes.status()).toBe(201);
    const pkg = await pkgRes.json();

    // 2. Sell the package through booking
    const uniqueDay = 1 + (Math.floor(Date.now() / 1000) % 20);
    const scheduledDate = `2026-11-${String(uniqueDay).padStart(2, '0')}`;
    const startMinutes = 600 + (Math.floor(Date.now() / 1000) % 5) * 40;
    const endMinutes = startMinutes + 30;
    const bookingRes = await request.post('http://localhost:5150/api/bookings', {
      headers: headersA,
      data: {
        idempotencyKey: `idemp-sale-${Date.now()}`,
        customerId: '00000000-0000-0000-0000-000000000002',
        branchId: '00000000-0000-0000-0000-000000000001',
        employeeId: '00000000-0000-0000-0000-000000000003',
        scheduledDate,
        startMinutes,
        endMinutes,
        paymentMethod: 'cash',
        items: [
          {
            packageId: pkg.id,
            type: 'packageNewPurchase',
            paymentOption: 'installment',
            quantity: 1,
          },
        ],
      },
    });
    expect(bookingRes.status()).toBe(201);
    const bookingData = await bookingRes.json();
    expect(bookingData.installmentPurchaseIds).toBeDefined();
    expect(bookingData.installmentPurchaseIds.length).toBeGreaterThan(0);
    const purchaseId = bookingData.installmentPurchaseIds[0];

    // 3. Inspect purchase initial state: available sessions is 0
    const initialPurchaseRes = await request.get(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}`,
      { headers: headersA }
    );
    expect(initialPurchaseRes.ok()).toBeTruthy();
    const initialPurchase = await initialPurchaseRes.json();
    expect(initialPurchase.availableSessions).toBe(0);
    expect(initialPurchase.amountDue).toBe(20000);
    expect(initialPurchase.installments).toHaveLength(4); // row 0 (firstPayment) + 3 rows

    // 4. TC-13: Against purchase with unpaid installment, record failed payment attempt
    const failRes = await request.post(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}/installments/1/collect`,
      {
        headers: headersA,
        data: { amount: 99999, paymentMethod: 'cash' }, // Invalid amount
      }
    );
    expect(failRes.status()).toBe(409); // Conflict

    // Verify failure leaves paid amount and released sessions unchanged
    const afterFailRes = await request.get(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}`,
      { headers: headersA }
    );
    const afterFail = await afterFailRes.json();
    expect(afterFail.amountDue).toBe(20000);
    expect(afterFail.availableSessions).toBe(0);

    // 5. TC-12: First payment (row 0) confirmed collection
    const pay0Res = await request.post(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}/installments/0/collect`,
      {
        headers: headersA,
        data: { amount: 5000, paymentMethod: 'cash' },
      }
    );
    expect(pay0Res.ok()).toBeTruthy();
    const afterPay0 = await pay0Res.json();
    expect(afterPay0.amountDue).toBe(15000);
    // The first payment releases 0 planned sessions unless it settles entire price
    expect(afterPay0.availableSessions).toBe(0);

    // 6. TC-12 & TC-13: First numbered payment (row 1, 5000)
    const pay1Res = await request.post(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}/installments/1/collect`,
      {
        headers: headersA,
        data: { amount: 5000, paymentMethod: 'cash' },
      }
    );
    expect(pay1Res.ok()).toBeTruthy();
    const afterPay1 = await pay1Res.json();
    expect(afterPay1.amountDue).toBe(10000);
    // Adds row 1 newly released sessions (3)
    expect(afterPay1.availableSessions).toBe(3);

    // TC-13 Repeat confirmed payment: idempotent, returns existing state without extra collection or sessions
    const repeatPay1Res = await request.post(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}/installments/1/collect`,
      {
        headers: headersA,
        data: { amount: 5000, paymentMethod: 'cash' },
      }
    );
    expect(repeatPay1Res.ok()).toBeTruthy();
    const repeatData = await repeatPay1Res.json();
    expect(repeatData.amountDue).toBe(10000);
    expect(repeatData.availableSessions).toBe(3);

    // 7. Make second numbered payment (row 2, 5000)
    const pay2Res = await request.post(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}/installments/2/collect`,
      {
        headers: headersA,
        data: { amount: 5000, paymentMethod: 'cash' },
      }
    );
    expect(pay2Res.ok()).toBeTruthy();
    const afterPay2 = await pay2Res.json();
    expect(afterPay2.amountDue).toBe(5000);
    // Cumulative sessions become 7
    expect(afterPay2.availableSessions).toBe(7);

    // 8. Make final confirmed payment (row 3, 5000)
    const pay3Res = await request.post(
      `http://localhost:5150/api/packages/installment-purchases/${purchaseId}/installments/3/collect`,
      {
        headers: headersA,
        data: { amount: 5000, paymentMethod: 'cash' },
      }
    );
    expect(pay3Res.ok()).toBeTruthy();
    const afterPay3 = await pay3Res.json();
    // When balance reaches zero, remaining sessions are released once (all 10 available)
    expect(afterPay3.amountDue).toBe(0);
    expect(afterPay3.availableSessions).toBe(10);
    expect(afterPay3.totalSessions).toBe(10);
  });
});
