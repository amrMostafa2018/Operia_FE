import {
  bookAppointmentCatalogQuantityLineItem,
  bookAppointmentLineTotal,
  bookAppointmentOwnedPackageLineItem,
  bookAppointmentPaymentLineItems,
  bookingDetailsLineItemFromCatalog,
  bookingLineCustomerPackageIdForApi,
  bookingLineDisplaysPrice,
  BookingLineItem,
  ClientPackage,
  normalizeBookingDetailsLineItem,
  ServiceCatalogItem,
} from './booking.model';

describe('booking details owned session pricing', () => {
  const peelingSession: ServiceCatalogItem = {
    id: 'service-peel',
    name: 'Peeling session',
    category: 'services',
    durationMinutes: 60,
    price: 500,
    icon: 'pi pi-sun',
    type: 'session',
  };

  it('keeps zero price for a saved owned session even when owned packages are unavailable', () => {
    const normalized = normalizeBookingDetailsLineItem(
      {
        id: 'item-1',
        name: 'Peeling session',
        type: 'session',
        quantity: 1,
        price: 0,
        durationMinutes: 60,
        catalogPackageId: 'service-peel',
        packageSessionLinked: true,
      },
      [peelingSession],
      [],
      []
    );

    expect(normalized.price).toBe(0);
    expect(normalized.packageSessionLinked).toBeTrue();
    expect(bookAppointmentLineTotal(normalized)).toBe(0);
    expect(bookingLineDisplaysPrice(normalized)).toBeFalse();
  });

  it('zeros price when the calendar item is linked to a customer package', () => {
    const normalized = normalizeBookingDetailsLineItem(
      {
        id: 'item-1',
        name: 'Peeling session',
        type: 'session',
        quantity: 1,
        price: 500,
        durationMinutes: 60,
        catalogPackageId: 'service-peel',
        customerPackageId: 'owned-1',
        packageSessionLinked: true,
      },
      [peelingSession],
      [],
      []
    );

    expect(normalized.price).toBe(0);
    expect(bookingLineDisplaysPrice(normalized)).toBeFalse();
  });

  it('does not charge again when the same owned package is added twice', () => {
    const pulsePackage: ServiceCatalogItem = {
      id: 'pulse-1',
      name: '5000 Plus',
      category: 'packages',
      durationMinutes: 30,
      price: 5000,
      icon: 'pi pi-box',
      type: 'package',
    };
    const ownedPackage: ClientPackage = {
      customerPackageId: 'owned-pulse',
      packageId: 'pulse-1',
      packageName: '5000 Plus',
      usedSessions: 0,
      totalSessions: 5000,
      expiryDate: '2026-12-31',
      offerType: 'package',
      pulseCount: 5000,
    };
    const existingLine = bookingDetailsLineItemFromCatalog(pulsePackage, 1, [ownedPackage], []);
    const duplicateLine = bookingDetailsLineItemFromCatalog(
      pulsePackage,
      1,
      [ownedPackage],
      [existingLine]
    );

    expect(existingLine.packageSessionLinked).toBeTrue();
    expect(existingLine.packageRemainingSessions).toBe(5000);
    expect(bookAppointmentLineTotal(existingLine)).toBe(0);
    expect(duplicateLine.packageSessionLinked).toBeFalse();
    expect(duplicateLine.newPurchaseUnits).toBe(0);
    expect(bookAppointmentLineTotal(duplicateLine)).toBe(0);
    expect(bookingLineDisplaysPrice(duplicateLine)).toBeFalse();
  });

  it('charges a new session added beside a multi-session package on the booking', () => {
    const sessionPackage: ServiceCatalogItem = {
      id: 'package-10',
      name: '10 Sessions Offer',
      category: 'packages',
      durationMinutes: 60,
      price: 1200,
      icon: 'pi pi-box',
      type: 'package',
    };
    const beardSession: ServiceCatalogItem = {
      id: 'service-beard',
      name: 'Beard trimming session',
      category: 'services',
      durationMinutes: 30,
      price: 200,
      icon: 'pi pi-sun',
      type: 'session',
    };
    const packageLine: BookingLineItem = {
      id: 'line-package',
      name: '10 Sessions Offer',
      type: 'package',
      quantity: 1,
      price: 0,
      durationMinutes: 60,
      catalogPackageId: 'package-10',
      customerPackageId: 'owned-package-10',
      packageSessionLinked: true,
      packageRemainingSessions: 2,
      newPurchaseUnits: 0,
    };

    const sessionLine = bookingDetailsLineItemFromCatalog(beardSession, 1, [], [packageLine]);

    expect(sessionLine.packageSessionLinked).toBeFalse();
    expect(sessionLine.price).toBe(200);
    expect(sessionLine.customerPackageId).toBeNull();
    expect(bookAppointmentLineTotal(sessionLine)).toBe(200);
    expect(bookingLineDisplaysPrice(sessionLine)).toBeTrue();
  });

  it('keeps a directly owned single-session package free in booking details', () => {
    const ownedSession: ClientPackage = {
      customerPackageId: 'owned-beard',
      packageId: 'service-beard',
      packageName: 'Beard trimming session',
      usedSessions: 0,
      totalSessions: 1,
      expiryDate: '2026-12-31',
      offerType: 'session',
    };
    const beardSession: ServiceCatalogItem = {
      id: 'service-beard',
      name: 'Beard trimming session',
      category: 'services',
      durationMinutes: 30,
      price: 200,
      icon: 'pi pi-sun',
      type: 'session',
    };

    const sessionLine = bookingDetailsLineItemFromCatalog(beardSession, 1, [ownedSession], []);

    expect(sessionLine.packageSessionLinked).toBeTrue();
    expect(sessionLine.price).toBe(0);
    expect(sessionLine.customerPackageId).toBe('owned-beard');
    expect(bookingLineDisplaysPrice(sessionLine)).toBeFalse();
  });

  it('does not relink a cross-package session snapshot during normalize', () => {
    const sessionPackage: ServiceCatalogItem = {
      id: 'package-10',
      name: '10 Sessions Offer',
      category: 'packages',
      durationMinutes: 60,
      price: 1200,
      icon: 'pi pi-box',
      type: 'package',
    };
    const beardSession: ServiceCatalogItem = {
      id: 'service-beard',
      name: 'Beard trimming session',
      category: 'services',
      durationMinutes: 30,
      price: 200,
      icon: 'pi pi-sun',
      type: 'session',
    };
    const ownedPackage: ClientPackage = {
      customerPackageId: 'owned-package-10',
      packageId: 'package-10',
      packageName: '10 Sessions Offer',
      usedSessions: 8,
      totalSessions: 10,
      expiryDate: '2026-12-31',
      offerType: 'package',
      sessionCount: 10,
    };
    const packageLine: BookingLineItem = {
      id: 'line-package',
      name: '10 Sessions Offer',
      type: 'package',
      quantity: 1,
      price: 0,
      durationMinutes: 60,
      catalogPackageId: 'package-10',
      packageRemainingSessions: 2,
      packageSessionLinked: true,
      newPurchaseUnits: 0,
    };

    const normalized = normalizeBookingDetailsLineItem(
      {
        id: 'line-session',
        name: 'Beard trimming session',
        type: 'session',
        quantity: 1,
        price: 0,
        durationMinutes: 30,
        catalogPackageId: 'service-beard',
        customerPackageId: 'owned-package-10',
        packageSessionLinked: true,
      },
      [beardSession, sessionPackage],
      [ownedPackage],
      [packageLine]
    );

    expect(normalized.packageSessionLinked).toBeFalse();
    expect(normalized.price).toBe(200);
    expect(bookingLineDisplaysPrice(normalized)).toBeTrue();
  });

  it('omits cross-package customerPackageId from the API', () => {
    const packageLine: BookingLineItem = {
      id: 'line-package',
      name: '10 Sessions Offer',
      type: 'package',
      quantity: 1,
      price: 0,
      durationMinutes: 60,
      catalogPackageId: 'package-10',
      customerPackageId: 'owned-package-10',
      packageRemainingSessions: 2,
      packageSessionLinked: true,
      newPurchaseUnits: 0,
    };
    const sessionLine: BookingLineItem = {
      id: 'line-session',
      name: 'Beard trimming session',
      type: 'session',
      quantity: 1,
      price: 200,
      durationMinutes: 30,
      catalogPackageId: 'service-beard',
      packageSessionLinked: false,
      newPurchaseUnits: 1,
    };

    expect(bookingLineCustomerPackageIdForApi(sessionLine, [packageLine, sessionLine])).toBeNull();
  });
});

describe('book appointment catalog session payments', () => {
  const beardSession: ServiceCatalogItem = {
    id: 'service-beard',
    name: 'Beard trimming session',
    category: 'services',
    durationMinutes: 30,
    price: 200,
    icon: 'pi pi-sun',
    type: 'session',
  };
  const sessionPackage: ServiceCatalogItem = {
    id: 'package-10',
    name: '10 Sessions Offer',
    category: 'packages',
    durationMinutes: 30,
    price: 5000,
    icon: 'pi pi-box',
    type: 'package',
  };
  const ownedPackage: ClientPackage = {
    customerPackageId: 'owned-package-10',
    packageId: 'package-10',
    packageName: '10 Sessions Offer',
    usedSessions: 8,
    totalSessions: 10,
    expiryDate: '2026-12-31',
    offerType: 'package',
    sessionCount: 10,
  };

  it('adds a catalog session to payments beside an owned package', () => {
    const ownedLine = bookAppointmentOwnedPackageLineItem(ownedPackage, sessionPackage);
    const sessionLine = bookAppointmentCatalogQuantityLineItem(
      beardSession,
      1,
      [ownedPackage],
      [ownedLine]
    );
    const paymentLines = bookAppointmentPaymentLineItems([ownedLine, sessionLine]);

    expect(sessionLine.packageSessionLinked).toBeFalse();
    expect(sessionLine.price).toBe(200);
    expect(sessionLine.customerPackageId).toBeNull();
    expect(bookAppointmentLineTotal(sessionLine)).toBe(200);
    expect(bookAppointmentLineTotal(ownedLine)).toBe(0);
    expect(paymentLines).toEqual([sessionLine]);
  });

  it('keeps a directly owned session out of payments', () => {
    const ownedSession: ClientPackage = {
      customerPackageId: 'owned-beard',
      packageId: 'service-beard',
      packageName: 'Beard trimming session',
      usedSessions: 0,
      totalSessions: 1,
      expiryDate: '2026-12-31',
      offerType: 'session',
    };
    const sessionLine = bookAppointmentCatalogQuantityLineItem(beardSession, 1, [ownedSession], []);

    expect(sessionLine.packageSessionLinked).toBeTrue();
    expect(bookAppointmentLineTotal(sessionLine)).toBe(0);
    expect(bookAppointmentPaymentLineItems([sessionLine])).toEqual([]);
  });
});
