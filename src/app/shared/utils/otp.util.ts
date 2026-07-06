import { HttpErrorResponse } from '@angular/common/http';

import { extractOtpFieldError } from '@core/utils/api-error.util';
import { OtpLabels } from '@app/shared/components/otp-verification/otp-labels.model';

export function buildOtpLabels(prefix: string): OtpLabels {
  return {
    title: `${prefix}.OTP_TITLE`,
    subtitle: `${prefix}.OTP_SUBTITLE`,
    code: `${prefix}.OTP_CODE`,
    placeholder: `${prefix}.OTP_PLACEHOLDER`,
    invalid: `${prefix}.OTP_INVALID`,
    verify: `${prefix}.OTP_VERIFY`,
    back: `${prefix}.OTP_BACK`,
    resend: `${prefix}.OTP_RESEND`,
    resendIn: `${prefix}.OTP_RESEND_IN`,
  };
}

export function handleOtpVerifyError(
  err: HttpErrorResponse,
  translate: (key: string) => string
): string {
  const fieldError = extractOtpFieldError(err, translate);
  if (fieldError) {
    return fieldError;
  }

  return translate('AUTH.ERROR.UNEXPECTED');
}
