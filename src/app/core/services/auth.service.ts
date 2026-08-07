import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

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
  VerifyLoginOtpResponse,
} from '@core/models/user.model';
import { AuthStore } from '@core/store/auth.store';
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
    return this.withAuthState(this.authHttp.initiateLogin(request.phoneNumber, request.password));
  }

  verifyLoginOtp(
    request: VerifyLoginOtpRequest,
    rememberMe = false
  ): Observable<VerifyLoginOtpResponse> {
    return this.withAuthState(
      this.authHttp.verifyLoginOtp(request).pipe(
        switchMap(res => {
          if (!res.requiresPasswordChange && res.accessToken && res.refreshToken) {
            return this.session
              .applyAuthenticatedSession(res.accessToken, res.refreshToken, rememberMe)
              .pipe(
                tap(() => this.session.navigateAfterAuth('login')),
                map(() => res)
              );
          }
          return of(res);
        })
      )
    );
  }

  completeFirstLogin(
    userId: string,
    resetToken: string,
    newPassword: string,
    rememberMe = false
  ): Observable<void> {
    return this.withAuthState(
      this.authHttp.completeFirstLogin(userId, resetToken, newPassword).pipe(
        switchMap(res =>
          this.session
            .applyAuthenticatedSession(res.accessToken, res.refreshToken, rememberMe)
            .pipe(
              tap(() => this.session.navigateAfterAuth('login')),
              map(() => void 0)
            )
        ),
        map(() => void 0)
      )
    );
  }

  initiateRegistration(request: RegisterInitiateRequest): Observable<RegisterInitiateResponse> {
    return this.withAuthState(this.authHttp.initiateRegistration(request));
  }

  verifyRegisterOtp(request: VerifyRegisterOtpRequest, displayName?: string): Observable<void> {
    return this.withAuthState(
      this.authHttp.verifyRegisterOtp(request).pipe(
        switchMap(res =>
          this.session
            .applyAuthenticatedSession(res.accessToken, res.refreshToken, false, displayName)
            .pipe(
              tap(() => this.session.navigateAfterAuth('register')),
              map(() => void 0)
            )
        ),
        map(() => void 0)
      )
    );
  }

  resendLoginOtp(request: ResendLoginOtpRequest): Observable<void> {
    return this.authHttp.resendLoginOtp(request);
  }

  resendRegisterOtp(request: ResendRegisterOtpRequest): Observable<void> {
    return this.authHttp.resendRegisterOtp(request);
  }

  forgotPassword(phoneNumber: string): Observable<void> {
    return this.withAuthState(this.authHttp.forgotPassword(phoneNumber));
  }

  verifyForgotPasswordOtp(
    phoneNumber: string,
    otpCode: string
  ): Observable<VerifyForgotPasswordOtpResponse> {
    return this.withAuthState(this.authHttp.verifyForgotPasswordOtp(phoneNumber, otpCode));
  }

  resetPassword(
    phoneNumber: string,
    resetToken: string,
    newPassword: string,
    confirmPassword: string
  ): Observable<void> {
    return this.withAuthState(
      this.authHttp.resetPassword(phoneNumber, resetToken, newPassword, confirmPassword)
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

  hasActiveSession(): boolean {
    return this.session.hasActiveSession();
  }

  getOnboardingEntrySource(): OnboardingEntrySource | null {
    return this.session.getOnboardingEntrySource();
  }

  returnToRegister(): void {
    this.session.returnToRegister();
  }

  private withAuthState<T>(source$: Observable<T>): Observable<T> {
    this.authStore.setLoading(true);
    return source$.pipe(
      finalize(() => this.authStore.setLoading(false)),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }
}
