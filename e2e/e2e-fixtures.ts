import { execFileSync } from 'node:child_process';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

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
  cashServiceOffer: 'e2e70000-0000-4000-8000-000000000070',
  saleInstallmentOffer: 'e2e70000-0000-4000-8000-000000000071',
  staleSaleOffer: 'e2e70000-0000-4000-8000-000000000072',
  ownedSessionOffer: 'e2e70000-0000-4000-8000-000000000073',
  collectionOffer: 'e2e70000-0000-4000-8000-000000000074',
  directServiceOffer: 'e2e70000-0000-4000-8000-000000000089',
  bookingServiceOffer: 'e2e70000-0000-4000-8000-000000000090',
  pendingSuccessSale: 'e2e70000-0000-4000-8000-000000000091',
  pendingFailureSale: 'e2e70000-0000-4000-8000-000000000092',
  workingStaffEmployee: 'e2e70000-0000-4000-8000-000000000111',
  offStaffEmployee: 'e2e70000-0000-4000-8000-000000000113',
  branchStaffEmployee: 'e2e70000-0000-4000-8000-000000000115',
  secondaryBranch: 'e2e70000-0000-4000-8000-000000000116',
  durationLongOffer: 'e2e70000-0000-4000-8000-000000000130',
  assignedStaffOffer: 'e2e70000-0000-4000-8000-000000000131',
  legacyUnassignedOffer: 'e2e70000-0000-4000-8000-000000000132',
  bookingCollectionSuccessSale: 'e2e70000-0000-4000-8000-000000000150',
  bookingCollectionFailureSale: 'e2e70000-0000-4000-8000-000000000151',
  gridCustomer: 'e2e70000-0000-4000-8000-000000000160',
  gridBaselineSale: 'e2e70000-0000-4000-8000-000000000161',
  gridBaselinePurchase: 'e2e70000-0000-4000-8000-000000000162',
  gridMutationSale: 'e2e70000-0000-4000-8000-000000000164',
  tenantBGridSale: 'e2e70000-0000-4000-8000-000000000174',
  ownedSessionPurchase: 'e2e70000-0000-4000-8000-000000000081',
  uiCollectionPurchase: 'e2e70000-0000-4000-8000-000000000082',
  apiCollectionPurchase: 'e2e70000-0000-4000-8000-000000000083',
  lockedCollectionPurchase: 'e2e70000-0000-4000-8000-000000000084',
  finalCollectionPurchase: 'e2e70000-0000-4000-8000-000000000085',
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

export async function performUiLogin(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('operia_lang', 'en'));
  await page.goto('/auth/login');
  await page.locator('#loginPhone').fill(e2eAccount.ownerPhone);
  await page.locator('#password').fill(e2eAccount.password);
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator('#loginOtpCode-0')).toBeVisible({ timeout: 20_000 });
  await page.locator('#loginOtpCode-0').click();
  await page.keyboard.type(e2eAccount.otp);
  await page.locator('app-otp-verification button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export function queryE2eDatabase(query: string): string {
  const output = execFileSync(
    'sqlcmd',
    [
      '-S',
      '(localdb)\\OperiaDev',
      '-d',
      'Operia_Dev',
      '-E',
      '-b',
      '-w',
      '65535',
      '-y',
      '0',
      '-Q',
      `SET NOCOUNT ON; ${query}`,
    ],
    { encoding: 'utf8', timeout: 10_000 }
  );
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .at(-1)!;
}
