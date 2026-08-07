import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, switchMap, take, tap, throwError } from 'rxjs';

import { User } from '@core/models/user.model';
import { AuthStore } from '@core/store/auth.store';
import { userFromAccessToken } from '@core/utils/jwt.util';
import { AuthHttpService } from './auth-http.service';
import { OnboardingService } from './onboarding.service';
import { OnboardingStateService } from './onboarding-state.service';
import { onboardingRouteForStep } from '@app/features/onboarding/models/onboarding.model';

const RT_KEY = 'operia_rt';
const USER_KEY = 'operia_user';
const ONBOARDING_SOURCE_KEY = 'operia_onboarding_source';
export const ONBOARDING_SETUP_URL = '/onboarding/setup';
export const DASHBOARD_URL = '/dashboard';

export type OnboardingEntrySource = 'login' | 'register';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly authStore = inject(AuthStore);
  private readonly authHttp = inject(AuthHttpService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly onboardingState = inject(OnboardingStateService);
  private readonly router = inject(Router);

  restoreSession(): Observable<boolean> {
    const refreshToken = this.getRefreshToken();
    const storedUser = this.getStoredUser();

    if (!refreshToken || !storedUser) {
      return of(false);
    }

    this.authStore.setUser(storedUser);

    return this.authHttp.refreshAccessToken(refreshToken).pipe(
      switchMap(tokens => {
        this.authStore.setAccessToken(tokens.accessToken);
        this.syncUserFromAccessToken();
        this.updateStoredRefreshToken(tokens.refreshToken);
        return this.loadCapabilities();
      }),
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  persistSession(user: User, refreshToken: string, rememberMe?: boolean): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(RT_KEY, refreshToken);
    storage.setItem(USER_KEY, JSON.stringify(user));
  }

  applyAuthenticatedSession(
    accessToken: string,
    refreshToken: string,
    rememberMe: boolean,
    displayName?: string
  ): Observable<User> {
    const user = userFromAccessToken(accessToken, displayName);
    this.authStore.setUser(user);
    this.authStore.setAccessToken(accessToken);
    this.persistSession(user, refreshToken, rememberMe);
    return this.loadCapabilities().pipe(map(() => this.authStore.currentUser() ?? user));
  }

  refreshAccessToken(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    return this.authHttp.refreshAccessToken(refreshToken).pipe(
      switchMap(tokens => {
        this.authStore.setAccessToken(tokens.accessToken);
        this.syncUserFromAccessToken();
        this.updateStoredRefreshToken(tokens.refreshToken);
        return this.loadCapabilities();
      }),
      map(() => void 0),
      catchError(err => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  getAccessToken(): string | null {
    return this.authStore.accessToken();
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(RT_KEY) ?? sessionStorage.getItem(RT_KEY) ?? null;
  }

  hasActiveSession(): boolean {
    if (this.authStore.isAuthenticated()) {
      return true;
    }

    return !!(this.getRefreshToken() && this.getStoredUser());
  }

  navigateAfterAuth(entrySource: OnboardingEntrySource): void {
    if (entrySource === 'register' || entrySource === 'login') {
      sessionStorage.setItem(ONBOARDING_SOURCE_KEY, entrySource);
    }

    this.onboardingService
      .getStatus()
      .pipe(
        map(status => onboardingRouteForStep(status.step)),
        catchError(() => of(ONBOARDING_SETUP_URL)),
        take(1)
      )
      .subscribe(url => {
        if (url === DASHBOARD_URL) {
          this.clearOnboardingEntrySource();
        }
        void this.router.navigateByUrl(url, { replaceUrl: true });
      });
  }

  getOnboardingEntrySource(): OnboardingEntrySource | null {
    const value = sessionStorage.getItem(ONBOARDING_SOURCE_KEY);
    return value === 'login' || value === 'register' ? value : null;
  }

  returnToRegister(): void {
    this.clearOnboardingEntrySource();
    this.clearSession();
    void this.router.navigate(['/auth/register']);
  }

  clearSession(): void {
    localStorage.removeItem(RT_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(RT_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.onboardingService.invalidateStatus();
    this.onboardingState.clear();
    this.authStore.clearAuth();
  }

  clearOnboardingEntrySource(): void {
    sessionStorage.removeItem(ONBOARDING_SOURCE_KEY);
  }

  private syncUserFromAccessToken(displayName?: string): void {
    const token = this.authStore.accessToken();
    if (!token) {
      return;
    }

    const storedUser = this.getStoredUser();
    const user = userFromAccessToken(token, displayName);
    const merged = {
      ...user,
      name: this.resolveDisplayName(user, storedUser, displayName),
      tenantId: user.tenantId ?? storedUser?.tenantId,
      businessName: user.businessName ?? storedUser?.businessName,
    };
    this.authStore.setUser(merged);
    this.updateStoredUser(merged);
  }

  private updateStoredRefreshToken(refreshToken: string): void {
    if (localStorage.getItem(RT_KEY)) {
      localStorage.setItem(RT_KEY, refreshToken);
    } else {
      sessionStorage.setItem(RT_KEY, refreshToken);
    }
  }

  private loadCapabilities(): Observable<void> {
    return this.authHttp.getCapabilities().pipe(
      tap(capabilities => {
        this.authStore.setCapabilities(capabilities);
        const user = this.authStore.currentUser();
        if (user) {
          this.updateStoredUser(user);
        }
      }),
      map(() => void 0)
    );
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
    const json = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as User;
    } catch {
      return null;
    }
  }

  private resolveDisplayName(user: User, storedUser: User | null, displayName?: string): string {
    const candidates = [displayName, user.name, storedUser?.name].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (candidate !== user.email) {
        return candidate;
      }
    }

    return candidates[0] ?? '';
  }
}
