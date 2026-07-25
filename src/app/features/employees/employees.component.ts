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
import { switchMap } from 'rxjs';
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
  EmployeeSchedule,
  EmployeeService,
  EmployeeWorkingDay,
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
  readonly activeTab = signal<'personal' | 'schedule'>('personal');
  readonly schedule = signal<EmployeeWorkingDay[]>(this.defaultSchedule());
  readonly scheduleLoading = signal(false);
  readonly scheduleError = signal<string | null>(null);
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
    this.activeTab.set('personal');
    this.schedule.set(this.defaultSchedule());
    this.scheduleError.set(null);
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
    this.activeTab.set('personal');
    this.scheduleError.set(null);
    this.loadSchedule(employee.id);
    this.dialogOpen.set(true);
  }
  close(): void {
    this.dialogOpen.set(false);
    this.clearPhoto();
    this.scheduleError.set(null);
  }
  selectTab(tab: 'personal' | 'schedule'): void {
    this.activeTab.set(tab);
  }
  setScheduleEnabled(day: string, event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.schedule.update(days =>
      days.map(item =>
        item.day === day
          ? {
              ...item,
              enabled,
              fromTime: enabled ? item.fromTime ?? '09:00:00' : null,
              toTime: enabled ? item.toTime ?? '17:00:00' : null,
            }
          : item
      )
    );
    this.scheduleError.set(null);
  }
  setScheduleTime(day: string, field: 'fromTime' | 'toTime', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.schedule.update(days =>
      days.map(item => (item.day === day ? { ...item, [field]: value ? `${value}:00` : null } : item))
    );
    this.scheduleError.set(null);
  }
  timeInputValue(value: string | null): string {
    return value?.slice(0, 5) ?? '';
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
      this.activeTab.set('personal');
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
    request
      .pipe(
        switchMap(employee => this.service.updateSchedule(employee.id, { days: this.schedule() })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
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
        error: error => {
          this.saving.set(false);
          const message = this.scheduleErrorMessage(error);
          this.scheduleError.set(message);
          if (this.activeTab() !== 'schedule') this.activeTab.set('schedule');
        },
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
  private loadSchedule(employeeId: string): void {
    this.scheduleLoading.set(true);
    this.service
      .getSchedule(employeeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: schedule => {
          this.schedule.set(schedule.days);
          this.scheduleLoading.set(false);
        },
        error: () => this.scheduleLoading.set(false),
      });
  }
  private scheduleErrorMessage(error: { error?: { errorCodes?: Record<string, string[]>; errors?: Record<string, string[]> } }): string {
    const code = Object.values(error.error?.errorCodes ?? {}).flat()[0];
    if (code) {
      const translated = this.translate.instant(`ERRORS.${code}`);
      return translated === `ERRORS.${code}` ? code : translated;
    }
    return Object.values(error.error?.errors ?? {}).flat()[0] ?? this.translate.instant('EMPLOYEES.SCHEDULE_SAVE_FAILED');
  }
  private defaultSchedule(): EmployeeWorkingDay[] {
    return ['fri', 'sat', 'sun', 'mon', 'tue', 'wed', 'thu'].map(day => ({
      day,
      enabled: false,
      fromTime: null,
      toTime: null,
    }));
  }
}
