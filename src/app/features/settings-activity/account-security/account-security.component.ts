import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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

import { SettingsFooterComponent } from '../components/settings-footer/settings-footer.component';
import {
  DEVICE_ICONS,
  MOCK_ACCESS_USERS,
  AccessUser,
} from '../models/settings-activity.model';

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

  passwordForm!: FormGroup;
  otpCode = signal('');
  users = signal<AccessUser[]>(structuredClone(MOCK_ACCESS_USERS));
  enable2fa = signal(false);
  loginAlerts = signal(true);
  saving = signal(false);
  sendingOtp = signal(false);

  readonly deviceIcons = DEVICE_ICONS;
  readonly maskedPhone = '+20 010 1234 5678';

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
  }

  selectedUserId = signal<string | null>(null);

  openMenu(event: Event, menu: { toggle: (e: Event) => void }, userId: string): void {
    this.selectedUserId.set(userId);
    menu.toggle(event);
  }

  onSendOtp(): void {
    this.sendingOtp.set(true);
    setTimeout(() => {
      this.sendingOtp.set(false);
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.PASSWORD.OTP_SENT'),
        detail: this.maskedPhone,
      });
    }, 600);
  }

  onChangePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) {
      return;
    }
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.PASSWORD.CHANGED'),
    });
    this.passwordForm.reset();
    this.otpCode.set('');
  }

  onLogoutOtherDevices(): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.OPTIONS.LOGOUT_DONE'),
    });
  }

  onBanUser(): void {
    const id = this.selectedUserId();
    if (!id) return;
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.USERS.BAN'),
      detail: id,
    });
  }

  onDeleteUser(): void {
    const id = this.selectedUserId();
    if (!id) return;
    this.users.update(list => list.filter(u => u.id !== id));
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.USERS.DELETED'),
    });
  }

  onDeactivateAccount(): void {
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.DEACTIVATE.TITLE'),
      detail: this.translate.instant('SETTINGS_ACTIVITY.SECURITY.DEACTIVATE.STUB'),
    });
  }

  onSave(): void {
    this.saving.set(true);
    setTimeout(() => {
      this.saving.set(false);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_TITLE'),
        detail: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_DETAIL'),
      });
    }, 400);
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
}
