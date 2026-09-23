import {
  bookAppointmentCatalogQuantityLineItem,
  bookAppointmentLineTotal,
  bookAppointmentOwnedPackageLineItem,
  bookAppointmentPaymentLineItems,
  bookingDetailsLineItemFromCatalog,
  dedupeOwnedPackageBookingLines,
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

  it('charges the first catalog add in booking details even when the customer already owns it', () => {
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
    const firstLine = bookingDetailsLineItemFromCatalog(pulsePackage, 1, [], []);
    const secondLine = bookingDetailsLineItemFromCatalog(
      pulsePackage,
      1,
      [],
      [firstLine]
    );

    expect(firstLine.packageSessionLinked).toBeFalse();
    expect(firstLine.customerPackageId).toBeNull();
    expect(firstLine.newPurchaseUnits).toBe(1);
    expect(bookAppointmentLineTotal(firstLine)).toBe(5000);
    expect(secondLine.packageSessionLinked).toBeFalse();
    expect(secondLine.newPurchaseUnits).toBe(1);
    expect(bookAppointmentLineTotal(secondLine)).toBe(5000);
    expect(bookingLineDisplaysPrice(secondLine)).toBeTrue();

    const normalizedFirst = normalizeBookingDetailsLineItem(
      firstLine,
      [pulsePackage],
      [ownedPackage],
      [firstLine]
    );

    expect(normalizedFirst.newPurchaseUnits).toBe(1);
    expect(bookAppointmentLineTotal(normalizedFirst)).toBe(5000);
  });

  it('keeps owned package lines free after normalize when owned packages are unavailable', () => {
    const pulsePackage: ServiceCatalogItem = {
      id: 'pulse-1',
      name: '5000 Plus',
      category: 'packages',
      durationMinutes: 30,
      price: 5000,
      icon: 'pi pi-box',
      type: 'package',
    };
    const ownedLine = bookAppointmentOwnedPackageLineItem(
      {
        customerPackageId: 'owned-pulse',
        packageId: 'pulse-1',
        packageName: '5000 Plus',
        usedSessions: 0,
        totalSessions: 5000,
        expiryDate: '2026-12-31',
        offerType: 'package',
        pulseCount: 5000,
      },
      pulsePackage
    );

    const normalized = normalizeBookingDetailsLineItem(
      ownedLine,
      [pulsePackage],
      [],
      [ownedLine]
    );

    expect(normalized.newPurchaseUnits).toBe(0);
    expect(normalized.packageSessionLinked).toBeTrue();
    expect(bookAppointmentLineTotal(normalized)).toBe(0);
    expect(bookingLineDisplaysPrice(normalized)).toBeFalse();
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

describe('dedupeOwnedPackageBookingLines', () => {
  it('keeps one owned package row per customer balance', () => {
    const ownedPackageLine = (id: string, customerPackageId: string): BookingLineItem => ({
      id,
      name: '5000 Plus',
      type: 'package',
      quantity: 1,
      price: 0,
      durationMinutes: 30,
      catalogPackageId: 'pulse-1',
      customerPackageId,
      packageSessionLinked: true,
      packageRemainingSessions: 5000,
      newPurchaseUnits: 0,
    });
    const sessionLine: BookingLineItem = {
      id: 'session-1',
      name: 'fffff',
      type: 'session',
      quantity: 1,
      price: 200,
      durationMinutes: 30,
      catalogPackageId: 'service-1',
    };

    const deduped = dedupeOwnedPackageBookingLines([
      ownedPackageLine('line-1', 'owned-1'),
      ownedPackageLine('line-2', 'owned-1'),
      sessionLine,
    ]);

    expect(deduped).toHaveSize(2);
    expect(deduped.map(item => item.id)).toEqual(['line-1', 'session-1']);
  });

  it('keeps separate purchase lines for the same catalog package', () => {
    const purchaseLine = (id: string): BookingLineItem => ({
      id,
      name: '5000 Plus',
      type: 'package',
      quantity: 1,
      price: 5000,
      durationMinutes: 30,
      catalogPackageId: 'pulse-1',
      packageSessionLinked: false,
      newPurchaseUnits: 1,
    });

    const deduped = dedupeOwnedPackageBookingLines([
      purchaseLine('purchase-1'),
      purchaseLine('purchase-2'),
    ]);

    expect(deduped).toHaveSize(2);
  });
});
