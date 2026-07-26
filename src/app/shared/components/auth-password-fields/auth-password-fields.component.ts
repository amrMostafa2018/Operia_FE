import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AbstractControl, ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-auth-password-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputTextModule],
  templateUrl: './auth-password-fields.component.html',
  styleUrl: './auth-password-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true }),
    },
  ],
})
export class AuthPasswordFieldsComponent {
  readonly passwordControlName = input('password');
  readonly confirmControlName = input('confirmPassword');
  readonly passwordInputId = input.required<string>();
  readonly confirmInputId = input.required<string>();
  readonly passwordLabelKey = input('AUTH.PASSWORD');
  readonly confirmLabelKey = input('AUTH.REGISTER_PAGE.CONFIRM_PASSWORD');
  readonly passwordPlaceholderKey = input('AUTH.LOGIN_PAGE.PASSWORD_PLACEHOLDER');
  readonly confirmPlaceholderKey = input('AUTH.REGISTER_PAGE.CONFIRM_PLACEHOLDER');
  readonly showPassword = input(false);
  readonly showConfirm = input(false);
  readonly passwordInvalid = input(false);
  readonly confirmInvalid = input(false);
  readonly passwordControl = input<AbstractControl | null>(null);
  readonly confirmControl = input<AbstractControl | null>(null);
  readonly showPasswordHint = input(false);
  readonly passwordRequiredKey = input('AUTH.REGISTER_PAGE.PASSWORD_REQUIRED');
  readonly passwordMinKey = input('AUTH.REGISTER_PAGE.PASSWORD_MIN');
  readonly passwordPatternKey = input('AUTH.REGISTER_PAGE.PASSWORD_PATTERN');
  readonly confirmRequiredKey = input('AUTH.REGISTER_PAGE.CONFIRM_REQUIRED');
  readonly mismatchKey = input('AUTH.REGISTER_PAGE.PASSWORD_MISMATCH');

  togglePassword = input<() => void>(() => undefined);
  toggleConfirm = input<() => void>(() => undefined);
}
