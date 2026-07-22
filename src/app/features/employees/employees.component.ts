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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { Branch, BranchService } from '@app/features/branches/branch.service';
import { PermissionService } from '@core/services/permission.service';
import { Permissions } from '@core/models/permissions.model';
import {
  Employee,
  EmployeePayload,
  EmployeeRole,
  EmployeeRoleCount,
  EmployeeService,
} from './employee.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    MultiSelectModule,
  ],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesComponent implements OnInit {
  private readonly service = inject(EmployeeService);
  private readonly branchesApi = inject(BranchService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly roles: EmployeeRole[] = ['SuperAdmin', 'Admin', 'Reception', 'Staff'];
  readonly statuses = [
    { label: 'EMPLOYEES.ACTIVE', value: true },
    { label: 'EMPLOYEES.INACTIVE', value: false },
  ];
  readonly employees = signal<Employee[]>([]);
  readonly roleCounts = signal<EmployeeRoleCount[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly branches = signal<Branch[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dialogOpen = signal(false);
  readonly editing = signal<Employee | null>(null);
  readonly pendingStatus = signal<Employee | null>(null);
  readonly photoPreview = signal<string | null>(null);
  readonly selectedPhoto = signal<File | undefined>(undefined);
  readonly removePhoto = signal(false);
  readonly roleValue = signal<EmployeeRole>('Staff');
  readonly canManage = computed(() =>
    this.permissions.hasPermission(Permissions.Admin.EmployeesManage)
  );
  page = 1;
  pageSize = 10;
  search = '';
  roleFilter: EmployeeRole | null = null;
  statusFilter: boolean | null = null;
  branchFilter: string | null = null;
  createdDate = '';
  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', Validators.required],
    userName: ['', Validators.required],
    specialty: [''],
    jobTitle: [''],
    joiningDate: ['', Validators.required],
    isActive: [true],
    role: ['Staff' as EmployeeRole, Validators.required],
    branchIds: [[] as string[], Validators.required],
    temporaryPassword: [''],
  });

  ngOnInit(): void {
    this.load();
    this.branchesApi
      .list({ pageNumber: 1, pageSize: 50, search: '', sortBy: 'name', sortDirection: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.branches.set(x.items));
    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.roleValue.set(x));
  }
  load(): void {
    this.loading.set(true);
    this.service
      .list({
        pageNumber: this.page,
        pageSize: this.pageSize,
        search: this.search,
        role: this.roleFilter ?? undefined,
        isActive: this.statusFilter ?? undefined,
        branchId: this.branchFilter ?? undefined,
        createdFrom: this.createdDate || undefined,
        createdTo: this.createdDate || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: x => {
          this.employees.set(x.items);
          this.roleCounts.set(x.roleCounts);
          this.total.set(x.totalCount);
          this.totalPages.set(x.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
  applyFilters(): void {
    this.page = 1;
    this.load();
  }
  clearFilters(): void {
    this.search = '';
    this.roleFilter = null;
    this.statusFilter = null;
    this.branchFilter = null;
    this.createdDate = '';
    this.applyFilters();
  }
  goTo(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.page = page;
      this.load();
    }
  }
  count(role: EmployeeRole): number {
    return this.roleCounts().find(x => x.role === role)?.count ?? 0;
  }
  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      fullName: '',
      email: '',
      mobileNumber: '',
      userName: '',
      specialty: '',
      jobTitle: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      isActive: true,
      role: 'Staff',
      branchIds: [],
      temporaryPassword: '',
    });
    this.form.controls.temporaryPassword.setValidators([
      Validators.required,
      Validators.minLength(8),
    ]);
    this.form.controls.temporaryPassword.updateValueAndValidity();
    this.clearPhoto();
    this.dialogOpen.set(true);
  }
  openEdit(employee: Employee): void {
    this.editing.set(employee);
    this.form.reset({
      fullName: employee.fullName,
      email: employee.email,
      mobileNumber: employee.mobileNumber,
      userName: employee.userName,
      specialty: employee.specialty ?? '',
      jobTitle: employee.jobTitle ?? '',
      joiningDate: employee.joiningDate,
      isActive: employee.isActive,
      role: employee.role,
      branchIds: employee.branches.map(x => x.id),
      temporaryPassword: '',
    });
    this.form.controls.temporaryPassword.clearValidators();
    this.form.controls.temporaryPassword.updateValueAndValidity();
    this.clearPhoto();
    this.photoPreview.set(employee.photoUrl ?? null);
    this.dialogOpen.set(true);
  }
  close(): void {
    this.dialogOpen.set(false);
    this.clearPhoto();
  }
  choosePhoto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      this.toast.add({
        severity: 'error',
        summary: 'OPERIA',
        detail: this.translate.instant('EMPLOYEES.PHOTO_INVALID'),
      });
      return;
    }
    this.selectedPhoto.set(file);
    this.removePhoto.set(false);
    this.photoPreview.set(URL.createObjectURL(file));
  }
  removeSelectedPhoto(): void {
    this.selectedPhoto.set(undefined);
    this.photoPreview.set(null);
    this.removePhoto.set(true);
  }
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: EmployeePayload = {
      ...value,
      photo: this.selectedPhoto(),
      removePhoto: this.removePhoto(),
      temporaryPassword: this.editing() ? undefined : value.temporaryPassword,
    };
    this.saving.set(true);
    const request = this.editing()
      ? this.service.update(this.editing()!.id, payload)
      : this.service.create(payload);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        this.load();
        this.toast.add({
          severity: 'success',
          summary: 'OPERIA',
          detail: this.translate.instant('EMPLOYEES.SAVED'),
        });
      },
      error: () => this.saving.set(false),
    });
  }
  requestStatus(employee: Employee): void {
    this.pendingStatus.set(employee);
  }
  confirmStatus(): void {
    const employee = this.pendingStatus();
    if (!employee) return;
    this.service
      .changeStatus(employee.id, !employee.isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingStatus.set(null);
          this.load();
        },
      });
  }
  roleLabel(role: EmployeeRole): string {
    return role === 'SuperAdmin' ? 'Super Admin' : role;
  }
  photoUrl(path?: string): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${environment.apiUrl.replace(/\/api\/?$/, '')}${path}`;
  }
  private clearPhoto(): void {
    const url = this.photoPreview();
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    this.photoPreview.set(null);
    this.selectedPhoto.set(undefined);
    this.removePhoto.set(false);
  }
}
