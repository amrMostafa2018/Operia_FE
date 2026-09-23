/** Covers booking details edits, payment choices, and cancellation interactions. */
import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { CurrencyService } from '@core/services/currency.service';
import { LanguageService } from '@core/services/language.service';
import { PermissionService } from '@core/services/permission.service';
import { PackageService } from '@app/features/packages/package.service';
import { AppointmentsApiService } from './appointments-api.service';
import { BookingDetailsDialogComponent } from './booking-details-dialog.component';
import { BookingRecord, ServiceCatalogItem } from './models/booking.model';

describe('BookingDetailsDialogComponent', () => {
  it('keeps added services through a calendar refresh and resets them on reopen', async () => {
    await TestBed.configureTestingModule({
      imports: [BookingDetailsDialogComponent],
      providers: [
        FormBuilder,
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: LanguageService, useValue: {} },
        { provide: TranslateService, useValue: {} },
        { provide: MessageService, useValue: {} },
        { provide: PackageService, useValue: {} },
        {
          provide: AppointmentsApiService,
          useValue: { getPaymentMethods: () => of([]), findCustomer: () => of(null) },
        },
        { provide: CurrencyService, useValue: {} },
      ],
    })
      .overrideComponent(BookingDetailsDialogComponent, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(BookingDetailsDialogComponent);
    const booking = {
      id: 'booking-1',
      status: 'booked',
      version: 'version-1',
      paymentMethod: null,
      paidAmount: 0,
      lineItems: [
        {
          id: 'item-1',
          name: 'Package session',
          type: 'package',
          quantity: 1,
          price: 0,
          durationMinutes: 60,
          catalogPackageId: 'package-1',
        },
      ],
    } as BookingRecord;
    const extraService: ServiceCatalogItem = {
      id: 'service-1',
      name: 'Extra service',
      category: 'services',
      durationMinutes: 30,
      price: 100,
      icon: 'pi pi-sparkles',
      type: 'session',
    };
    fixture.componentRef.setInput('booking', booking);
    fixture.componentRef.setInput('catalogItems', [extraService]);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    fixture.componentInstance.changeCatalogQuantity(extraService, 1);
    expect(fixture.componentInstance.draftLineItems().map(item => item.name)).toEqual([
      'Package session',
      'Extra service',
    ]);

    fixture.componentRef.setInput('booking', { ...booking, lineItems: [...booking.lineItems] });
    fixture.detectChanges();
    expect(fixture.componentInstance.draftLineItems()).toHaveSize(2);

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.draftLineItems()).toHaveSize(1);
  });

  it('shows an error toast and does not save when selected services are empty', async () => {
    const toast = { add: jasmine.createSpy('add') };
    await TestBed.configureTestingModule({
      imports: [BookingDetailsDialogComponent],
      providers: [
        FormBuilder,
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: LanguageService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MessageService, useValue: toast },
        { provide: PackageService, useValue: {} },
        {
          provide: AppointmentsApiService,
          useValue: { getPaymentMethods: () => of([]), findCustomer: () => of(null) },
        },
        { provide: CurrencyService, useValue: {} },
      ],
    })
      .overrideComponent(BookingDetailsDialogComponent, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(BookingDetailsDialogComponent);
    const booking = {
      id: 'booking-1',
      status: 'booked',
      version: 'version-1',
      paymentMethod: null,
      paidAmount: 0,
      clientMobile: '01000000000',
      lineItems: [],
    } as unknown as BookingRecord;
    let saved = false;
    fixture.componentInstance.saved.subscribe(() => {
      saved = true;
    });
    fixture.componentRef.setInput('booking', booking);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    fixture.componentInstance.save();

    expect(saved).toBeFalse();
    expect(toast.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'HTTP_ERRORS.SUMMARY',
      detail: 'ERRORS.BookingItemsRequired',
    });
  });

  it('adds a catalog package the customer already owns with a warning and charges it', async () => {
    const toast = { add: jasmine.createSpy('add') };
    await TestBed.configureTestingModule({
      imports: [BookingDetailsDialogComponent],
      providers: [
        FormBuilder,
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: LanguageService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MessageService, useValue: toast },
        { provide: PackageService, useValue: {} },
        {
          provide: AppointmentsApiService,
          useValue: { getPaymentMethods: () => of([]), findCustomer: () => of(null) },
        },
        { provide: CurrencyService, useValue: {} },
      ],
    })
      .overrideComponent(BookingDetailsDialogComponent, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(BookingDetailsDialogComponent);
    const ownedPackage = {
      id: 'package-owned',
      name: 'Owned package',
      category: 'services',
      durationMinutes: 30,
      price: 2000,
      icon: 'pi pi-box',
      type: 'package',
    } as ServiceCatalogItem;
    const booking = {
      id: 'booking-1',
      status: 'booked',
      version: 'version-1',
      paymentMethod: null,
      paidAmount: 0,
      lineItems: [],
    } as unknown as BookingRecord;

    fixture.componentRef.setInput('booking', booking);
    fixture.componentRef.setInput('catalogItems', [ownedPackage]);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fixture.componentInstance.matchedClient.set({
      id: 'customer-1',
      name: 'Customer',
      mobile: '01000000000',
      registered: true,
      packages: [
        {
          customerPackageId: 'owned-1',
          packageId: 'package-owned',
          packageName: 'Owned package',
          usedSessions: 0,
          totalSessions: 1,
          expiryDate: '',
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.customerOwnsCatalogItem('package-owned')).toBeTrue();
    fixture.componentInstance.changeCatalogQuantity(ownedPackage, 1);

    expect(fixture.componentInstance.draftLineItems()).toHaveSize(1);
    expect(fixture.componentInstance.draftLineItems()[0].price).toBe(2000);
    expect(fixture.componentInstance.draftLineItems()[0].newPurchaseUnits).toBe(1);
    expect(fixture.componentInstance.draftLineItems()[0].packageSessionLinked).toBeFalse();
    expect(toast.add).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'BOOKINGS.DETAILS.PACKAGE_ALREADY_OWNED',
      detail: 'BOOKINGS.DETAILS.PACKAGE_ALREADY_OWNED_HINT',
    });
  });

  it('removes only one owned package line when the same catalog package was added twice', async () => {
    await TestBed.configureTestingModule({
      imports: [BookingDetailsDialogComponent],
      providers: [
        FormBuilder,
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: LanguageService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MessageService, useValue: { add: () => undefined } },
        { provide: PackageService, useValue: {} },
        {
          provide: AppointmentsApiService,
          useValue: { getPaymentMethods: () => of([]), findCustomer: () => of(null) },
        },
        { provide: CurrencyService, useValue: {} },
      ],
    })
      .overrideComponent(BookingDetailsDialogComponent, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(BookingDetailsDialogComponent);
    const ownedPackage = {
      id: 'package-owned',
      name: '5000 Plus',
      category: 'services',
      durationMinutes: 30,
      price: 5000,
      icon: 'pi pi-box',
      type: 'package',
    } as ServiceCatalogItem;
    const booking = {
      id: 'booking-1',
      status: 'booked',
      version: 'version-1',
      paymentMethod: null,
      paidAmount: 0,
      lineItems: [],
    } as unknown as BookingRecord;

    fixture.componentRef.setInput('booking', booking);
    fixture.componentRef.setInput('catalogItems', [ownedPackage]);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    fixture.componentInstance.matchedClient.set({
      id: 'customer-1',
      name: 'Customer',
      mobile: '01000000000',
      registered: true,
      packages: [
        {
          customerPackageId: 'owned-1',
          packageId: 'package-owned',
          packageName: '5000 Plus',
          usedSessions: 0,
          totalSessions: 5000,
          expiryDate: '',
          pulseCount: 5000,
        },
        {
          customerPackageId: 'owned-2',
          packageId: 'package-owned',
          packageName: '5000 Plus',
          usedSessions: 0,
          totalSessions: 5000,
          expiryDate: '',
          pulseCount: 5000,
        },
        {
          customerPackageId: 'owned-3',
          packageId: 'package-owned',
          packageName: '5000 Plus',
          usedSessions: 0,
          totalSessions: 5000,
          expiryDate: '',
          pulseCount: 5000,
        },
      ],
    });
    fixture.detectChanges();

    fixture.componentInstance.addOwnedPackage(fixture.componentInstance.customerPackages()[0]);
    fixture.componentInstance.addOwnedPackage(fixture.componentInstance.customerPackages()[1]);
    fixture.componentInstance.addOwnedPackage(fixture.componentInstance.customerPackages()[2]);
    expect(fixture.componentInstance.draftLineItems()).toHaveSize(3);

    fixture.componentInstance.removeLineItem(
      fixture.componentInstance.draftLineItems()[1].id,
      1
    );

    expect(fixture.componentInstance.draftLineItems()).toHaveSize(2);
    expect(fixture.componentInstance.draftLineItems().map(item => item.customerPackageId)).toEqual([
      'owned-1',
      'owned-3',
    ]);
  });

  it('filters the catalog picker by category and search', async () => {
    await TestBed.configureTestingModule({
      imports: [BookingDetailsDialogComponent],
      providers: [
        FormBuilder,
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: LanguageService, useValue: { currentLang: () => 'en' } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: MessageService, useValue: { add: () => undefined } },
        { provide: PackageService, useValue: {} },
        {
          provide: AppointmentsApiService,
          useValue: { getPaymentMethods: () => of([]), findCustomer: () => of(null) },
        },
        { provide: CurrencyService, useValue: {} },
      ],
    })
      .overrideComponent(BookingDetailsDialogComponent, { set: { template: '' } })
      .compileComponents();

    const fixture = TestBed.createComponent(BookingDetailsDialogComponent);
    fixture.componentRef.setInput('catalogItems', [
      {
        id: 'laser-1',
        name: 'Full body laser',
        category: 'laser',
        durationMinutes: 30,
        price: 200,
        icon: 'pi pi-sun',
        type: 'session',
      },
      {
        id: 'peel-1',
        name: 'Peeling session',
        category: 'peeling',
        durationMinutes: 20,
        price: 150,
        icon: 'pi pi-sparkles',
        type: 'session',
      },
    ]);
    fixture.detectChanges();

    fixture.componentInstance.setCategory('laser');
    fixture.componentInstance.searchQuery.set('body');

    expect(fixture.componentInstance.filteredCatalogItems().map(item => item.id)).toEqual([
      'laser-1',
    ]);
  });
});
