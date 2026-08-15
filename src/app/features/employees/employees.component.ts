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
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap } from 'rxjs';
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
import { MultiSelectModule } from 'primeng/multiselect';
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
  readonly schedule = signal<ScheduleDayUi[]>(this.defaultSchedule());
  readonly scheduleLoading = signal(false);
  readonly scheduleError = signal<string | null>(null);
  readonly canManage = computed(() => this.permissions.hasPermission(Policies.EmployeesManage));
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
    this.load();
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
    this.schedule.set(this.defaultSchedule());
    this.scheduleError.set(null);
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
      role: employee.role,
      branchIds: employee.branches.map(x => x.id),
      temporaryPassword: '',
    });
    this.form.controls.temporaryPassword.clearValidators();
    this.form.controls.temporaryPassword.updateValueAndValidity();
    this.passwordToggle.show.set(false);
    this.clearPhoto();
    this.photoPreview.set(employee.photoUrl ? resolveUploadUrl(employee.photoUrl) : null);
    this.activeTab.set('personal');
    this.scheduleError.set(null);
    this.loadSchedule(employee.id);
    this.dialogOpen.set(true);
  }
  close(): void {
    this.dialogOpen.set(false);
    this.passwordToggle.show.set(false);
    this.clearPhoto();
    this.scheduleError.set(null);
  }
  selectTab(tab: 'personal' | 'schedule'): void {
    this.activeTab.set(tab);
  }
  setScheduleEnabled(day: string, enabled: boolean): void {
    this.schedule.update(days =>
      days.map(item =>
        item.day === day
          ? {
              ...item,
              enabled,
              fromTime: enabled ? item.fromTime : this.parseScheduleTime(null),
              toTime: enabled ? item.toTime : this.parseScheduleTime(null, 17, 0),
            }
          : item
      )
    );
    this.scheduleError.set(null);
  }
  updateScheduleFromTime(day: string, time: Date): void {
    this.schedule.update(days =>
      days.map(item => (item.day === day ? { ...item, fromTime: time } : item))
    );
    this.scheduleError.set(null);
  }
  updateScheduleToTime(day: string, time: Date): void {
    this.schedule.update(days =>
      days.map(item => (item.day === day ? { ...item, toTime: time } : item))
    );
    this.scheduleError.set(null);
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
      mobileNumber: getE164PhoneNumber(value.mobileNumber),
      userName: getE164PhoneNumber(value.userName),
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
        switchMap(employee =>
          this.service.updateSchedule(employee.id, { days: this.toSchedulePayload(this.schedule()) })
        ),
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
        error: (error: HttpErrorResponse) => this.handleSaveError(error),
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
    return this.translate.instant(`EMPLOYEES.ROLES.${role}`);
  }
  roleOptions(): { label: string; value: EmployeeRole }[] {
    return this.roles.map(role => ({
      label: this.translate.instant(`EMPLOYEES.ROLES.${role}`),
      value: role,
    }));
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
          this.schedule.set(
            schedule.days.map(day => ({
              day: day.day,
              enabled: day.enabled,
              fromTime: this.parseScheduleTime(day.fromTime),
              toTime: this.parseScheduleTime(day.toTime, 17, 0),
            }))
          );
          this.scheduleLoading.set(false);
        },
        error: () => this.scheduleLoading.set(false),
      });
  }
  private handleSaveError(error: HttpErrorResponse): void {
    this.saving.set(false);
    this.scheduleError.set(null);

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

    const scheduleMessage = this.scheduleErrorMessage(error);
    this.scheduleError.set(scheduleMessage);
    this.activeTab.set('schedule');
  }
  private scheduleErrorMessage(error: HttpErrorResponse): string {
    const code = Object.values(
      (error.error as { errorCodes?: Record<string, string[]> })?.errorCodes ?? {}
    ).flat()[0];
    if (code) {
      const translated = this.translate.instant(`ERRORS.${code}`);
      return translated === `ERRORS.${code}` ? code : translated;
    }
    return (
      Object.values(
        (error.error as { errors?: Record<string, string[]> })?.errors ?? {}
      ).flat()[0] ?? this.translate.instant('EMPLOYEES.SCHEDULE_SAVE_FAILED')
    );
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
  private toSchedulePayload(days: ScheduleDayUi[]): EmployeeWorkingDay[] {
    return days.map(day => ({
      day: day.day,
      enabled: day.enabled,
      fromTime: day.enabled ? this.formatScheduleTime(day.fromTime) : null,
      toTime: day.enabled ? this.formatScheduleTime(day.toTime) : null,
    }));
  }
}
