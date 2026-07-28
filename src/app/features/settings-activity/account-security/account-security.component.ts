import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TableModule } from 'primeng/table';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  passwordMatchValidatorFor,
  setupPasswordConfirmSync,
} from '@core/utils/validators.util';
import { isFieldInvalid } from '@app/shared/utils/form-field.util';
import { showSettingsSavedToast } from '@app/shared/utils/settings-toast.util';
import { AuthStore } from '@core/store/auth.store';
import { SettingsFooterComponent } from '../components/settings-footer/settings-footer.component';
import { DEVICE_ICONS, MOCK_ACCESS_USERS, AccessUser } from '../models/settings-activity.model';
import { SettingsActivityService, AuthorizedUserDto } from '../services/settings-activity.service';

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    InputSwitchModule,
    InputTextModule,
    MenuModule,
    TableModule,
    SettingsFooterComponent,
  ],
  templateUrl: './account-security.component.html',
  styleUrl: './account-security.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSecurityComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly settingsService = inject(SettingsActivityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authStore = inject(AuthStore);

  passwordForm!: FormGroup;
  otpCode = signal('');
  otpTouched = signal(false);
  users = signal<AccessUser[]>(structuredClone(MOCK_ACCESS_USERS));
  enable2fa = signal(true);
  loginAlerts = signal(true);
  logoutOthers = signal(true);
  saving = signal(false);
  sendingOtp = signal(false);

  readonly deviceIcons = DEVICE_ICONS;
  phoneNumber = signal(this.authStore.currentUser()?.phoneNumber ?? '');

  menuItems: MenuItem[] = [];

  ngOnInit(): void {
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, passwordMatchValidatorFor('newPassword')]],
    });

    setupPasswordConfirmSync(this.passwordForm, this.destroyRef, 'newPassword', 'confirmPassword');

    this.menuItems = [
      {
        label: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.USERS.BAN'),
        icon: 'pi pi-ban',
        styleClass: 'danger-item',
        command: () => this.onBanUser(),
      },
      {
        label: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.USERS.DELETE'),
        icon: 'pi pi-trash',
        styleClass: 'danger-item',
        command: () => this.onDeleteUser(),
      },
    ];

    this.loadSecurity();
  }

  private loadSecurity(): void {
    this.settingsService
      .getSecurity()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.enable2fa.set(res.enableTwoFactorAuthentication);
          this.loginAlerts.set(res.loginAlertsEnabled);
          this.phoneNumber.set(
            res.phoneNumber ?? this.authStore.currentUser()?.phoneNumber ?? res.maskedPhone ?? ''
          );
          if (res.users && res.users.length > 0) {
            const mapped: AccessUser[] = res.users.map((u: AuthorizedUserDto) => ({
              id: u.id,
              name: u.name || u.email || 'User',
              email: u.email || '',
              lastLogin: '-',
              device: 'windows' as const,
              isBanned: u.isBanned,
            }));
            this.users.set(mapped);
          }
        },
        error: () => {
          // keep defaults if fetch fails
        },
      });
  }

  selectedUserId = signal<string | null>(null);

  openMenu(event: Event, menu: { toggle: (e: Event) => void }, userId: string): void {
    this.selectedUserId.set(userId);
    menu.toggle(event);
  }

  onSendOtp(): void {
    this.sendingOtp.set(true);
    this.settingsService
      .sendPasswordOtp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sendingOtp.set(false);
          this.messageService.add({
            severity: 'info',
            summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.PASSWORD.OTP_SENT'),
            detail: this.phoneNumber(),
          });
        },
        error: () => {
          this.sendingOtp.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Security',
            detail: 'Failed to send OTP.',
          });
        },
      });
  }

  onChangePassword(): void {
    this.passwordForm.markAllAsTouched();
    this.otpTouched.set(true);
    if (this.passwordForm.invalid || !this.otpCode() || this.otpCode().length < 6) {
      return;
    }
    const value = this.passwordForm.value;
    this.settingsService
      .changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        otpCode: this.otpCode(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.PASSWORD.CHANGED'),
          });
          this.passwordForm.reset();
          this.otpCode.set('');
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Security',
            detail: 'Failed to change password. Check OTP or current password.',
          });
        },
      });
  }

  onLogoutOthersChange(enabled: boolean): void {
    this.logoutOthers.set(enabled);
    if (enabled) {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.OPTIONS.LOGOUT_DONE'),
      });
    }
  }

  onBanUser(): void {
    const id = this.selectedUserId();
    if (!id) return;
    this.settingsService
      .banUser(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.update(list => list.map(u => (u.id === id ? { ...u, isBanned: true } : u)));
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.USERS.BAN'),
            detail: id,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Security',
            detail: 'Failed to block user.',
          });
        },
      });
  }

  onDeleteUser(): void {
    const id = this.selectedUserId();
    if (!id) return;
    this.settingsService
      .deleteUser(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.update(list => list.filter(u => u.id !== id));
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.USERS.DELETED'),
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Security',
            detail: 'Failed to delete user.',
          });
        },
      });
  }

  onDeactivateAccount(): void {
    this.settingsService
      .deactivateAccount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.DEACTIVATE.TITLE'),
            detail: 'Account deactivated.',
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Security',
            detail: 'Failed to deactivate account.',
          });
        },
      });
  }

  onSave(): void {
    this.saving.set(true);
    this.settingsService
      .updateSecurity({
        enableTwoFactorAuthentication: this.enable2fa(),
        loginAlertsEnabled: this.loginAlerts(),
        logoutOtherDevices: this.logoutOthers(),
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.logoutOthers.set(false);
          showSettingsSavedToast(this.messageService, this.translate);
        },
        error: () => this.showRequestError(),
      });
  }

  isInvalid(controlName: string): boolean {
    return isFieldInvalid(this.passwordForm, controlName);
  }

  getPasswordFieldError(controlName: string): string | null {
    const control = this.passwordForm.get(controlName);
    if (!control?.touched || !control.invalid) {
      return null;
    }
    if (control.errors?.['required']) {
      switch (controlName) {
        case 'currentPassword':
        case 'newPassword':
          return this.translate.instant('ERRORS.PasswordRequired');
        case 'confirmPassword':
          return this.translate.instant('ERRORS.ConfirmPasswordRequired');
        default:
          return this.translate.instant('ERRORS.FieldRequired');
      }
    }
    if (control.errors?.['minlength']) {
      return this.translate.instant('ERRORS.PasswordMinLength');
    }
    return null;
  }

  getOtpError(): string | null {
    if (!this.otpTouched()) {
      return null;
    }
    if (!this.otpCode() || this.otpCode().length < 6) {
      return this.translate.instant('ERRORS.OtpRequired');
    }
    return null;
  }

  getDeviceIcon(device: AccessUser['device']): string {
    return this.deviceIcons[device];
  }

  hasPasswordMismatch(): boolean {
    const control = this.passwordForm.get('confirmPassword');
    return !!(control?.errors?.['mismatch'] && control.touched);
  }

  private showRequestError(): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Settings',
      detail: 'Unable to save security settings.',
    });
  }
}
