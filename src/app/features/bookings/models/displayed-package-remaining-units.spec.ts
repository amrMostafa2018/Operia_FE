import {
  displayedPackageRemainingUnits,
  displayedPackageUsedUnits,
} from './booking.model';

describe('displayedPackageRemainingUnits', () => {
  it('ignores reserved slots for pulse packages', () => {
    expect(
      displayedPackageRemainingUnits({
        totalSessions: 5000,
        usedSessions: 100,
        reservedSessions: 2,
        pulseCount: 5000,
        offerType: 'package',
      })
    ).toBe(4900);
  });

  it('subtracts reserved slots for single-session services', () => {
    expect(
      displayedPackageRemainingUnits({
        totalSessions: 1,
        usedSessions: 0,
        reservedSessions: 1,
        pulseCount: null,
        offerType: 'session',
      })
    ).toBe(0);
  });

  it('subtracts reserved slots for session packages', () => {
    expect(
      displayedPackageRemainingUnits({
        totalSessions: 10,
        usedSessions: 2,
        reservedSessions: 1,
        pulseCount: null,
      })
    ).toBe(7);
  });

  it('uses aggregated used values on client packages', () => {
    const usedSessions = displayedPackageUsedUnits({
      usedSessions: 2,
      reservedSessions: 1,
      pulseCount: null,
    });

    expect(
      displayedPackageRemainingUnits({
        totalSessions: 10,
        usedSessions,
        pulseCount: null,
      })
    ).toBe(7);
  });
});
