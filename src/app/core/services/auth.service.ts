import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  catchError,
  map,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthTokens, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from '../models/user.model';
import { AuthStore } from '../store/auth.store';

const RT_KEY = 'operia_rt';
const USER_KEY = 'operia_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly api = environment.apiUrl;

  // ─── Public API ────────────────────────────────────────────────────────────

  login(request: LoginRequest): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http
      .post<LoginResponse>(`${this.api}/auth/login`, request)
      .pipe(
        tap((res) => {
          this.authStore.setUser(res.user);
          this.authStore.setAccessToken(res.tokens.accessToken);
          this.persistSession(res.user, res.tokens.refreshToken, request.rememberMe);
          this.authStore.setLoading(false);
        }),
        map(() => void 0),
        catchError((err) => {
          this.authStore.setLoading(false);
          this.authStore.setError(err?.error?.message ?? 'Login failed.');
          return throwError(() => err);
        })
      );
  }

  register(request: RegisterRequest): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.http
      .post<RegisterResponse>(`${this.api}/auth/register`, request)
      .pipe(
        tap((res) => {
          this.authStore.setUser(res.user);
          this.authStore.setAccessToken(res.tokens.accessToken);
          this.persistSession(res.user, res.tokens.refreshToken, false);
          this.authStore.setLoading(false);
        }),
        map(() => void 0),
        catchError((err) => {
          this.authStore.setLoading(false);
          this.authStore.setError(err?.error?.message ?? 'Registration failed.');
          return throwError(() => err);
        })
      );
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Fire-and-forget — don't block the UX on server response
      this.http
        .post(`${this.api}/auth/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearSession();
    this.router.navigate(['/auth/login']);
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
      .post<AuthTokens>(`${this.api}/auth/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => {
          this.authStore.setAccessToken(tokens.accessToken);
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
      switchMap(() => this.fetchCurrentUser()),
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

  private fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.api}/auth/me`).pipe(
      tap((user) => {
        this.authStore.setUser(user);
        this.updateStoredUser(user);
      })
    );
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
