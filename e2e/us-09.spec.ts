import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds } from './e2e-fixtures';

test.describe('US-09: Find the customer and distinct purchases', () => {
  test('keeps repeated purchases distinct and reads their saved offer snapshots', async ({
    request,
  }) => {
    const headers = await authenticate(request);

    const offerResponse = await request.get(`${apiBaseUrl}/packages/${e2eIds.allStaffOffer}`, {
      headers,
    });
    expect(offerResponse.ok()).toBeTruthy();
    const offer = await offerResponse.json();

    const updateResponse = await request.put(`${apiBaseUrl}/packages/${e2eIds.allStaffOffer}`, {
      headers,
      data: {
        name: `Changed after sale ${Date.now()}`,
        isActive: true,
        offerType: 'package',
        description: offer.description,
        serviceCategoryId: e2eIds.category,
        subServiceCategoryId: null,
        sessionDurationMinutes: 30,
        sessionCount: 4,
        pulseCount: null,
        packageExpiryMonths: 12,
        price: 1900,
        discountCode: '',
        discountPercent: null,
        cashEnabled: true,
        installmentEnabled: false,
        installmentPrice: null,
        firstPayment: null,
        installmentCount: null,
        installments: [],
        allStaff: true,
        staffIds: [],
      },
    });
    expect(updateResponse.ok()).toBeTruthy();

    const inquiryResponse = await request.get(`${apiBaseUrl}/customers/inquiry`, {
      headers,
      params: { mobile: e2eAccount.customerMobile },
    });
    expect(inquiryResponse.ok()).toBeTruthy();
    const inquiry = await inquiryResponse.json();
    expect(inquiry.customerId).toBe(e2eIds.customer);
    expect(inquiry.operationCount).toBe(inquiry.purchases.length);
    expect(inquiry.operationCount).toBeGreaterThanOrEqual(4);

    const repeatedPurchases = inquiry.purchases.filter((purchase: { id: string }) =>
      [e2eIds.inquiryPurchaseA, e2eIds.inquiryPurchaseB].includes(purchase.id)
    );
    expect(repeatedPurchases).toHaveLength(2);
    expect(repeatedPurchases.map((purchase: { id: string }) => purchase.id)).toEqual(
      expect.arrayContaining([e2eIds.inquiryPurchaseA, e2eIds.inquiryPurchaseB])
    );
    expect(
      repeatedPurchases.every(
        (purchase: { offerName: string }) => purchase.offerName === 'E2E Inquiry Package'
      )
    ).toBeTruthy();
    expect(repeatedPurchases.map((purchase: { status: string }) => purchase.status)).toEqual(
      expect.arrayContaining(['active', 'cancelled'])
    );
  });

  test('returns no result without retaining another tenant or customer record', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const response = await request.get(`${apiBaseUrl}/customers/inquiry`, {
      headers,
      params: { mobile: '+201099999999' },
    });
    expect(response.ok()).toBeTruthy();
    expect(await response.body()).toHaveLength(0);
  });
});
