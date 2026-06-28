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

import {
  AuthApiEndpoint,
  PUBLIC_AUTH_API_ENDPOINTS,
  urlIncludesAuthEndpoint,
} from '../constants/auth-api-endpoint.enum';
import { AuthService } from '../services/auth.service';
import { AuthTokens } from '../models/user.model';

// Module-level state shared across all calls to this interceptor function.
// This is intentional: we need a single "is refreshing" gate regardless of
// how many concurrent requests are in flight.
let isRefreshing = false;
const refreshSubject$ = new BehaviorSubject<string | null>(null);

function matchesUrlFragment(url: string, fragments: AuthApiEndpoint[]): boolean {
  return urlIncludesAuthEndpoint(url, fragments);
}

function isPublicAuthUrl(url: string): boolean {
  return matchesUrlFragment(url, [...PUBLIC_AUTH_API_ENDPOINTS]);
}

function shouldRefreshOn401(url: string): boolean {
  return !isPublicAuthUrl(url) && !url.includes(AuthApiEndpoint.Logout);
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
  const isPublicAuth = isPublicAuthUrl(req.url);

  const outgoingReq =
    token && !isPublicAuth ? attachToken(req, token) : req;

  return next(outgoingReq).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        shouldRefreshOn401(req.url)
      ) {
        return handle401(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};
