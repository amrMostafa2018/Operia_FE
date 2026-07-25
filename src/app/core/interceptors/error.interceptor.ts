import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '@core/services/auth.service';
import {
  AuthApiEndpoint,
  AUTH_FORM_API_ENDPOINTS,
  OTP_AUTH_API_ENDPOINTS,
  urlIncludesAuthEndpoint,
} from '@core/constants/auth-api-endpoint.enum';
import { extractApiError, hasApiFieldErrors } from '@core/utils/api-error.util';

function resolveMessage(error: HttpErrorResponse, translate: TranslateService): string {
  switch (error.status) {
    case 0:
      return translate.instant('HTTP_ERRORS.NETWORK');
    case 400:
    case 422:
      return extractApiError(error);
    case 401:
      return extractApiError(error);
    case 403:
      return translate.instant('HTTP_ERRORS.FORBIDDEN');
    case 404: {
      const body = error.error as { message?: string } | null;
      return body?.message ?? translate.instant('HTTP_ERRORS.NOT_FOUND');
    }
    case 409: {
      const body = error.error as { message?: string } | null;
      return body?.message ?? translate.instant('HTTP_ERRORS.CONFLICT');
    }
    case 500:
    case 502:
    case 503:
      return translate.instant('HTTP_ERRORS.SERVER');
    default: {
      const body = error.error as { message?: string } | null;
      return body?.message ?? translate.instant('HTTP_ERRORS.UNEXPECTED');
    }
  }
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const router = inject(Router);
  const messageService = inject(MessageService);
  const authService = inject(AuthService);
  const translate = inject(TranslateService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const isLogoutRequest = req.url.includes(AuthApiEndpoint.Logout);
      const suppressSessionError = authService.isLoggingOut() || isLogoutRequest;

      if (suppressSessionError) {
        return throwError(() => error);
      }

      const userMessage = resolveMessage(error, translate);
      const skipToast =
        (error.status === 400 || error.status === 422 || error.status === 401) &&
        hasApiFieldErrors(error);

      const suppressLoginRedirect =
        urlIncludesAuthEndpoint(req.url, OTP_AUTH_API_ENDPOINTS) ||
        urlIncludesAuthEndpoint(req.url, AUTH_FORM_API_ENDPOINTS);

      if (error.status === 401 && !suppressLoginRedirect) {
        router.navigate(['/auth/login']);
      }

      if (error.status === 403) {
        router.navigate(['/unauthorized']);
      }

      if (!skipToast) {
        messageService.add({
          severity: 'error',
          summary: translate.instant('HTTP_ERRORS.SUMMARY'),
          detail: userMessage,
          life: 6000,
        });
      }

      return throwError(() => Object.assign(error, { userMessage }));
    })
  );
};
