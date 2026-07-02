import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApiAuthResponse,
  AuthTokens,
  LoginInitiateResponse,
  LoginRequest,
  RegisterInitiateRequest,
  RegisterInitiateResponse,
  User,
  VerifyLoginOtpRequest,
  VerifyRegisterOtpRequest,
  ResendLoginOtpRequest,
  ResendRegisterOtpRequest,
} from '../models/user.model';
import { AuthStore } from '../store/auth.store';
import {
  AuthApiEndpoint,
  buildAuthApiUrl,
} from '../constants/auth-api-endpoint.enum';
import { extractApiError } from '../utils/api-error.util';
import { userFromAccessToken } from '../utils/jwt.util';

const RT_KEY = 'operia_rt';
const USER_KEY = 'operia_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly api = environment.apiUrl;
  private loggingOut = false;

  // ─── Public API ────────────────────────────────────────────────────────────

  initiateLogin(request: LoginRequest): Observable<LoginInitiateResponse> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http
      .post<LoginInitiateResponse>(buildAuthApiUrl(this.api, AuthApiEndpoint.Login), {
        phoneNumber: request.phoneNumber,
        password: request.password,
      })
      .pipe(
        tap(() => this.authStore.setLoading(false)),
        catchError((err: HttpErrorResponse) => {
          this.authStore.setLoading(false);
          this.authStore.setError(extractApiError(err));
          return throwError(() => err);
        })
      );
  }

  verifyLoginOtp(
    request: VerifyLoginOtpRequest,
    rememberMe = false
  ): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http
      .post<ApiAuthResponse>(buildAuthApiUrl(this.api, AuthApiEndpoint.VerifyOtp), request)
      .pipe(
        tap((res) => {
          const user = userFromAccessToken(res.accessToken);
          this.authStore.setUser(user);
          this.authStore.setAccessToken(res.accessToken);
          this.persistSession(user, res.refreshToken, rememberMe);
          this.authStore.setLoading(false);
        }),
        map(() => void 0),
        catchError((err: HttpErrorResponse) => {
          this.authStore.setLoading(false);
          this.authStore.setError(extractApiError(err));
          return throwError(() => err);
        })
      );
  }

  initiateRegistration(request: RegisterInitiateRequest): Observable<RegisterInitiateResponse> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http
      .post<RegisterInitiateResponse>(buildAuthApiUrl(this.api, AuthApiEndpoint.Register), request)
      .pipe(
        tap(() => this.authStore.setLoading(false)),
        catchError((err: HttpErrorResponse) => {
          this.authStore.setLoading(false);
          this.authStore.setError(extractApiError(err));
          return throwError(() => err);
        })
      );
  }

  verifyRegisterOtp(
    request: VerifyRegisterOtpRequest,
    displayName?: string
  ): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http
      .post<ApiAuthResponse>(buildAuthApiUrl(this.api, AuthApiEndpoint.VerifyRegisterOtp), request)
      .pipe(
        tap((res) => {
          const user = userFromAccessToken(res.accessToken, displayName);
          this.authStore.setUser(user);
          this.authStore.setAccessToken(res.accessToken);
          this.persistSession(user, res.refreshToken, false);
          this.authStore.setLoading(false);
        }),
        map(() => void 0),
        catchError((err: HttpErrorResponse) => {
          this.authStore.setLoading(false);
          this.authStore.setError(extractApiError(err));
          return throwError(() => err);
        })
      );
  }

  resendLoginOtp(request: ResendLoginOtpRequest): Observable<void> {
    return this.http.post<void>(
      buildAuthApiUrl(this.api, AuthApiEndpoint.ResendLoginOtp),
      request
    );
  }

  resendRegisterOtp(request: ResendRegisterOtpRequest): Observable<void> {
    return this.http.post<void>(
      buildAuthApiUrl(this.api, AuthApiEndpoint.ResendRegisterOtp),
      request
    );
  }

  logout(): void {
    this.loggingOut = true;

    this.http
      .post(buildAuthApiUrl(this.api, AuthApiEndpoint.Logout), {})
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.clearSession();
          this.loggingOut = false;
          this.router.navigate(['/auth/login']);
        })
      )
      .subscribe();
  }

  isLoggingOut(): boolean {
    return this.loggingOut;
  }

  /**
   * Uses the stored refresh token to obtain a new access token.
   * Called automatically by the JWT interceptor on 401 responses,
   * and during app initialisation to restore the session.
   */
  refreshAccessToken(): Observable<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    return this.http
      .post<AuthTokens>(buildAuthApiUrl(this.api, AuthApiEndpoint.Refresh), { refreshToken })
      .pipe(
        tap((tokens) => {
          this.authStore.setAccessToken(tokens.accessToken);
          this.syncUserFromAccessToken();
          this.updateStoredRefreshToken(tokens.refreshToken);
        }),
        catchError((err) => {
          this.clearSession();
          return throwError(() => err);
        })
      );
  }

  /**
   * Attempts to restore an existing session on app startup.
   * Returns true if the session was successfully restored.
   */
  restoreSession(): Observable<boolean> {
    const refreshToken = this.getRefreshToken();
    const storedUser = this.getStoredUser();

    if (!refreshToken || !storedUser) {
      return of(false);
    }

    // Optimistically restore the user so guards work immediately,
    // then exchange the refresh token in the background.
    this.authStore.setUser(storedUser);

    return this.refreshAccessToken().pipe(
      tap(() => this.syncUserFromAccessToken()),
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  getAccessToken(): string | null {
    return this.authStore.accessToken();
  }

  getRefreshToken(): string | null {
    return (
      localStorage.getItem(RT_KEY) ?? sessionStorage.getItem(RT_KEY) ?? null
    );
  }

  isAuthenticated(): boolean {
    return this.authStore.isAuthenticated();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private syncUserFromAccessToken(displayName?: string): void {
    const token = this.authStore.accessToken();
    if (!token) {
      return;
    }

    const storedUser = this.getStoredUser();
    const user = userFromAccessToken(token, displayName ?? storedUser?.name);
    this.authStore.setUser(user);
    this.updateStoredUser(user);
  }

  private persistSession(user: User, refreshToken: string, rememberMe?: boolean): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(RT_KEY, refreshToken);
    storage.setItem(USER_KEY, JSON.stringify(user));
  }

  private updateStoredRefreshToken(refreshToken: string): void {
    if (localStorage.getItem(RT_KEY)) {
      localStorage.setItem(RT_KEY, refreshToken);
    } else {
      sessionStorage.setItem(RT_KEY, refreshToken);
    }
  }

  private updateStoredUser(user: User): void {
    const json = JSON.stringify(user);
    if (localStorage.getItem(RT_KEY)) {
      localStorage.setItem(USER_KEY, json);
    } else {
      sessionStorage.setItem(USER_KEY, json);
    }
  }

  private getStoredUser(): User | null {
    const json =
      localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as User;
    } catch {
      return null;
    }
  }

  private clearSession(): void {
    localStorage.removeItem(RT_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(RT_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.authStore.clearAuth();
  }
}
