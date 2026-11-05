import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { apiBaseUrl, e2eIds } from './e2e-fixtures';

type Headers = Record<string, string>;

export function catalogItem(offerId: string, paymentOption: 'cash' | 'installment' = 'cash') {
  return {
    offerId,
    ownedCustomerPackageId: null,
    unlistedName: null,
    unlistedPrice: null,
    unlistedDurationMinutes: null,
    paymentOption,
    quantity: 1,
  };
}

export async function expectCode(response: APIResponse, status: number, code: string) {
  expect(response.status()).toBe(status);
  const body = await response.json();
  const codes = Object.values(body.errorCodes ?? {}).flatMap(value =>
    Array.isArray(value) ? value : [value]
  );
  expect(codes).toContain(code);
}

export async function confirmQuotedSale(
  request: APIRequestContext,
  headers: Headers,
  options: {
    key: string;
    customerId?: string | null;
    directCustomer?: boolean;
    offerId: string;
    paymentOption?: 'cash' | 'installment';
    disposition?: 'Close' | 'Later' | 'BookNow';
  }
) {
  const items = [catalogItem(options.offerId, options.paymentOption)];
  const input = {
    customerId: options.customerId ?? null,
    directCustomer: options.directCustomer ?? false,
    branchId: e2eIds.branch,
    items,
  };
  const quote = await request.post(`${apiBaseUrl}/sales/quote`, { headers, data: input });
  expect(quote.ok(), await quote.text()).toBeTruthy();
  const priced = await quote.json();
  const confirmation = {
    ...input,
    paymentMethod: priced.dueNow > 0 ? 'cash' : null,
    expectedGrandTotal: priced.grandTotal,
    expectedDueNow: priced.dueNow,
    idempotencyKey: options.key,
    disposition: options.disposition ?? 'Later',
  };
  const response = await request.post(`${apiBaseUrl}/sales/confirm`, {
    headers,
    data: confirmation,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return { quote: priced, confirmation, sale: await response.json() };
}

export function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export async function createServiceBooking(
  request: APIRequestContext,
  headers: Headers,
  options: {
    key: string;
    customerId?: string | null;
    directCustomer?: boolean;
    date: string;
    startMinutes: number;
  }
) {
  return request.post(`${apiBaseUrl}/bookings`, {
    headers,
    data: {
      idempotencyKey: options.key,
      customerId: options.customerId ?? null,
      directCustomer: options.directCustomer ?? false,
      branchId: e2eIds.branch,
      employeeId: e2eIds.staffEmployee,
      scheduledDate: options.date,
      startMinutes: options.startMinutes,
      endMinutes: options.startMinutes + 30,
      items: [{ packageId: e2eIds.bookingServiceOffer, customerPackageId: null, quantity: 1 }],
      paymentMethod: null,
    },
  });
}
