import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { PackagePayload, PackageService } from './package.service';

describe('PackageService', () => {
  let service: PackageService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PackageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends package list filters to the packages endpoint', () => {
    service
      .list({
        pageNumber: 2,
        pageSize: 10,
        search: 'Laser',
        offerType: 'package',
        serviceCategoryId: 'cat-1',
        status: 'active',
      })
      .subscribe();

    const request = http.expectOne(
      req => req.url === `${environment.apiUrl}/packages` && req.params.get('pageNumber') === '2'
    );
    expect(request.request.params.get('search')).toBe('Laser');
    expect(request.request.params.get('offerType')).toBe('package');
    expect(request.request.params.get('serviceCategoryId')).toBe('cat-1');
    expect(request.request.params.get('status')).toBe('active');
    request.flush({
      items: [],
      pageNumber: 2,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
      activeCount: 0,
      cancelledCount: 0,
    });
  });

  it('loads a package by id', () => {
    service.get('pkg-1').subscribe();
    const request = http.expectOne(`${environment.apiUrl}/packages/pkg-1`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('creates a package', () => {
    const payload: PackagePayload = {
      name: 'Full Body',
      isActive: true,
      offerType: 'package',
      description: 'Package offer',
      serviceCategoryId: 'cat-1',
      subServiceCategoryId: null,
      sessionDurationMinutes: 45,
      sessionCount: 6,
      pulseCount: 0,
      packageExpiryMonths: 12,
      price: 4500,
      discountCode: '',
      discountPercent: 0,
    };

    service.create(payload).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/packages`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({});
  });

  it('updates a package', () => {
    const payload: PackagePayload = {
      name: 'Updated',
      isActive: true,
      offerType: 'singleSession',
      description: '',
      serviceCategoryId: 'cat-1',
      subServiceCategoryId: null,
      sessionDurationMinutes: 30,
      sessionCount: 0,
      pulseCount: null,
      packageExpiryMonths: null,
      price: 500,
      discountCode: '',
      discountPercent: null,
    };

    service.update('pkg-1', payload).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/packages/pkg-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({});
  });

  it('deletes a package', () => {
    service.delete('pkg-1').subscribe();
    const request = http.expectOne(`${environment.apiUrl}/packages/pkg-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('lists service categories', () => {
    service.listServiceCategories().subscribe();
    const request = http.expectOne(`${environment.apiUrl}/packages/service-categories`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('lists sub-service categories with parent filter', () => {
    service.listSubServiceCategories('cat-1').subscribe();
    const request = http.expectOne(
      req =>
        req.url === `${environment.apiUrl}/packages/sub-service-categories` &&
        req.params.get('serviceCategoryId') === 'cat-1'
    );
    request.flush([]);
  });

  it('loads every active catalog page', () => {
    let items: { id: string }[] = [];
    service.listAllActive().subscribe(result => {
      items = result;
    });

    const first = http.expectOne(
      req => req.url === `${environment.apiUrl}/packages` && req.params.get('pageNumber') === '1'
    );
    expect(first.request.params.get('pageSize')).toBe('50');
    expect(first.request.params.get('status')).toBe('active');
    first.flush({
      items: [
        {
          id: 'p1',
          name: 'Laser package',
          offerType: 'package',
          sessionDurationMinutes: 60,
          serviceCategoryId: 'cat-1',
          serviceCategoryName: 'Laser',
          price: 1200,
          status: 'active',
          createdAt: '2026-09-01',
          endsAt: null,
        },
      ],
      pageNumber: 1,
      pageSize: 50,
      totalCount: 2,
      totalPages: 2,
      activeCount: 2,
      cancelledCount: 0,
    });

    const second = http.expectOne(
      req => req.url === `${environment.apiUrl}/packages` && req.params.get('pageNumber') === '2'
    );
    second.flush({
      items: [
        {
          id: 'p2',
          name: 'Facial',
          offerType: 'singleSession',
          sessionDurationMinutes: 45,
          serviceCategoryId: 'cat-2',
          serviceCategoryName: 'Skin',
          price: 400,
          status: 'active',
          createdAt: '2026-09-01',
          endsAt: null,
        },
      ],
      pageNumber: 2,
      pageSize: 50,
      totalCount: 2,
      totalPages: 2,
      activeCount: 2,
      cancelledCount: 0,
    });

    expect(items.map(item => item.id)).toEqual(['p1', 'p2']);
  });

  it('lists sub-service categories without parent filter', () => {
    service.listSubServiceCategories(null).subscribe();
    const request = http.expectOne(
      req => req.url === `${environment.apiUrl}/packages/sub-service-categories`
    );
    expect(request.request.params.has('serviceCategoryId')).toBeFalse();
    request.flush([]);
  });

  it('creates a service category', () => {
    service.createServiceCategory({ name: 'Body Laser', icon: 'pi-tag' }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/packages/service-categories`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Body Laser', icon: 'pi-tag' });
    request.flush({ id: 'cat-1', name: 'Body Laser' });
  });

  it('creates a sub-service category', () => {
    service.createSubServiceCategory({ name: 'Underarm', serviceCategoryId: 'cat-1' }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/packages/sub-service-categories`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Underarm', serviceCategoryId: 'cat-1' });
    request.flush({ id: 'sub-1', name: 'Underarm' });
  });
});
