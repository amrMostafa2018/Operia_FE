import { HttpErrorResponse } from '@angular/common/http';
import { OtpLabels } from '../components/otp-verification/otp-labels.model';
import { extractOtpFieldError } from '../../core/utils/api-error.util';

export function handleOtpVerifyError(
  err: HttpErrorResponse,
  translateFn: (key: string) => string
): string | null {
  return extractOtpFieldError(err, translateFn);
}

export function buildOtpLabels(prefix: string): OtpLabels {
  const k = (s: string) => `${prefix}.${s}`;
  return {
    title: k('OTP_TITLE'),
    subtitle: k('OTP_SUBTITLE'),
    code: k('OTP_CODE'),
    placeholder: k('OTP_PLACEHOLDER'),
    invalid: k('OTP_INVALID'),
    verify: k('OTP_VERIFY'),
    back: k('OTP_BACK'),
    resend: k('OTP_RESEND'),
    resendIn: k('OTP_RESEND_IN'),
  };
}
