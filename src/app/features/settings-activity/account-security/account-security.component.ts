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
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
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

import { SettingsFooterComponent } from '../components/settings-footer/settings-footer.component';
import { DEVICE_ICONS, MOCK_ACCESS_USERS, AccessUser } from '../models/settings-activity.model';
import { SettingsActivityService, AuthorizedUserDto } from '../services/settings-activity.service';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
}

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

  passwordForm!: FormGroup;
  otpCode = signal('');
  users = signal<AccessUser[]>(structuredClone(MOCK_ACCESS_USERS));
  enable2fa = signal(true);
  loginAlerts = signal(true);
  logoutOthers = signal(true);
  saving = signal(false);
  sendingOtp = signal(false);

  readonly deviceIcons = DEVICE_ICONS;
  maskedPhone = signal('+20 010 1234 5678');

  menuItems: MenuItem[] = [];

  ngOnInit(): void {
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordMatchValidator }
    );

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
          this.maskedPhone.set(res.maskedPhone || '+20 *** **** ****');
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
            detail: this.maskedPhone(),
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
    if (this.passwordForm.invalid) {
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
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_TITLE'),
            detail: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_DETAIL'),
          });
        },
        error: () => this.showRequestError(),
      });
  }

  isInvalid(controlName: string): boolean {
    const control = this.passwordForm.get(controlName);
    return !!(control?.invalid && control.touched);
  }

  getDeviceIcon(device: AccessUser['device']): string {
    return this.deviceIcons[device];
  }

  hasPasswordMismatch(): boolean {
    return !!(
      this.passwordForm.hasError('passwordMismatch') &&
      this.passwordForm.get('confirmPassword')?.touched
    );
  }

  private showRequestError(): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Settings',
      detail: 'Unable to save security settings.',
    });
  }
}
