import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';

export interface ApiErrorBody {
  title?: string;
  message?: string;
  errors?: Record<string, string[]>;
  errorCodes?: Record<string, string[]>;
}

/** Maps API field names to form control names. */
const API_FIELD_MAP: Record<string, string> = {
  phoneNumber: 'phone',
  PhoneNumber: 'phone',
};

/** Maps legacy/global API fields to OTP form field names. */
const OTP_API_FIELD_ALIASES: Record<string, string> = {
  detail: 'code',
};

/** Maps English API messages to catalog codes when errorCodes is absent. */
const API_MESSAGE_TO_CODE: Record<string, string> = {
  'Invalid OTP code.': 'OtpInvalid',
  'OTP has expired.': 'OtpExpired',
  'Invalid or expired OTP code.': 'OtpInvalid',
};

function mapApiField(field: string): string {
  return API_FIELD_MAP[field] ?? field;
}

function firstValue(values: string[] | undefined): string | null {
  const value = values?.[0];
  return value?.trim() ? value : null;
}

export function extractApiError(error: HttpErrorResponse): string {
  const body = error.error as ApiErrorBody | null;

  if (body?.errorCodes) {
    const codes = Object.values(body.errorCodes).flat();
    if (codes.length > 0) {
      return codes.join(' ');
    }
  }

  if (body?.errors) {
    const messages = Object.values(body.errors).flat();
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return body?.message ?? body?.title ?? 'Request failed.';
}

/** Returns i18n keys when available, otherwise fallback messages. */
export function extractApiFieldErrors(error: HttpErrorResponse): Record<string, string> {
  const body = error.error as ApiErrorBody | null;
  if (!body) {
    return {};
  }

  const result: Record<string, string> = {};
  const fields = new Set([
    ...Object.keys(body.errorCodes ?? {}),
    ...Object.keys(body.errors ?? {}),
  ]);

  for (const apiField of fields) {
    const code = firstValue(body.errorCodes?.[apiField]);
    const message = firstValue(body.errors?.[apiField]);
    const value = code ?? message;
    if (value) {
      result[mapApiField(apiField)] = value;
    }
  }

  return result;
}

export function hasApiFieldErrors(error: HttpErrorResponse): boolean {
  const body = error.error as ApiErrorBody | null;
  const hasCodes = !!body?.errorCodes && Object.keys(body.errorCodes).length > 0;
  const hasErrors = !!body?.errors && Object.keys(body.errors).length > 0;
  return hasCodes || hasErrors;
}

function resolveErrorCode(codeOrMessage: string): string {
  if (/^[A-Z][A-Za-z0-9]*$/.test(codeOrMessage)) {
    return codeOrMessage;
  }
  return API_MESSAGE_TO_CODE[codeOrMessage] ?? codeOrMessage;
}

export function translateApiFieldErrors(
  fieldErrors: Record<string, string>,
  translate: (key: string) => string
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, codeOrMessage]) => {
      const code = resolveErrorCode(codeOrMessage);
      const errorKey = `ERRORS.${code}`;
      const translated = translate(errorKey);
      return [field, translated !== errorKey ? translated : codeOrMessage];
    })
  );
}

/** Resolves OTP verify 401 errors for inline display on the code field. */
export function extractOtpFieldError(
  error: HttpErrorResponse,
  translate: (key: string) => string
): string | null {
  const aliased: Record<string, string> = {};

  for (const [field, value] of Object.entries(extractApiFieldErrors(error))) {
    const target = OTP_API_FIELD_ALIASES[field] ?? field;
    if (!aliased[target]) {
      aliased[target] = value;
    }
  }

  const translated = translateApiFieldErrors(aliased, translate);
  return translated['code'] ?? null;
}

export function applyServerFieldErrors(
  form: FormGroup,
  fieldErrors: Record<string, string>
): void {
  for (const [field, message] of Object.entries(fieldErrors)) {
    const control = form.get(field);
    if (!control) {
      continue;
    }
    control.setErrors({ ...control.errors, server: message });
    control.markAsTouched();
  }
}

export function clearServerFieldError(form: FormGroup, field: string): void {
  const control = form.get(field);
  if (!control?.errors?.['server']) {
    return;
  }

  const { server: _removed, ...remaining } = control.errors;
  control.setErrors(Object.keys(remaining).length > 0 ? remaining : null);
}
