import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { OtpLabels } from './otp-labels.model';

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ButtonModule],
  templateUrl: './otp-verification.component.html',
  styleUrl: './otp-verification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpVerificationComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly fb = inject(FormBuilder);

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  labels = input.required<OtpLabels>();
  isLoading = input(false);
  isResending = input(false);
  submitIcon = input('pi pi-arrow-right');
  inputId = input('otpCode');
  serverError = input<string | null>(null);
  resendCooldownSeconds = input(60);

  verify = output<string>();
  resend = output<void>();
  back = output<void>();

  readonly otpLength = 6;
  readonly digitIndices = Array.from({ length: this.otpLength }, (_, index) => index);

  form!: FormGroup;
  resendCountdown = signal(0);

  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.form = this.fb.group({
      digits: this.fb.array(
        Array.from({ length: this.otpLength }, () =>
          this.fb.control('', [Validators.required, Validators.pattern(/^\d$/)])
        )
      ),
    });
    this.startResendCooldown();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.focusDigit(0));
  }

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  get digits(): FormArray {
    return this.form.get('digits') as FormArray;
  }

  digitControl(index: number): FormControl {
    return this.digits.at(index) as FormControl;
  }

  isInvalid(): boolean {
    return !!(this.digits.invalid && this.digits.touched);
  }

  canResend(): boolean {
    return this.resendCountdown() === 0 && !this.isResending() && !this.isLoading();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.verify.emit(this.getCode());
  }

  onResend(): void {
    if (!this.canResend()) {
      return;
    }

    this.resetDigits();
    this.startResendCooldown();
    this.resend.emit();
  }

  onBack(): void {
    this.resetDigits();
    this.clearCountdown();
    this.back.emit();
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/\D/g, '');

    if (rawValue.length > 1) {
      this.fillDigitsFromString(rawValue, index);
      return;
    }

    const value = rawValue.slice(-1);
    this.digitControl(index).setValue(value, { emitEvent: false });
    input.value = value;

    if (value && index < this.otpLength - 1) {
      this.focusDigit(index + 1);
    }
  }

  onDigitKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digitControl(index).value && index > 0) {
      event.preventDefault();
      this.digitControl(index - 1).setValue('');
      const previousInput = this.digitInputs.get(index - 1)?.nativeElement;
      if (previousInput) {
        previousInput.value = '';
      }
      this.focusDigit(index - 1);
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusDigit(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < this.otpLength - 1) {
      event.preventDefault();
      this.focusDigit(index + 1);
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '') ?? '';
    if (pasted) {
      this.fillDigitsFromString(pasted, 0);
    }
  }

  private getCode(): string {
    return this.digits.controls.map(control => control.value ?? '').join('');
  }

  private fillDigitsFromString(value: string, startIndex: number): void {
    const chars = value.slice(0, this.otpLength - startIndex).split('');

    chars.forEach((char, offset) => {
      const index = startIndex + offset;
      this.digitControl(index).setValue(char);
      const input = this.digitInputs.get(index)?.nativeElement;
      if (input) {
        input.value = char;
      }
    });

    const focusIndex = Math.min(startIndex + chars.length, this.otpLength - 1);
    this.focusDigit(focusIndex);
  }

  private focusDigit(index: number): void {
    const input = this.digitInputs.get(index)?.nativeElement;
    input?.focus();
    input?.select();
  }

  private resetDigits(): void {
    this.form.reset();
    this.digitInputs?.forEach(ref => {
      ref.nativeElement.value = '';
    });
  }

  private startResendCooldown(): void {
    this.clearCountdown();
    this.resendCountdown.set(this.resendCooldownSeconds());

    this.countdownTimer = setInterval(() => {
      const next = this.resendCountdown() - 1;
      if (next <= 0) {
        this.resendCountdown.set(0);
        this.clearCountdown();
      } else {
        this.resendCountdown.set(next);
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
