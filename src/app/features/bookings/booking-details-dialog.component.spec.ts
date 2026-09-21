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
        { provide: AppointmentsApiService, useValue: { getPaymentMethods: () => of([]) } },
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

    fixture.componentInstance.addService(extraService.id);
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
});
