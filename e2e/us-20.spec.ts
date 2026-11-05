import { expect, test } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eAccount, e2eIds, queryE2eDatabase } from './e2e-fixtures';

test.describe('US-20: selected customer purchase statement', () => {
  test('shows the saved purchase, collections, and completed execution only', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const scope = queryE2eDatabase(`SELECT CONCAT(p.SaleId, '|', s.BranchId)
      FROM dbo.CustomerPackages p JOIN dbo.Sales s ON p.SaleId = s.Id
      WHERE p.Id = '${e2eIds.statementPurchase}' AND p.TenantId = '${e2eIds.tenantA}'`);
    expect(scope).toBe(`${e2eIds.statementSale}|${e2eIds.branch}`);

    const response = await request.get(
      `${apiBaseUrl}/customers/${e2eIds.customer}/purchases/${e2eIds.statementPurchase}/statement`,
      { headers }
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const statement = await response.json();
    expect(statement).toMatchObject({
      customerId: e2eIds.customer,
      serviceName: 'E2E US-20 Saved Statement Package',
      serviceType: 'package',
      purchase: {
        id: e2eIds.statementPurchase,
        purchasePrice: 2000,
        amountPaid: 1000,
        amountRemaining: 1000,
        paymentStatus: 'partial',
        completedSessions: [
          expect.objectContaining({
            sessionNumber: 1,
            performer: 'US-08 Test Staff',
            notes: 'US-20 completed execution',
          }),
        ],
      },
      sessionBalance: { total: 10, used: 1, remaining: 9, bookable: 1 },
      firstPayment: { amount: 500, paymentMethod: 'cash', recordedBy: 'US-07 Test Employee' },
      installments: [
        expect.objectContaining({
          number: 1,
          amount: 500,
          status: 'paid',
          paymentMethod: 'cash',
          recordedBy: 'US-08 Test Staff',
        }),
        expect.objectContaining({ number: 2, amount: 500, status: 'due', paidAtUtc: null }),
        expect.objectContaining({ number: 3, amount: 500, status: 'due', paidAtUtc: null }),
      ],
    });
    expect(statement.firstPayment.paidAtUtc).toBeTruthy();
    expect(statement.installments[0].paidAtUtc).toBeTruthy();
    expect(statement.purchase.completedSessions).toHaveLength(1);
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.BookingPackageReservations
      WHERE TenantId = '${e2eIds.tenantA}' AND CustomerPackageId = '${e2eIds.statementPurchase}'`)
    ).toBe('3');
  });

  test('does not expose the selected purchase through another tenant', async ({ request }) => {
    const headers = await authenticate(request, e2eAccount.tenantBPhone);
    const response = await request.get(
      `${apiBaseUrl}/customers/${e2eIds.customer}/purchases/${e2eIds.statementPurchase}/statement`,
      { headers }
    );
    expect(response.status()).toBe(404);
  });
});
