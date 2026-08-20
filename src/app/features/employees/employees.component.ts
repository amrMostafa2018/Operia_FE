import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  applyServerFieldErrors,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { setupServerErrorClearing } from '@core/utils/validators.util';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect, MultiSelectModule } from 'primeng/multiselect';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { Branch, BranchService } from '@app/features/branches/branch.service';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import {
  Employee,
  EmployeePayload,
  EmployeeRole,
  EmployeeRoleCount,
  EmployeeService,
  EmployeeWorkingDay,
} from './employee.service';
import { resolveUploadUrl } from '@core/utils/resolve-upload-url';
import { ConfirmActionDialogComponent } from '@app/shared/components/confirm-action-dialog/confirm-action-dialog.component';
import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';
import { createPasswordToggle } from '@app/features/auth/auth-form.utils';
import { isFieldInvalid } from '@app/shared/utils/form-field.util';
import { getE164PhoneNumber, getPhoneFieldError, toNationalPhoneNumber, toPhoneCountryIso } from '@app/shared/utils/phone-number.util';
import { PhoneUsernameAutocompleteDirective } from '@app/shared/directives/phone-username-autocomplete.directive';
import { NgxIntlTelInputModule, ChangeData, CountryISO } from 'ngx-intl-tel-input';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TimePickerComponent } from '@app/shared/components/time-picker/time-picker.component';

interface ScheduleDayUi {
  day: string;
  enabled: boolean;
  fromTime: Date;
  toTime: Date;
}

interface BranchScheduleUi {
  branchId: string;
  branchName: string;
  days: ScheduleDayUi[];
}

// List page shell (header + filters + table + pagination) mirrors branches.component;
// kept separate because employee create/edit uses a full-page overlay, not a dialog.

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    MultiSelectModule,
    TableModule,
    TagModule,
    ConfirmActionDialogComponent,
    NgxIntlTelInputModule,
    PhoneUsernameAutocompleteDirective,
    InputSwitchModule,
    TimePickerComponent,
  ],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesComponent implements OnInit {
  @ViewChild('branchMultiselect') private branchMultiselect?: MultiSelect;

  private readonly service = inject(EmployeeService);
  private readonly branchesApi = inject(BranchService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly isFieldInvalid = isFieldInvalid;
  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly mobileCountryISO = signal<CountryISO>(PHONE_INPUT_DEFAULT_COUNTRY);
  readonly userNameCountryISO = signal<CountryISO>(PHONE_INPUT_DEFAULT_COUNTRY);
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;
  private readonly passwordToggle = createPasswordToggle();
  readonly showPassword = this.passwordToggle.show;
  readonly togglePassword = this.passwordToggle.toggle;
  readonly roleFilterOptions: { label: string; value: EmployeeRole }[] = [
    { label: 'EMPLOYEES.ROLES.Admin', value: 'Admin' },
    { label: 'EMPLOYEES.ROLES.Reception', value: 'Reception' },
    { label: 'EMPLOYEES.ROLES.Staff', value: 'Staff' },
  ];
  readonly statuses = [
    { label: 'EMPLOYEES.ACTIVE', value: true },
    { label: 'EMPLOYEES.INACTIVE', value: false },
  ];
  readonly employees = signal<Employee[]>([]);
  readonly roleCounts = signal<EmployeeRoleCount[]>([]);
  readonly total = signal(0);
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
  readonly branchSchedules = signal<BranchScheduleUi[]>([]);
  readonly activeBranchId = signal<string | null>(null);
  readonly scheduleLoading = signal(false);
  readonly scheduleErrors = signal<Record<string, string>>({});
  readonly activeBranchSchedule = computed(
    () => this.branchSchedules().find(x => x.branchId === this.activeBranchId()) ?? null
  );
  readonly activeScheduleError = computed(() => {
    const branchId = this.activeBranchId();
    return branchId ? (this.scheduleErrors()[branchId] ?? null) : null;
  });
  readonly canManage = computed(() => this.permissions.hasPermission(Policies.EmployeesManage));
  readonly rowsPerPageOptions = [5, 10, 20, 50];
  readonly rows = signal(5);
  readonly first = signal(0);
  readonly pageReportTemplate = signal(this.translate.instant('EMPLOYEES.PAGE_REPORT'));
  search = '';
  private readonly searchChanges = new Subject<string>();
  roleFilter: EmployeeRole | null = null;
  statusFilter: boolean | null = null;
  branchFilter: string | null = null;
  createdDate = '';
  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: [null as ChangeData | string | null, Validators.required],
    userName: [null as ChangeData | string | null, Validators.required],
    specialty: [''],
    jobTitle: [''],
    joiningDate: ['', Validators.required],
    isActive: [true],
    role: ['Staff' as EmployeeRole, Validators.required],
    branchIds: [[] as string[], Validators.required],
    temporaryPassword: [''],
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageReportTemplate.set(this.translate.instant('EMPLOYEES.PAGE_REPORT'));
    });
    this.branchesApi
      .list({ pageNumber: 1, pageSize: 50, search: '', sortBy: 'name', sortDirection: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.branches.set(x.items));
    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.roleValue.set(x));
    setupServerErrorClearing(this.form, this.destroyRef, [
      'email',
      'mobileNumber',
      'userName',
      'temporaryPassword',
    ]);
    this.form.controls.branchIds.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(branchIds => this.syncBranchSchedules(branchIds));
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
  clearFilters(): void {
    this.search = '';
    this.roleFilter = null;
    this.statusFilter = null;
    this.branchFilter = null;
    this.createdDate = '';
    this.applyFilters();
  }
  syncBranchMultiselectPanelWidth(): void {
    requestAnimationFrame(() => {
      const trigger = document.querySelector(
        '.employee-branch-multiselect.p-multiselect'
      ) as HTMLElement | null;
      const panel = document.querySelector(
        '.employee-branch-multiselect-panel'
      ) as HTMLElement | null;
      if (trigger && panel) {
        panel.style.minWidth = `${trigger.offsetWidth}px`;
      }
    });
  }
  count(role: EmployeeRole): number {
    return this.roleCounts().find(x => x.role === role)?.count ?? 0;
  }
  openCreate(): void {
    this.editing.set(null);
    this.mobileCountryISO.set(PHONE_INPUT_DEFAULT_COUNTRY);
    this.userNameCountryISO.set(PHONE_INPUT_DEFAULT_COUNTRY);
    this.form.reset({
      fullName: '',
      email: '',
      mobileNumber: null,
      userName: null,
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
    this.passwordToggle.show.set(false);
    this.clearPhoto();
    this.activeTab.set('personal');
    this.branchSchedules.set([]);
    this.activeBranchId.set(null);
    this.scheduleErrors.set({});
    this.dialogOpen.set(true);
  }
  openEdit(employee: Employee): void {
    this.editing.set(employee);
    this.mobileCountryISO.set(toPhoneCountryIso(employee.mobileNumber));
    this.userNameCountryISO.set(toPhoneCountryIso(employee.userName));
    this.form.reset({
      fullName: employee.fullName,
      email: employee.email,
      mobileNumber: toNationalPhoneNumber(employee.mobileNumber),
      userName: toNationalPhoneNumber(employee.userName),
      specialty: employee.specialty ?? '',
      jobTitle: employee.jobTitle ?? '',
      joiningDate: employee.joiningDate,
      isActive: employee.isActive,
      role: this.normalizeRole(employee.role),
      branchIds: employee.branches.map(x => x.id),
      temporaryPassword: '',
    });
    this.form.controls.temporaryPassword.clearValidators();
    this.form.controls.temporaryPassword.updateValueAndValidity();
    this.passwordToggle.show.set(false);
    this.clearPhoto();
    this.photoPreview.set(employee.photoUrl ? resolveUploadUrl(employee.photoUrl) : null);
    this.activeTab.set('personal');
    this.scheduleErrors.set({});
    this.syncBranchSchedules(employee.branches.map(x => x.id));
    this.loadSchedule(employee.id);
    this.dialogOpen.set(true);
  }
  close(): void {
    this.dialogOpen.set(false);
    this.passwordToggle.show.set(false);
    this.clearPhoto();
    this.clearPhoto();
    this.scheduleErrors.set({});
  }
  selectTab(tab: 'personal' | 'schedule'): void {
    this.closeBranchMultiselect();
    this.activeTab.set(tab);
  }
  onBranchSelectionChange(): void {
    queueMicrotask(() => this.closeBranchMultiselect());
  }
  selectBranchTab(branchId: string): void {
    this.activeBranchId.set(branchId);
  }
  setScheduleEnabled(branchId: string, day: string, enabled: boolean): void {
    this.branchSchedules.update(branches =>
      branches.map(branch =>
        branch.branchId === branchId
          ? {
              ...branch,
              days: branch.days.map(item =>
                item.day === day
                  ? {
                      ...item,
                      enabled,
                      fromTime: enabled ? item.fromTime : this.parseScheduleTime(null),
                      toTime: enabled ? item.toTime : this.parseScheduleTime(null, 17, 0),
                    }
                  : item
              ),
            }
          : branch
      )
    );
    this.clearScheduleError(branchId);
  }
  updateScheduleFromTime(branchId: string, day: string, time: Date): void {
    this.branchSchedules.update(branches =>
      branches.map(branch =>
        branch.branchId === branchId
          ? {
              ...branch,
              days: branch.days.map(item => (item.day === day ? { ...item, fromTime: time } : item)),
            }
          : branch
      )
    );
    this.clearScheduleError(branchId);
  }
  updateScheduleToTime(branchId: string, day: string, time: Date): void {
    this.branchSchedules.update(branches =>
      branches.map(branch =>
        branch.branchId === branchId
          ? {
              ...branch,
              days: branch.days.map(item => (item.day === day ? { ...item, toTime: time } : item)),
            }
          : branch
      )
    );
    this.clearScheduleError(branchId);
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
        summary: this.translate.instant('EMPLOYEES.TITLE'),
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
      if (this.activeTab() === 'schedule') {
        this.toast.add({
          severity: 'warn',
          summary: this.translate.instant('EMPLOYEES.TITLE'),
          detail: this.translate.instant('EMPLOYEES.COMPLETE_PERSONAL_FIRST'),
        });
      }
      this.closeBranchMultiselect();
      this.activeTab.set('personal');
      return;
    }
    const value = this.form.getRawValue();
    const payload: EmployeePayload = {
      ...value,
      mobileNumber: getE164PhoneNumber(value.mobileNumber),
      userName: getE164PhoneNumber(value.userName),
      photo: this.selectedPhoto(),
      removePhoto: this.removePhoto(),
      temporaryPassword: this.editing() ? undefined : value.temporaryPassword,
    };
    const schedulePayload = this.toSchedulePayload();
    this.saving.set(true);

    const editing = this.editing();
    if (editing) {
      // Edit mode: update employee info then update schedule in sequence.
      // editing() is already set so retries always use update, not create.
      this.service
        .update(editing.id, payload)
        .pipe(
          switchMap(employee =>
            this.service.updateSchedule(employee.id, { branches: schedulePayload })
          ),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: () => this.onSaveSuccess(),
          error: (error: HttpErrorResponse) => this.handleSaveError(error),
        });
    } else {
      // Create mode: send employee + schedule in one atomic request.
      // If schedule validation fails the employee is never persisted, so
      // retrying never triggers a "username already exists" error.
      this.service
        .create(payload, schedulePayload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.onSaveSuccess(),
          error: (error: HttpErrorResponse) => this.handleSaveError(error),
        });
    }
  }

  private onSaveSuccess(): void {
    this.saving.set(false);
    this.close();
    this.load();
    this.toast.add({
      severity: 'success',
      summary: this.translate.instant('EMPLOYEES.TITLE'),
      detail: this.translate.instant('EMPLOYEES.SAVED'),
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
  roleLabel(role: EmployeeRole | 'SuperAdmin'): string {
    return this.translate.instant(`EMPLOYEES.ROLES.${this.normalizeRole(role)}`);
  }
  private normalizeRole(role: EmployeeRole | 'SuperAdmin'): EmployeeRole {
    return role === 'SuperAdmin' ? 'Admin' : role;
  }
  isPhoneInvalid(): boolean {
    const control = this.form.controls.mobileNumber;
    return !!(control.invalid && control.touched);
  }
  getMobileError(): string | null {
    return getPhoneFieldError(this.form.controls.mobileNumber, {
      required: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_REQUIRED'),
      invalid: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_INVALID'),
    });
  }
  isUserNameInvalid(): boolean {
    const control = this.form.controls.userName;
    return !!(control.invalid && control.touched);
  }
  getUserNameError(): string | null {
    return getPhoneFieldError(this.form.controls.userName, {
      required: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_REQUIRED'),
      invalid: this.translate.instant('AUTH.LOGIN_PAGE.PHONE_INVALID'),
    });
  }
  getFullNameError(): string | null {
    const control = this.form.controls.fullName;
    if (!control.touched || !control.errors) {
      return null;
    }
    if (control.errors['server']) {
      return control.errors['server'];
    }
    if (control.errors['required']) {
      return this.translate.instant('ERRORS.FullNameRequired');
    }
    return null;
  }
  getEmailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched || !control.errors) {
      return null;
    }
    if (control.errors['server']) {
      return control.errors['server'];
    }
    if (control.errors['required']) {
      return this.translate.instant('AUTH.LOGIN_PAGE.EMAIL_REQUIRED');
    }
    if (control.errors['email']) {
      return this.translate.instant('AUTH.LOGIN_PAGE.EMAIL_INVALID');
    }
    return null;
  }
  getPasswordError(): string | null {
    const control = this.form.controls.temporaryPassword;
    if (!control.touched || !control.errors) {
      return null;
    }
    if (control.errors['server']) {
      return control.errors['server'];
    }
    if (control.errors['required']) {
      return this.translate.instant('AUTH.REGISTER_PAGE.PASSWORD_REQUIRED');
    }
    if (control.errors['minlength']) {
      return this.translate.instant('AUTH.REGISTER_PAGE.PASSWORD_MIN');
    }
    return null;
  }
  readonly resolveUploadUrl = resolveUploadUrl;
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
          this.branchSchedules.set(
            schedule.branches.map(branch => ({
              branchId: branch.branchId,
              branchName: branch.branchName,
              days: branch.days.map(day => ({
                day: day.day,
                enabled: day.enabled,
                fromTime: this.parseScheduleTime(day.fromTime),
                toTime: this.parseScheduleTime(day.toTime, 17, 0),
              })),
            }))
          );
          this.activeBranchId.set(schedule.branches[0]?.branchId ?? null);
          this.scheduleLoading.set(false);
        },
        error: () => this.scheduleLoading.set(false),
      });
  }
  private syncBranchSchedules(branchIds: string[]): void {
    const available = this.branches();
    const current = this.branchSchedules();
    const next = branchIds.map(branchId => {
      const existing = current.find(x => x.branchId === branchId);
      if (existing) {
        const branch = available.find(x => x.id === branchId);
        return branch ? { ...existing, branchName: branch.name } : existing;
      }
      const branch = available.find(x => x.id === branchId);
      return {
        branchId,
        branchName: branch?.name ?? branchId,
        days: this.defaultSchedule(),
      };
    });
    this.branchSchedules.set(next);
    const active = this.activeBranchId();
    if (!active || !branchIds.includes(active)) {
      this.activeBranchId.set(branchIds[0] ?? null);
    }
    this.closeBranchMultiselect();
    this.scheduleErrors.set({});
  }
  private closeBranchMultiselect(): void {
    this.branchMultiselect?.hide();
  }
  private clearScheduleError(branchId: string): void {
    this.scheduleErrors.update(errors => {
      if (!errors[branchId]) return errors;
      const next = { ...errors };
      delete next[branchId];
      return next;
    });
  }
  private handleSaveError(error: HttpErrorResponse): void {
    this.saving.set(false);
    this.scheduleErrors.set({});

    const fieldErrors = translateApiFieldErrors(
      extractApiFieldErrors(error),
      key => this.translate.instant(key)
    );
    const personalErrors = Object.fromEntries(
      Object.entries(fieldErrors).filter(([field]) => !!this.form.get(field))
    );

    if (Object.keys(personalErrors).length > 0) {
      applyServerFieldErrors(this.form, personalErrors);
      this.activeTab.set('personal');
      return;
    }

    const scheduleMessage = this.scheduleErrorMessage(error, fieldErrors);
    const branchId = this.resolveScheduleErrorBranchId(fieldErrors);
    if (branchId) {
      this.scheduleErrors.set({ [branchId]: scheduleMessage });
      this.activeBranchId.set(branchId);
    }
    this.activeTab.set('schedule');
    this.showScheduleWarnToast(error, scheduleMessage);
  }

  private static readonly scheduleWarnCodes = new Set([
    'EmployeeScheduleOutsideBusinessHours',
    'EmployeeScheduleBranchNotAssigned',
    'EmployeeScheduleOverlappingBranchHours',
  ]);

  private showScheduleWarnToast(error: HttpErrorResponse, fallbackMessage: string): void {
    const body = error.error as { errorCodes?: Record<string, string[]> } | null;
    const codes = Object.values(body?.errorCodes ?? {})
      .flat()
      .filter(code => EmployeesComponent.scheduleWarnCodes.has(code));

    if (codes.length === 0) {
      return;
    }

    const detail = [
      ...new Set(
        codes.map(code => {
          const key = `ERRORS.${code}`;
          const translated = this.translate.instant(key);
          return translated === key ? fallbackMessage : translated;
        })
      ),
    ].join(' ');

    this.toast.add({
      severity: 'warn',
      summary: this.translate.instant('EMPLOYEES.TITLE'),
      detail,
      life: 6000,
    });
  }

  private resolveScheduleErrorBranchId(fieldErrors: Record<string, string>): string | null {
    const branchField = Object.keys(fieldErrors).find(key => key.startsWith('branches['));
    if (!branchField) {
      return this.activeBranchId();
    }
    const match = branchField.match(/branches\[(\d+)\]/);
    if (!match) {
      return this.activeBranchId();
    }
    const index = Number.parseInt(match[1], 10);
    return this.branchSchedules()[index]?.branchId ?? this.activeBranchId();
  }
  private scheduleErrorMessage(
    error: HttpErrorResponse,
    fieldErrors: Record<string, string>
  ): string {
    const scheduleField = Object.keys(fieldErrors).find(key => key.startsWith('branches['));
    if (scheduleField) {
      const translated = fieldErrors[scheduleField];
      if (translated && !this.isRawErrorCode(translated)) {
        return translated;
      }
    }

    const body = error.error as {
      errors?: Record<string, string[]>;
      errorCodes?: Record<string, string[]>;
    };
    const apiScheduleField = Object.keys(body?.errors ?? {}).find(key => key.startsWith('branches['));
    const apiMessage = apiScheduleField ? body?.errors?.[apiScheduleField]?.[0] : null;
    if (apiMessage) {
      return apiMessage;
    }

    const code =
      (scheduleField ? fieldErrors[scheduleField] : null) ??
      Object.values(body?.errorCodes ?? {}).flat()[0];
    if (code) {
      const translated = this.translate.instant(`ERRORS.${code}`);
      return translated === `ERRORS.${code}` ? code : translated;
    }

    return this.translate.instant('EMPLOYEES.SCHEDULE_SAVE_FAILED');
  }

  private isRawErrorCode(value: string): boolean {
    return /^[A-Z][A-Za-z0-9]*$/.test(value);
  }
  private defaultSchedule(): ScheduleDayUi[] {
    return ['fri', 'sat', 'sun', 'mon', 'tue', 'wed', 'thu'].map(day => ({
      day,
      enabled: false,
      fromTime: this.parseScheduleTime(null),
      toTime: this.parseScheduleTime(null, 17, 0),
    }));
  }
  private parseScheduleTime(time: string | null, defaultHour = 9, defaultMinute = 0): Date {
    const value = new Date();
    if (!time) {
      value.setHours(defaultHour, defaultMinute, 0, 0);
      return value;
    }
    const [hours, minutes] = time.split(':');
    value.setHours(parseInt(hours, 10) || defaultHour, parseInt(minutes, 10) || defaultMinute, 0, 0);
    return value;
  }
  private formatScheduleTime(time: Date): string {
    return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:00`;
  }
  private toSchedulePayload(): { branchId: string; branchName: string; days: EmployeeWorkingDay[] }[] {
    return this.branchSchedules().map(branch => ({
      branchId: branch.branchId,
      branchName: branch.branchName,
      days: branch.days.map(day => ({
        day: day.day,
        enabled: day.enabled,
        fromTime: day.enabled ? this.formatScheduleTime(day.fromTime) : null,
        toTime: day.enabled ? this.formatScheduleTime(day.toTime) : null,
      })),
    }));
  }
}
