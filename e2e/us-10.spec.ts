import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eIds } from './e2e-fixtures';

test.describe('US-10: Saved balances, installments, and execution history', () => {
  test('reads session and installment details from the saved purchase after a real offer update', async ({
    request,
  }) => {
    const headers = await authenticate(request);

    const updateResponse = await request.put(
      `${apiBaseUrl}/packages/${e2eIds.selectedStaffOffer}`,
      {
        headers,
        data: {
          name: `Current catalog terms ${Date.now()}`,
          isActive: true,
          offerType: 'package',
          description: 'Changed after the seeded sale',
          serviceCategoryId: e2eIds.category,
          subServiceCategoryId: null,
          sessionDurationMinutes: 45,
          sessionCount: 10,
          pulseCount: null,
          packageExpiryMonths: 6,
          price: 2100,
          discountCode: '',
          discountPercent: null,
          cashEnabled: true,
          installmentEnabled: true,
          installmentPrice: 2500,
          firstPayment: 700,
          installmentCount: 3,
          installments: [
            { amount: 600, sessionsUnlocked: 3 },
            { amount: 600, sessionsUnlocked: 3 },
            { amount: 600, sessionsUnlocked: 4 },
          ],
          allStaff: false,
          staffIds: [e2eIds.staffEmployee],
        },
      }
    );
    expect(updateResponse.ok()).toBeTruthy();

    const detailResponse = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.detailPurchase}/inquiry`,
      { headers }
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detail = await detailResponse.json();
    expect(detail).toMatchObject({
      id: e2eIds.detailPurchase,
      purchasePrice: 2000,
      amountPaid: 500,
      amountRemaining: 1500,
      paymentStatus: 'partial',
      nextInstallmentNumber: 1,
      installmentCount: 3,
      sessions: { total: 3, used: 1, remaining: 2 },
      pulses: null,
    });
    expect(detail.installments).toEqual([
      { number: 1, amount: 500, status: 'due' },
      { number: 2, amount: 500, status: 'due' },
      { number: 3, amount: 500, status: 'due' },
    ]);
    expect(detail.completedSessions).toHaveLength(1);
    expect(detail.completedSessions[0]).toMatchObject({
      sessionNumber: 1,
      performer: 'US-08 Test Staff',
      pulsesUsed: null,
      notes: 'US-10 seeded execution',
    });
  });

  test('shows an independent pulse balance and no fabricated execution history', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const response = await request.get(
      `${apiBaseUrl}/customers/purchases/${e2eIds.pulsePurchase}/inquiry`,
      { headers }
    );
    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      id: e2eIds.pulsePurchase,
      sessions: null,
      pulses: { total: 8000, used: 2500, remaining: 5500 },
      purchasePrice: 800,
      amountPaid: 800,
      amountRemaining: 0,
      paymentStatus: 'paid',
      installments: [],
      completedSessions: [],
    });
  });
});
