import { expect, test } from '@playwright/test';

const categoryId = '00000000-0000-4000-8000-000000000006';
const offerId = '00000000-0000-4000-8000-000000000007';

test('US-06 offer pricing editor with authenticated account and controlled offer API', async ({
  page,
}) => {
  const phone = process.env.OPERIA_E2E_PHONE;
  const password = process.env.OPERIA_E2E_PASSWORD;
  const otp = process.env.OPERIA_E2E_OTP;
  test.skip(
    !phone || !password || !otp,
    'Set OPERIA_E2E_PHONE, OPERIA_E2E_PASSWORD, and OPERIA_E2E_OTP.'
  );

  await page.goto('/auth/login');
  await page.locator('#loginPhone').fill(phone!);
  await page.locator('#password').fill(password!);
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator('#loginOtpCode-0')).toBeVisible();
  await page.locator('#loginOtpCode-0').click();
  await page.keyboard.type(otp!);
  await page.locator('app-otp-verification button[type="submit"]').click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding\/(setup|plan))/);

  // An account still in onboarding can exercise the editor with a controlled
  // status response. Active accounts keep their real onboarding response.
  if (page.url().includes('/onboarding/')) {
    await page.route('**/api/onboarding/status', async route => {
      const response = await route.fetch();
      const status = await response.json();
      await route.fulfill({ response, json: { ...status, step: 4 } });
    });
  }

  let savedOffer: Record<string, unknown> | null = null;
  const submitted: Record<string, unknown>[] = [];
  await page.route('**/api/packages**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/service-categories')) {
      return json([{ id: categoryId, name: 'Playwright category', icon: 'pi pi-box' }]);
    }
    if (path.endsWith('/sub-service-categories')) {
      return json([]);
    }
    if (request.method() === 'POST' && path.endsWith('/packages')) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      submitted.push(payload);
      savedOffer = {
        ...payload,
        id: offerId,
        status: payload['isActive'] ? 'active' : 'cancelled',
        serviceCategoryName: 'Playwright category',
        createdAt: '2026-10-29T00:00:00Z',
        endsAt: null,
        cashPriceAfterDiscount:
          Number(payload['price']) * (1 - Number(payload['discountPercent'] ?? 0) / 100),
      };
      return json(savedOffer);
    }
    if (request.method() === 'PUT' && path.endsWith(`/packages/${offerId}`)) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      submitted.push(payload);
      savedOffer = {
        ...savedOffer,
        ...payload,
        status: payload['isActive'] ? 'active' : 'cancelled',
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

  await page.goto('/packages');
  await expect(page.locator('.packages-page')).toBeVisible();
  await page.locator('.page-head p-button button').click();
  await page.locator('.offer-type-card[aria-checked="false"]').click();
  await page.locator('.editor [formcontrolname="name"]').fill('US-06 Playwright offer');
  await page.locator('.editor [formcontrolname="sessionCount"]').fill('5');
  await page.locator('.editor [formcontrolname="serviceCategoryId"]').click();
  await page
    .locator('.p-dropdown-panel .p-dropdown-item')
    .filter({ hasText: 'Playwright category' })
    .click();

  await test.step('TC-03: cash discount preview uses only cash price', async () => {
    await page.locator('.editor [formcontrolname="price"] input').fill('18000');
    await page
      .locator('.editor [formcontrolname="installmentEnabled"] .p-inputswitch-slider')
      .click();
    await page.locator('.editor [formcontrolname="installmentPrice"] input').fill('20000');
    await page.locator('.editor .discount-toggle').click();
    await page.locator('.editor [formcontrolname="discountPercent"]').fill('10');
    await expect(page.locator('.editor .readonly input')).toHaveValue('16,200.00');
    await expect(page.locator('.editor [formcontrolname="installmentPrice"] input')).toHaveValue(
      '20,000'
    );
  });

  await test.step('TC-04: invalid discount and cash price show field errors and block save', async () => {
    await page.locator('.editor [formcontrolname="discountPercent"]').fill('101');
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(page.locator('.editor .discount-metrics .field-error')).toBeVisible();
    expect(submitted).toHaveLength(0);
    await page.locator('.editor [formcontrolname="discountPercent"]').fill('10');
    await page.locator('.editor [formcontrolname="price"] input').fill('-1');
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(
      page.locator('.editor .form-field:has([formcontrolname="price"]) .field-error')
    ).toBeVisible();
    expect(submitted).toHaveLength(0);
    await page.locator('.editor [formcontrolname="price"] input').fill('18000');
  });

  await test.step('TC-01: both prices and discount are sent independently and read back', async () => {
    await page.locator('.editor [formcontrolname="discountCode"]').fill('CASH10');
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(page.locator('.editor')).toHaveCount(0);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      price: 18000,
      cashEnabled: true,
      installmentEnabled: true,
      installmentPrice: 20000,
      discountPercent: 10,
      discountCode: 'CASH10',
    });
    await page.locator('.packages-table tbody .table-icon-btn.edit').click();
    await expect(page.locator('.editor [formcontrolname="price"] input')).toHaveValue('18,000');
    await expect(page.locator('.editor [formcontrolname="installmentPrice"] input')).toHaveValue(
      '20,000'
    );
    await expect(page.locator('.editor .readonly input')).toHaveValue('16,200.00');
  });

  await test.step('TC-02: cash may be disabled while installments remain enabled', async () => {
    await page.locator('.editor [formcontrolname="cashEnabled"] .p-inputswitch-slider').click();
    await expect(
      page.locator('.editor [formcontrolname="installmentEnabled"] input')
    ).toHaveAttribute('aria-checked', 'true');
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(page.locator('.editor')).toHaveCount(0);
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toMatchObject({
      cashEnabled: false,
      installmentEnabled: true,
      installmentPrice: 20000,
    });
    await page.locator('.packages-table tbody .table-icon-btn.edit').click();
    await expect(page.locator('.editor [formcontrolname="cashEnabled"] input')).toHaveAttribute(
      'aria-checked',
      'false'
    );
    await page
      .locator('.editor [formcontrolname="installmentEnabled"] .p-inputswitch-slider')
      .click();
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(page.locator('.editor .payment-option:first-child .field-error')).toBeVisible();
    expect(submitted).toHaveLength(2);
  });

  await test.step('TC-07: enabled installments require a positive price', async () => {
    await page
      .locator('.editor [formcontrolname="installmentEnabled"] .p-inputswitch-slider')
      .click();
    await page.locator('.editor [formcontrolname="installmentPrice"] input').fill('0');
    await page.locator('.editor footer button[type="submit"]').click();
    await expect(
      page.locator('.editor .form-field:has([formcontrolname="installmentPrice"]) .field-error')
    ).toBeVisible();
    expect(submitted).toHaveLength(2);
  });
});
