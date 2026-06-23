import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

interface ApiError {
  message?: string;
  errors?: Record<string, string[]>;
}

function resolveMessage(error: HttpErrorResponse): string {
  const body = error.error as ApiError | null;

  switch (error.status) {
    case 0:
      return 'Network error. Please check your connection.';
    case 400:
      return body?.message ?? 'Invalid request. Please check your input.';
    case 401:
      if (body?.errors?.['detail']?.[0]) {
        return body.errors['detail'][0];
      }
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return body?.message ?? 'The requested resource was not found.';
    case 409:
      return body?.message ?? 'A conflict occurred. Please refresh and try again.';
    case 422:
      return body?.message ?? 'Validation failed. Please check your input.';
    case 500:
    case 502:
    case 503:
      return 'A server error occurred. Please try again later.';
    default:
      return body?.message ?? 'An unexpected error occurred.';
  }
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const router = inject(Router);
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const userMessage = resolveMessage(error);

      // 401 navigation is handled here only if the JWT interceptor could not
      // recover (i.e. the refresh itself failed and rethrew).
      if (
        error.status === 401 &&
        !req.url.includes('/auth/verify-register-otp') &&
        !req.url.includes('/auth/verify-otp')
      ) {
        router.navigate(['/auth/login']);
      }

      if (error.status === 403) {
        router.navigate(['/unauthorized']);
      }

      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: userMessage,
        life: 6000,
      });

      // Augment the original error with a user-friendly message so callers
      // can display it without duplicating resolution logic.
      return throwError(() => Object.assign(error, { userMessage }));
    })
  );
};
