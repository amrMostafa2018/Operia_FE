import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as L from 'leaflet';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { Branch, BranchService } from './branch.service';
import { applyServerFieldErrors, extractApiFieldErrors } from '@core/utils/api-error.util';
import { setupServerErrorClearing } from '@core/utils/validators.util';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';
import {
  getE164PhoneNumber,
  getPhoneFieldError,
  toNationalPhoneNumber,
  toPhoneCountryIso,
} from '@app/shared/utils/phone-number.util';
import { NgxIntlTelInputModule, ChangeData, CountryISO } from 'ngx-intl-tel-input';

// List page shell (header + filters + table + pagination) mirrors employees.component;
// not extracted into a shared entity-list-page to avoid heavy projection/config overhead.

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TableModule,
    ConfirmActionDialogComponent,
    NgxIntlTelInputModule,
  ],
  templateUrl: './branches.component.html',
  styleUrl: './branches.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchesComponent implements OnInit {
  private readonly service = inject(BranchService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly canManage = computed(() => this.permissions.hasPermission(Policies.BranchesManage));
  readonly branches = signal<Branch[]>([]);
  readonly total = signal(0);
  readonly tenantTotal = signal(0);
  readonly loading = signal(false);
  readonly dialogOpen = signal(false);
  readonly editing = signal<Branch | null>(null);
  readonly saveError = signal('');
  readonly branchPendingDelete = signal<Branch | null>(null);
  readonly rowsPerPageOptions = [10, 20, 50];
  readonly rows = signal(10);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(this.translate.instant('BRANCHES.PAGE_REPORT'));
  search = '';
  private readonly searchChanges = new Subject<string>();
  private map?: L.Map;
  private marker?: L.Marker;
  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly phoneCountryISO = signal<CountryISO>(PHONE_INPUT_DEFAULT_COUNTRY);
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;
  readonly isMobileLayout = signal(false);
  readonly locating = signal(false);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    address: ['', [Validators.required, Validators.maxLength(500)]],
    phoneNumber: [null as ChangeData | string | null, Validators.required],
    latitude: [0],
    longitude: [0],
    locationSelected: [false, Validators.requiredTrue],
  });

  ngOnInit(): void {
    this.updateMobileLayout();
    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.updateMobileLayout());
    }
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('BRANCHES.PAGE_REPORT'));
    });
    setupServerErrorClearing(this.form, this.destroyRef, ['phoneNumber']);
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
  }
  load(): void {
    const rows = this.rows();
    this.loading.set(true);
    this.service
      .list({
        pageNumber: Math.floor(this.first() / rows) + 1,
        pageSize: rows,
        search: this.search.trim(),
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          this.branches.set(r.items);
          this.total.set(r.totalCount);
          this.tenantTotal.set(r.totalTenantCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.first.set(first);
    this.rows.set(rows);
    this.load();
  }
  applyFilters(): void {
    this.first.set(0);
    this.load();
  }
  onSearchChange(value: string): void {
    this.search = value;
    this.searchChanges.next(value.trim());
  }
  clear(): void {
    this.search = '';
    this.applyFilters();
  }
  openCreate(): void {
    this.editing.set(null);
    this.saveError.set('');
    this.phoneCountryISO.set(PHONE_INPUT_DEFAULT_COUNTRY);
    this.form.reset({
      name: '',
      address: '',
      phoneNumber: null,
      latitude: 30.0444,
      longitude: 31.2357,
      locationSelected: false,
    });
    this.dialogOpen.set(true);
    setTimeout(() => this.initializeMap());
  }
  openEdit(branch: Branch): void {
    this.editing.set(branch);
    this.saveError.set('');
    this.phoneCountryISO.set(toPhoneCountryIso(branch.phoneNumber));
    this.form.reset({
      ...branch,
      phoneNumber: toNationalPhoneNumber(branch.phoneNumber),
      locationSelected: true,
    });
    this.dialogOpen.set(true);
    setTimeout(() => this.initializeMap());
  }
  close(): void {
    this.locating.set(false);
    this.destroyMap();
    this.dialogOpen.set(false);
  }
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saveError.set('');
    const { locationSelected: _, ...raw } = this.form.getRawValue();
    const value = {
      ...raw,
      phoneNumber: getE164PhoneNumber(raw.phoneNumber),
    };
    const editing = this.editing();
    const request = editing ? this.service.update(editing.id, value) : this.service.create(value);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: 'OPERIA',
          detail: this.translate.instant('BRANCHES.SAVED'),
        });
        this.close();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        const fieldErrors = extractApiFieldErrors(error);
        applyServerFieldErrors(this.form, fieldErrors);
        this.saveError.set(
          Object.values(fieldErrors).flat()[0] ??
            (error as HttpErrorResponse & { userMessage?: string }).userMessage ??
            'Unable to save this branch.'
        );
      },
    });
  }
  isPhoneInvalid(): boolean {
    const control = this.form.controls.phoneNumber;
    return !!(control.invalid && control.touched);
  }
  getPhoneError(): string | null {
    return getPhoneFieldError(this.form.controls.phoneNumber, {
      required: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_REQUIRED'),
      invalid: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_INVALID'),
    });
  }
  requestDelete(branch: Branch): void {
    this.branchPendingDelete.set(branch);
  }
  cancelDelete(): void {
    this.branchPendingDelete.set(null);
  }
  confirmDelete(): void {
    const branch = this.branchPendingDelete();
    if (!branch) return;
    this.service
      .delete(branch.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            summary: 'OPERIA',
            detail: this.translate.instant('BRANCHES.DELETED'),
          });
          this.cancelDelete();
          this.load();
        },
      });
  }
  private initializeMap(): void {
    this.destroyMap();
    const element = document.getElementById('branch-map');
    if (!element) return;
    const { latitude, longitude } = this.form.getRawValue();
    this.map = L.map(element).setView([latitude, longitude], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    const pin = L.divIcon({
      className: 'branch-pin',
      html: '<i class="pi pi-map-marker"></i>',
      iconSize: [34, 42],
      iconAnchor: [17, 40],
    });
    this.marker = L.marker([latitude, longitude], { draggable: true, icon: pin }).addTo(this.map);
    this.marker.on('dragend', () => this.setLocation(this.marker!.getLatLng()));
    this.map.on('click', event => {
      this.marker!.setLatLng(event.latlng);
      this.setLocation(event.latlng);
    });
    setTimeout(() => this.map?.invalidateSize(), 0);
  }
  locateMe(): void {
    if (!navigator.geolocation) {
      this.saveError.set(this.translate.instant('BRANCHES.LOCATION_UNAVAILABLE'));
      return;
    }
    this.saveError.set('');
    this.locating.set(true);
    const options: PositionOptions = this.isMobileLayout()
      ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      : { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };
    navigator.geolocation.getCurrentPosition(
      position => this.applyLocatedPosition(position),
      error => this.handleLocationError(error),
      options
    );
  }
  private applyLocatedPosition(position: GeolocationPosition): void {
    this.locating.set(false);
    const location = L.latLng(position.coords.latitude, position.coords.longitude);
    this.map?.setView(location, 16);
    this.marker?.setLatLng(location);
    this.setLocation(location);
    this.form.controls.locationSelected.markAsTouched();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }
  private handleLocationError(error: GeolocationPositionError): void {
    this.locating.set(false);
    const key =
      error.code === error.PERMISSION_DENIED
        ? 'BRANCHES.LOCATION_DENIED'
        : error.code === error.TIMEOUT
          ? 'BRANCHES.LOCATION_TIMEOUT'
          : 'BRANCHES.LOCATION_UNAVAILABLE';
    this.saveError.set(this.translate.instant(key));
  }
  private updateMobileLayout(): void {
    this.isMobileLayout.set(typeof window !== 'undefined' && window.innerWidth <= 992);
  }
  private setLocation(location: L.LatLng): void {
    this.form.patchValue({
      latitude: location.lat,
      longitude: location.lng,
      locationSelected: true,
    });
  }
  private destroyMap(): void {
    this.map?.remove();
    this.map = undefined;
    this.marker = undefined;
  }
}
