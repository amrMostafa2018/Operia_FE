import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eIds } from './e2e-fixtures';

const packageInput = (name: string, allStaff: boolean, staffIds: string[]) => ({
  name,
  isActive: true,
  offerType: 'package',
  description: 'US-08 real API E2E offer',
  serviceCategoryId: e2eIds.category,
  subServiceCategoryId: null,
  sessionDurationMinutes: 30,
  sessionCount: 4,
  pulseCount: null,
  packageExpiryMonths: 12,
  price: 1200,
  discountCode: '',
  discountPercent: null,
  cashEnabled: true,
  installmentEnabled: false,
  installmentPrice: null,
  firstPayment: null,
  installmentCount: null,
  installments: [],
  allStaff,
  staffIds,
});

test.describe('US-08: Purchase snapshot and available staff prerequisites', () => {
  test('creates All Staff and selected-staff offers through the real API', async ({ request }) => {
    const headers = await authenticate(request);

    const staffResponse = await request.get(`${apiBaseUrl}/packages/available-staff`, { headers });
    expect(staffResponse.ok()).toBeTruthy();
    await expect(staffResponse.json()).resolves.toContainEqual({
      id: e2eIds.staffEmployee,
      fullName: 'US-08 Test Staff',
    });

    const allStaffResponse = await request.post(`${apiBaseUrl}/packages`, {
      headers,
      data: packageInput(`US-08 All Staff ${Date.now()}`, true, []),
    });
    expect(allStaffResponse.status()).toBe(201);
    const allStaffOffer = await allStaffResponse.json();
    expect(allStaffOffer).toMatchObject({ allStaff: true, staffIds: [] });

    const selectedResponse = await request.post(`${apiBaseUrl}/packages`, {
      headers,
      data: packageInput(`US-08 Selected Staff ${Date.now()}`, false, [e2eIds.staffEmployee]),
    });
    expect(selectedResponse.status()).toBe(201);
    const selectedOffer = await selectedResponse.json();
    expect(selectedOffer).toMatchObject({
      allStaff: false,
      staffIds: [e2eIds.staffEmployee],
    });

    const updateResponse = await request.put(`${apiBaseUrl}/packages/${allStaffOffer.id}`, {
      headers,
      data: packageInput(allStaffOffer.name, false, [e2eIds.staffEmployee]),
    });
    expect(updateResponse.ok()).toBeTruthy();
    await expect(updateResponse.json()).resolves.toMatchObject({
      allStaff: false,
      staffIds: [e2eIds.staffEmployee],
    });
  });
});
