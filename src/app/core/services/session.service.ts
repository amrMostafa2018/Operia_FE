import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';

import { User } from '@core/models/user.model';
import { AuthStore } from '@core/store/auth.store';
import { userFromAccessToken } from '@core/utils/jwt.util';
import { AuthHttpService } from './auth-http.service';

const RT_KEY = 'operia_rt';
const USER_KEY = 'operia_user';
const ONBOARDING_KEY_PREFIX = 'operia_onboarding_';
const ONBOARDING_SOURCE_KEY = 'operia_onboarding_source';
export const ONBOARDING_SETUP_URL = '/onboarding/setup';
export const DASHBOARD_URL = '/dashboard';

export type OnboardingEntrySource = 'login' | 'register';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly authStore = inject(AuthStore);
  private readonly authHttp = inject(AuthHttpService);
  private readonly router = inject(Router);

  restoreSession(): Observable<boolean> {
    const refreshToken = this.getRefreshToken();
    const storedUser = this.getStoredUser();

    if (!refreshToken || !storedUser) {
      return of(false);
    }

    this.authStore.setUser(this.mergeStoredActivityType(storedUser));

    return this.authHttp.refreshAccessToken(refreshToken).pipe(
      tap((tokens) => {
        this.authStore.setAccessToken(tokens.accessToken);
        this.syncUserFromAccessToken();
        this.updateStoredRefreshToken(tokens.refreshToken);
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
  ): User {
    const user = this.mergeStoredActivityType(userFromAccessToken(accessToken, displayName));
    this.authStore.setUser(user);
    this.authStore.setAccessToken(accessToken);
    this.persistSession(user, refreshToken, rememberMe);
    return user;
  }

  refreshAccessToken(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    return this.authHttp.refreshAccessToken(refreshToken).pipe(
      tap((tokens) => {
        this.authStore.setAccessToken(tokens.accessToken);
        this.syncUserFromAccessToken();
        this.updateStoredRefreshToken(tokens.refreshToken);
      }),
      map(() => void 0),
      catchError((err) => {
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

  needsOnboarding(): boolean {
    const user = this.authStore.user() ?? this.getStoredUser();
    if (!user) {
      return true;
    }

    return !this.resolveActivityTypeId(user);
  }

  getPostAuthRedirectUrl(): string {
    return this.needsOnboarding() ? ONBOARDING_SETUP_URL : DASHBOARD_URL;
  }

  navigateAfterAuth(entrySource: OnboardingEntrySource): void {
    const url = this.getPostAuthRedirectUrl();
    if (url === ONBOARDING_SETUP_URL) {
      sessionStorage.setItem(ONBOARDING_SOURCE_KEY, entrySource);
    } else {
      this.clearOnboardingEntrySource();
    }

    void this.router.navigateByUrl(url, { replaceUrl: true });
  }

  markOnboardingComplete(activityTypeId: string): void {
    const current = this.authStore.user() ?? this.getStoredUser();
    if (!current) {
      return;
    }

    const updated: User = { ...current, activityTypeId };
    this.authStore.setUser(updated);
    this.updateStoredUser(updated);
    this.storeActivityTypeId(updated.id, activityTypeId);
    this.clearOnboardingEntrySource();
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
    this.authStore.clearAuth();
  }

  clearOnboardingEntrySource(): void {
    sessionStorage.removeItem(ONBOARDING_SOURCE_KEY);
  }

  private resolveActivityTypeId(user: User): string | undefined {
    return user.activityTypeId ?? this.getStoredActivityTypeId(user.id);
  }

  private mergeStoredActivityType(user: User): User {
    const activityTypeId = this.resolveActivityTypeId(user);
    return activityTypeId ? { ...user, activityTypeId } : user;
  }

  private getOnboardingKey(userId: string): string {
    return `${ONBOARDING_KEY_PREFIX}${userId}`;
  }

  private getStoredActivityTypeId(userId: string): string | undefined {
    return localStorage.getItem(this.getOnboardingKey(userId)) ?? undefined;
  }

  private storeActivityTypeId(userId: string, activityTypeId: string): void {
    localStorage.setItem(this.getOnboardingKey(userId), activityTypeId);
  }

  private syncUserFromAccessToken(displayName?: string): void {
    const token = this.authStore.accessToken();
    if (!token) {
      return;
    }

    const storedUser = this.getStoredUser();
    const user = userFromAccessToken(token, displayName ?? storedUser?.name);
    const merged = this.mergeStoredActivityType({
      ...user,
      activityTypeId: user.activityTypeId ?? storedUser?.activityTypeId,
    });
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
}
