import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import {
  BehaviorSubject,
  catchError,
  filter,
  switchMap,
  take,
  throwError,
} from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AuthTokens } from '../models/user.model';

// Module-level state shared across all calls to this interceptor function.
// This is intentional: we need a single "is refreshing" gate regardless of
// how many concurrent requests are in flight.
let isRefreshing = false;
const refreshSubject$ = new BehaviorSubject<string | null>(null);

/** URLs that must never receive an Authorization header or trigger a refresh. */
const AUTH_URL_FRAGMENTS = [
  '/auth/login',
  '/auth/verify-otp',
  '/auth/verify-register-otp',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
];

function isAuthUrl(url: string): boolean {
  return AUTH_URL_FRAGMENTS.some((fragment) => url.includes(fragment));
}

function attachToken<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handle401<T>(
  req: HttpRequest<T>,
  next: HttpHandlerFn,
  authService: AuthService
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshSubject$.next(null);

    return authService.refreshAccessToken().pipe(
      switchMap((tokens: AuthTokens) => {
        isRefreshing = false;
        refreshSubject$.next(tokens.accessToken);
        return next(attachToken(req, tokens.accessToken));
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshSubject$.next(null);
        return throwError(() => err);
      })
    );
  }

  // Queue concurrent requests until the refresh completes.
  return refreshSubject$.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token) => next(attachToken(req, token)))
  );
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const token = authService.getAccessToken();
  const shouldSkip = isAuthUrl(req.url);

  const outgoingReq =
    token && !shouldSkip ? attachToken(req, token) : req;

  return next(outgoingReq).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !shouldSkip
      ) {
        return handle401(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};
