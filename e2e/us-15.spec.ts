import { expect, test } from '@playwright/test';
import {
  apiBaseUrl,
  authenticate,
  e2eAccount,
  e2eIds,
  performUiLogin,
  queryE2eDatabase,
} from './e2e-fixtures';
import { createServiceBooking, expectCode, futureDate } from './us-13-15-helpers';

test.describe('US-15: booking customer paths', () => {
  test('keeps an unlisted service in the booking draft rather than the catalog', async ({
    page,
  }) => {
    await performUiLogin(page);
    await page.goto('/bookings');
    await page.locator('.four-day-head button').last().click();
    const slot = page.locator('button.available-overlay').first();
    await expect(slot).toBeVisible({ timeout: 30_000 });
    await slot.click();
    const dialog = page.locator('.bookings-book-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Direct customer', exact: true }).click();
    await dialog.getByRole('button', { name: /unlisted/i }).click();
    const unlisted = page.locator('.booking-unlisted-dialog');
    await expect(unlisted).toBeVisible();
    await unlisted.locator('#book-unlisted-name').fill('US-15 One-time Service');
    await unlisted.locator('#book-unlisted-price').fill('125');
    await unlisted.locator('#book-unlisted-duration').fill('20');
    await unlisted.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog.locator('.selected-table')).toContainText('US-15 One-time Service');
    expect(
      queryE2eDatabase(
        `SELECT COUNT(*) FROM dbo.Packages WHERE TenantId = '${e2eIds.tenantA}' AND Name = 'US-15 One-time Service';`
      )
    ).toBe('0');

    await dialog.getByRole('button', { name: 'Edit unlisted service' }).click();
    await unlisted.locator('#book-unlisted-price').fill('150');
    await unlisted.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.locator('.selected-table')).toContainText('150');
    expect(
      queryE2eDatabase(
        `SELECT COUNT(*) FROM dbo.Packages WHERE TenantId = '${e2eIds.tenantA}' AND Name = 'US-15 One-time Service';`
      )
    ).toBe('0');

    await dialog.locator('.payment-grid button').first().click();
    const confirm = page.waitForResponse(
      response =>
        response.url().endsWith('/sales/confirm') && response.request().method() === 'POST'
    );
    await dialog.locator('.confirm-btn').click();
    const confirmation = await confirm;
    expect(confirmation.ok(), await confirmation.text()).toBeTruthy();
    const sale = await confirmation.json();
    const booked = page.waitForResponse(
      response => response.url().endsWith('/sales/book') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Payment collected', exact: true }).click();
    expect((await booked).ok()).toBeTruthy();
    expect(
      queryE2eDatabase(`SELECT CONCAT(
      (SELECT COUNT(*) FROM dbo.Packages WHERE TenantId = '${e2eIds.tenantA}' AND Name = 'US-15 One-time Service'), '|',
      (SELECT COUNT(*) FROM dbo.Sales WHERE Id = '${sale.saleId}' AND ItemsSnapshotJson LIKE '%US-15 One-time Service%'), '|',
      (SELECT COUNT(*) FROM dbo.Bookings WHERE SaleId = '${sale.saleId}'));`)
    ).toBe('0|1|1');
  });
  test('finds a registered customer by name and mobile before booking', async ({ request }) => {
    const headers = await authenticate(request);
    const byName = await request.get(`${apiBaseUrl}/bookings/customers/search?term=US-07`, {
      headers,
    });
    expect(byName.ok()).toBeTruthy();
    expect(await byName.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: e2eIds.customer,
          mobileNumber: e2eAccount.customerMobile,
        }),
      ])
    );
    const byMobile = await request.get(
      `${apiBaseUrl}/bookings/customers/by-mobile?mobile=${encodeURIComponent(e2eAccount.customerMobile)}`,
      { headers }
    );
    expect(byMobile.ok()).toBeTruthy();
    expect(await byMobile.json()).toMatchObject({ id: e2eIds.customer });
    const booked = await createServiceBooking(request, headers, {
      key: 'e2e-us15-registered-booking',
      customerId: e2eIds.customer,
      date: futureDate(22),
      startMinutes: 540,
    });
    expect(booked.status(), await booked.text()).toBe(201);
    const booking = await booked.json();
    expect(booking.status).toBe('Booked');
    expect(
      queryE2eDatabase(`SELECT CONCAT(CustomerId, '|', BranchId, '|', EmployeeId)
        FROM dbo.Bookings WHERE Id = '${booking.id}';`)
    ).toBe(`${e2eIds.customer}|${e2eIds.branch}|${e2eIds.staffEmployee}`);
  });

  test('registers a new customer through the API before booking and rejects a normalized duplicate', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const created = await request.post(`${apiBaseUrl}/customers/registration`, {
      headers,
      data: { fullName: 'US-15 New Customer', mobileNumber: '+201000000093' },
    });
    expect(created.status(), await created.text()).toBe(201);
    const customer = await created.json();
    expect(customer.id).toBeTruthy();
    const duplicate = await request.post(`${apiBaseUrl}/customers/registration`, {
      headers,
      data: { fullName: 'Duplicate', mobileNumber: '01000000093' },
    });
    await expectCode(duplicate, 409, 'BookingCustomerMobileExists');
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Customers
        WHERE TenantId = '${e2eIds.tenantA}'
          AND NormalizedMobileNumber IN ('201000000093', '01000000093');`)
    ).toBe('1');
    const booked = await createServiceBooking(request, headers, {
      key: 'e2e-us15-new-booking',
      customerId: customer.id,
      date: futureDate(23),
      startMinutes: 570,
    });
    expect(booked.status(), await booked.text()).toBe(201);
    const booking = await booked.json();
    expect(
      queryE2eDatabase(`SELECT CustomerId FROM dbo.Bookings WHERE Id = '${booking.id}';`)
    ).toBe(customer.id);
  });

  test('keeps an invalid registration from creating a booking', async ({ request }) => {
    const headers = await authenticate(request);
    const before = queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Bookings
      WHERE TenantId = '${e2eIds.tenantA}' AND IdempotencyKey = 'e2e-us15-invalid-new';`);
    const invalid = await request.post(`${apiBaseUrl}/customers/registration`, {
      headers,
      data: { fullName: '', mobileNumber: '+201000000094' },
    });
    expect(invalid.ok()).toBeFalsy();
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Customers
        WHERE TenantId = '${e2eIds.tenantA}' AND NormalizedMobileNumber = '201000000094';`)
    ).toBe('0');
    const booking = await createServiceBooking(request, headers, {
      key: 'e2e-us15-invalid-new',
      customerId: null,
      date: futureDate(24),
      startMinutes: 600,
    });
    expect(booking.ok()).toBeFalsy();
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Bookings
        WHERE TenantId = '${e2eIds.tenantA}' AND IdempotencyKey = 'e2e-us15-invalid-new';`)
    ).toBe(before);
  });

  test('books a direct customer without personal fields or an owned package', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const invalid = await request.post(`${apiBaseUrl}/bookings`, {
      headers,
      data: {
        idempotencyKey: 'e2e-us15-direct-owned-refused',
        customerId: null,
        directCustomer: true,
        branchId: e2eIds.branch,
        employeeId: e2eIds.staffEmployee,
        scheduledDate: futureDate(25),
        startMinutes: 630,
        endMinutes: 670,
        items: [
          {
            packageId: e2eIds.ownedSessionOffer,
            customerPackageId: e2eIds.ownedSessionPurchase,
            quantity: 1,
          },
        ],
      },
    });
    await expectCode(invalid, 409, 'BookingDirectCustomerPackageUnavailable');
    const booked = await createServiceBooking(request, headers, {
      key: 'e2e-us15-direct-booking',
      directCustomer: true,
      date: futureDate(25),
      startMinutes: 630,
    });
    expect(booked.status(), await booked.text()).toBe(201);
    const booking = await booked.json();
    expect(
      queryE2eDatabase(`SELECT CONCAT(CAST(c.IsDirect AS int), '|', LEN(b.CustomerMobile), '|',
        (SELECT COUNT(*) FROM dbo.BookingPackageReservations r WHERE r.BookingId = b.Id))
        FROM dbo.Bookings b JOIN dbo.Customers c ON c.Id = b.CustomerId
        WHERE b.Id = '${booking.id}';`)
    ).toBe('1|0|0');
  });
});
