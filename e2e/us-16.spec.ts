import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl, authenticate, e2eIds, queryE2eDatabase } from './e2e-fixtures';
import { expectCode, futureDate } from './us-13-15-helpers';

type Headers = Record<string, string>;

function bookingInput(options: {
  key: string;
  date: string;
  employeeId: string;
  startMinutes: number;
  endMinutes: number;
  offerIds: string[];
  branchId?: string;
}) {
  return {
    idempotencyKey: options.key,
    customerId: e2eIds.customer,
    branchId: options.branchId ?? e2eIds.branch,
    employeeId: options.employeeId,
    scheduledDate: options.date,
    startMinutes: options.startMinutes,
    endMinutes: options.endMinutes,
    items: options.offerIds.map(packageId => ({
      packageId,
      customerPackageId: null,
      quantity: 1,
    })),
    paymentMethod: null,
  };
}

async function eligibleEmployees(
  request: APIRequestContext,
  headers: Headers,
  options: {
    branchId: string;
    date: string;
    startMinutes: number;
    endMinutes: number;
    offerId: string;
  }
) {
  const response = await request.post(`${apiBaseUrl}/bookings/eligible-employees`, {
    headers,
    data: {
      branchId: options.branchId,
      scheduledDate: options.date,
      startMinutes: options.startMinutes,
      endMinutes: options.endMinutes,
      items: [{ packageId: options.offerId, customerPackageId: null, quantity: 1 }],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test.describe('US-16: duration, employee eligibility, and conflicts', () => {
  test('intersects offer assignment, schedule, branch, and an active hold', async ({ request }) => {
    const headers = await authenticate(request);
    const date = futureDate(198);

    const assigned = await eligibleEmployees(request, headers, {
      branchId: e2eIds.branch,
      date,
      startMinutes: 480,
      endMinutes: 510,
      offerId: e2eIds.assignedStaffOffer,
    });
    expect(assigned).toEqual([expect.objectContaining({ id: e2eIds.staffEmployee })]);

    const unassigned = await eligibleEmployees(request, headers, {
      branchId: e2eIds.branch,
      date,
      startMinutes: 480,
      endMinutes: 510,
      offerId: e2eIds.legacyUnassignedOffer,
    });
    expect(unassigned.map((employee: { id: string }) => employee.id)).toEqual([
      e2eIds.staffEmployee,
      e2eIds.workingStaffEmployee,
    ]);

    const secondaryBranch = await eligibleEmployees(request, headers, {
      branchId: e2eIds.secondaryBranch,
      date,
      startMinutes: 480,
      endMinutes: 510,
      offerId: e2eIds.legacyUnassignedOffer,
    });
    expect(secondaryBranch).toEqual([expect.objectContaining({ id: e2eIds.branchStaffEmployee })]);
    expect(secondaryBranch.map((employee: { id: string }) => employee.id)).not.toContain(
      e2eIds.staffEmployee
    );
    const wrongBranch = await request.post(`${apiBaseUrl}/bookings`, {
      headers,
      data: bookingInput({
        key: 'e2e-us16-wrong-branch',
        date,
        employeeId: e2eIds.staffEmployee,
        branchId: e2eIds.secondaryBranch,
        startMinutes: 480,
        endMinutes: 510,
        offerIds: [e2eIds.legacyUnassignedOffer],
      }),
    });
    await expectCode(wrongBranch, 400, 'BookingEmployeeNotInBranch');

    const heldDate = futureDate(201);
    const held = await eligibleEmployees(request, headers, {
      branchId: e2eIds.branch,
      date: heldDate,
      startMinutes: 540,
      endMinutes: 570,
      offerId: e2eIds.legacyUnassignedOffer,
    });
    expect(held.map((employee: { id: string }) => employee.id)).not.toContain(
      e2eIds.workingStaffEmployee
    );
    const blocked = await request.post(`${apiBaseUrl}/bookings`, {
      headers,
      data: bookingInput({
        key: 'e2e-us16-held-slot',
        date: heldDate,
        employeeId: e2eIds.workingStaffEmployee,
        startMinutes: 540,
        endMinutes: 570,
        offerIds: [e2eIds.legacyUnassignedOffer],
      }),
    });
    await expectCode(blocked, 409, 'BookingSlotUnavailable');
  });

  test('keeps a short confirmed interval and refuses a slot occupied by a seeded booking', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const tooShort = await request.post(`${apiBaseUrl}/bookings`, {
      headers,
      data: bookingInput({
        key: 'e2e-us16-duration-short',
        date: futureDate(199),
        employeeId: e2eIds.staffEmployee,
        startMinutes: 720,
        endMinutes: 780,
        offerIds: [e2eIds.durationLongOffer, e2eIds.bookingServiceOffer],
      }),
    });
    expect(tooShort.status()).toBe(201);
    expect(
      queryE2eDatabase(`SELECT CONCAT(StartMinutes, '-', EndMinutes) FROM dbo.Bookings
        WHERE TenantId = '${e2eIds.tenantA}'
          AND IdempotencyKey = 'e2e-us16-duration-short';`)
    ).toBe('720-780');

    const occupied = await request.post(`${apiBaseUrl}/bookings`, {
      headers,
      data: bookingInput({
        key: 'e2e-us16-seeded-booking-conflict',
        date: futureDate(200),
        employeeId: e2eIds.staffEmployee,
        startMinutes: 600,
        endMinutes: 630,
        offerIds: [e2eIds.bookingServiceOffer],
      }),
    });
    await expectCode(occupied, 409, 'BookingSlotUnavailable');
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Bookings
        WHERE TenantId = '${e2eIds.tenantA}'
          AND IdempotencyKey = 'e2e-us16-seeded-booking-conflict';`)
    ).toBe('0');
  });

  test('allows only one of two API confirmations for the same employee slot', async ({
    request,
  }) => {
    const headers = await authenticate(request);
    const date = futureDate(202);
    const [first, second] = await Promise.all([
      request.post(`${apiBaseUrl}/bookings`, {
        headers,
        data: bookingInput({
          key: 'e2e-us16-race-a',
          date,
          employeeId: e2eIds.workingStaffEmployee,
          startMinutes: 600,
          endMinutes: 630,
          offerIds: [e2eIds.legacyUnassignedOffer],
        }),
      }),
      request.post(`${apiBaseUrl}/bookings`, {
        headers,
        data: bookingInput({
          key: 'e2e-us16-race-b',
          date,
          employeeId: e2eIds.workingStaffEmployee,
          startMinutes: 600,
          endMinutes: 630,
          offerIds: [e2eIds.legacyUnassignedOffer],
        }),
      }),
    ]);

    expect([first.status(), second.status()].sort()).toEqual([201, 409]);
    const conflict = first.status() === 409 ? first : second;
    await expectCode(conflict, 409, 'BookingSlotUnavailable');
    expect(
      queryE2eDatabase(`SELECT COUNT(*) FROM dbo.Bookings
        WHERE TenantId = '${e2eIds.tenantA}'
          AND IdempotencyKey IN ('e2e-us16-race-a', 'e2e-us16-race-b');`)
    ).toBe('1');
  });
});
