/** Pulse balances show Used only; session balances also count reserved slots. */
import { displayedPackageUsedUnits } from './booking.model';

describe('displayedPackageUsedUnits', () => {
  it('uses Used only when the package is pulse-based', () => {
    expect(
      displayedPackageUsedUnits({
        usedSessions: 0,
        reservedSessions: 2,
        pulseCount: 5000,
        offerType: 'package',
      })
    ).toBe(0);
  });

  it('adds reserved slots for single-session services', () => {
    expect(
      displayedPackageUsedUnits({
        usedSessions: 0,
        reservedSessions: 1,
        pulseCount: null,
        offerType: 'session',
      })
    ).toBe(1);
  });

  it('adds reserved slots for session packages', () => {
    expect(
      displayedPackageUsedUnits({
        usedSessions: 1,
        reservedSessions: 2,
        pulseCount: null,
      })
    ).toBe(3);
  });
});
