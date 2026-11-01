import { expect, type APIRequestContext } from '@playwright/test';

export const apiBaseUrl = 'http://localhost:5151/api';

export const e2eAccount = {
  ownerPhone: '+201000000071',
  tenantBPhone: '+201000000072',
  staffPhone: '+201000000075',
  customerMobile: '+201000000074',
  password: process.env.OPERIA_E2E_PASSWORD!,
  otp: process.env.OPERIA_E2E_OTP!,
} as const;

export const e2eIds = {
  tenantA: 'e2e70000-0000-4000-8000-000000000001',
  branch: 'e2e70000-0000-4000-8000-000000000004',
  customer: 'e2e70000-0000-4000-8000-000000000006',
  category: 'e2e70000-0000-4000-8000-000000000017',
  staffUser: 'e2e70000-0000-4000-8000-000000000018',
  staffEmployee: 'e2e70000-0000-4000-8000-000000000019',
  allStaffOffer: 'e2e70000-0000-4000-8000-000000000030',
  selectedStaffOffer: 'e2e70000-0000-4000-8000-000000000031',
  pulseOffer: 'e2e70000-0000-4000-8000-000000000032',
  inquiryPurchaseA: 'e2e70000-0000-4000-8000-000000000040',
  inquiryPurchaseB: 'e2e70000-0000-4000-8000-000000000041',
  detailPurchase: 'e2e70000-0000-4000-8000-000000000042',
  pulsePurchase: 'e2e70000-0000-4000-8000-000000000043',
  completedBooking: 'e2e70000-0000-4000-8000-000000000060',
} as const;

export async function authenticate(
  request: APIRequestContext,
  phoneNumber = e2eAccount.ownerPhone
): Promise<Record<string, string>> {
  const login = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { phoneNumber, password: e2eAccount.password },
  });
  expect(login.ok()).toBeTruthy();
  const loginData = await login.json();

  const verification = await request.post(`${apiBaseUrl}/auth/verify-otp`, {
    data: { userId: loginData.userId, code: e2eAccount.otp },
  });
  expect(verification.ok()).toBeTruthy();
  const { accessToken } = await verification.json();
  return { Authorization: `Bearer ${accessToken}` };
}
