import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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

import {
  LoginInitiateResponse,
  LoginRequest,
  RegisterInitiateRequest,
  RegisterInitiateResponse,
  ResendLoginOtpRequest,
  ResendRegisterOtpRequest,
  VerifyForgotPasswordOtpResponse,
  VerifyLoginOtpRequest,
  VerifyRegisterOtpRequest,
} from '@core/models/user.model';
import { AuthStore } from '@core/store/auth.store';
import { extractApiError } from '@core/utils/api-error.util';
import { AuthHttpService } from './auth-http.service';
import { OnboardingEntrySource, SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authHttp = inject(AuthHttpService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private loggingOut = false;

  initiateLogin(request: LoginRequest): Observable<LoginInitiateResponse> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.authHttp.initiateLogin(request.phoneNumber, request.password).pipe(
      tap(() => this.authStore.setLoading(false)),
      catchError((err: HttpErrorResponse) => {
        this.authStore.setLoading(false);
        this.authStore.setError(extractApiError(err));
        return throwError(() => err);
      })
    );
  }

  verifyLoginOtp(request: VerifyLoginOtpRequest, rememberMe = false): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.authHttp.verifyLoginOtp(request).pipe(
      tap((res) => {
        this.session.applyAuthenticatedSession(res.accessToken, res.refreshToken, rememberMe);
        this.authStore.setLoading(false);
        this.session.navigateAfterAuth('login');
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

    return this.authHttp.initiateRegistration(request).pipe(
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

    return this.authHttp.verifyRegisterOtp(request).pipe(
      tap((res) => {
        this.session.applyAuthenticatedSession(
          res.accessToken,
          res.refreshToken,
          false,
          displayName
        );
        this.authStore.setLoading(false);
        this.session.navigateAfterAuth('register');
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
    return this.authHttp.resendLoginOtp(request);
  }

  resendRegisterOtp(request: ResendRegisterOtpRequest): Observable<void> {
    return this.authHttp.resendRegisterOtp(request);
  }

  forgotPassword(phoneNumber: string): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.authHttp.forgotPassword(phoneNumber).pipe(
      tap(() => this.authStore.setLoading(false)),
      catchError((err: HttpErrorResponse) => {
        this.authStore.setLoading(false);
        this.authStore.setError(extractApiError(err));
        return throwError(() => err);
      })
    );
  }

  verifyForgotPasswordOtp(
    phoneNumber: string,
    otpCode: string
  ): Observable<VerifyForgotPasswordOtpResponse> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.authHttp.verifyForgotPasswordOtp(phoneNumber, otpCode).pipe(
      tap(() => this.authStore.setLoading(false)),
      catchError((err: HttpErrorResponse) => {
        this.authStore.setLoading(false);
        this.authStore.setError(extractApiError(err));
        return throwError(() => err);
      })
    );
  }

  resetPassword(
    phoneNumber: string,
    resetToken: string,
    newPassword: string,
    confirmPassword: string
  ): Observable<void> {
    this.authStore.setLoading(true);
    this.authStore.setError(null);

    return this.authHttp.resetPassword(phoneNumber, resetToken, newPassword, confirmPassword).pipe(
      tap(() => this.authStore.setLoading(false)),
      catchError((err: HttpErrorResponse) => {
        this.authStore.setLoading(false);
        this.authStore.setError(extractApiError(err));
        return throwError(() => err);
      })
    );
  }

  resendForgotPasswordOtp(phoneNumber: string): Observable<void> {
    return this.authHttp.resendForgotPasswordOtp(phoneNumber);
  }

  logout(): void {
    this.loggingOut = true;

    this.authHttp
      .logout()
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.session.clearSession();
          this.session.clearOnboardingEntrySource();
          this.loggingOut = false;
          this.router.navigate(['/auth/login']);
        })
      )
      .subscribe();
  }

  isLoggingOut(): boolean {
    return this.loggingOut;
  }

  refreshAccessToken(): Observable<void> {
    return this.session.refreshAccessToken();
  }

  restoreSession(): Observable<boolean> {
    return this.session.restoreSession();
  }

  getAccessToken(): string | null {
    return this.session.getAccessToken();
  }

  getRefreshToken(): string | null {
    return this.session.getRefreshToken();
  }

  isAuthenticated(): boolean {
    return this.session.hasActiveSession();
  }

  hasActiveSession(): boolean {
    return this.session.hasActiveSession();
  }

  needsOnboarding(): boolean {
    return this.session.needsOnboarding();
  }

  getPostAuthRedirectUrl(): string {
    return this.session.getPostAuthRedirectUrl();
  }

  markOnboardingComplete(activityTypeId: string): void {
    this.session.markOnboardingComplete(activityTypeId);
  }

  getOnboardingEntrySource(): OnboardingEntrySource | null {
    return this.session.getOnboardingEntrySource();
  }

  returnToRegister(): void {
    this.session.returnToRegister();
  }
}
