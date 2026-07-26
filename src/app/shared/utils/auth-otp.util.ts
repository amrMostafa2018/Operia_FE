import { DestroyRef, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Observable } from 'rxjs';

import { handleOtpVerifyError } from '@app/shared/utils/otp.util';

export function setOtpVerifyError(
  err: HttpErrorResponse,
  otpServerError: WritableSignal<string | null>,
  translate: (key: string) => string
): void {
  otpServerError.set(handleOtpVerifyError(err, translate));
}

export interface OtpResendToast {
  summary: string;
  detail: string;
  life?: number;
}

export interface OtpResendOptions {
  isResending: WritableSignal<boolean>;
  otpServerError: WritableSignal<string | null>;
  resend$: Observable<unknown>;
  successToast: OtpResendToast;
  messageService: MessageService;
  destroyRef: DestroyRef;
}

export function runOtpResend(options: OtpResendOptions): void {
  options.isResending.set(true);
  options.otpServerError.set(null);

  options.resend$
    .pipe(takeUntilDestroyed(options.destroyRef))
    .subscribe({
      next: () => {
        options.isResending.set(false);
        options.messageService.add({
          severity: 'success',
          ...options.successToast,
        });
      },
      error: () => options.isResending.set(false),
    });
}
