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
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as L from 'leaflet';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { Branch, BranchService } from './branch.service';
import { applyServerFieldErrors, extractApiFieldErrors } from '@core/utils/api-error.util';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';

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
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    address: ['', [Validators.required, Validators.maxLength(500)]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^(?:\+20|0)1[0125]\d{8}$/)]],
    latitude: [0],
    longitude: [0],
    locationSelected: [false, Validators.requiredTrue],
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('BRANCHES.PAGE_REPORT'));
    });
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
    this.form.reset({
      name: '',
      address: '',
      phoneNumber: '',
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
    this.form.reset({ ...branch, locationSelected: true });
    this.dialogOpen.set(true);
    setTimeout(() => this.initializeMap());
  }
  close(): void {
    this.destroyMap();
    this.dialogOpen.set(false);
  }
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saveError.set('');
    const { locationSelected: _, ...value } = this.form.getRawValue();
    const editing = this.editing();
    const request = editing ? this.service.update(editing.id, value) : this.service.create(value);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'OPERIA', detail: 'Branch saved.' });
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
          this.toast.add({ severity: 'success', summary: 'OPERIA', detail: 'Branch deleted.' });
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
      this.saveError.set('Location services are not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = L.latLng(position.coords.latitude, position.coords.longitude);
        this.map?.setView(location, 16);
        this.marker?.setLatLng(location);
        this.setLocation(location);
      },
      () =>
        this.saveError.set(
          'We could not read your location. Allow location access or select it on the map.'
        )
    );
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
