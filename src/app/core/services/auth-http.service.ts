import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import {
  ApiAuthResponse,
  AuthTokens,
  LoginInitiateResponse,
  RegisterInitiateRequest,
  RegisterInitiateResponse,
  ResendLoginOtpRequest,
  ResendRegisterOtpRequest,
  VerifyForgotPasswordOtpResponse,
  VerifyLoginOtpRequest,
  VerifyRegisterOtpRequest,
} from '@core/models/user.model';
import {
  AuthApiEndpoint,
  buildAuthApiUrl,
} from '@core/constants/auth-api-endpoint.enum';

@Injectable({ providedIn: 'root' })
export class AuthHttpService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  initiateLogin(phoneNumber: string, password: string): Observable<LoginInitiateResponse> {
    return this.http.post<LoginInitiateResponse>(buildAuthApiUrl(this.api, AuthApiEndpoint.Login), {
      phoneNumber,
      password,
    });
  }

  verifyLoginOtp(request: VerifyLoginOtpRequest): Observable<ApiAuthResponse> {
    return this.http.post<ApiAuthResponse>(
      buildAuthApiUrl(this.api, AuthApiEndpoint.VerifyOtp),
      request
    );
  }

  initiateRegistration(request: RegisterInitiateRequest): Observable<RegisterInitiateResponse> {
    return this.http.post<RegisterInitiateResponse>(
      buildAuthApiUrl(this.api, AuthApiEndpoint.Register),
      request
    );
  }

  verifyRegisterOtp(request: VerifyRegisterOtpRequest): Observable<ApiAuthResponse> {
    return this.http.post<ApiAuthResponse>(
      buildAuthApiUrl(this.api, AuthApiEndpoint.VerifyRegisterOtp),
      request
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

  forgotPassword(phoneNumber: string): Observable<void> {
    return this.http.post<void>(buildAuthApiUrl(this.api, AuthApiEndpoint.ForgotPassword), {
      phoneNumber,
    });
  }

  verifyForgotPasswordOtp(
    phoneNumber: string,
    otpCode: string
  ): Observable<VerifyForgotPasswordOtpResponse> {
    return this.http.post<VerifyForgotPasswordOtpResponse>(
      buildAuthApiUrl(this.api, AuthApiEndpoint.VerifyForgotPasswordOtp),
      { phoneNumber, otpCode }
    );
  }

  resetPassword(
    phoneNumber: string,
    resetToken: string,
    newPassword: string,
    confirmPassword: string
  ): Observable<void> {
    return this.http.post<void>(buildAuthApiUrl(this.api, AuthApiEndpoint.ResetPassword), {
      phoneNumber,
      resetToken,
      newPassword,
      confirmPassword,
    });
  }

  resendForgotPasswordOtp(phoneNumber: string): Observable<void> {
    return this.http.post<void>(
      buildAuthApiUrl(this.api, AuthApiEndpoint.ResendForgotPasswordOtp),
      { phoneNumber }
    );
  }

  refreshAccessToken(refreshToken: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(buildAuthApiUrl(this.api, AuthApiEndpoint.Refresh), {
      refreshToken,
    });
  }

  logout(): Observable<unknown> {
    return this.http.post(buildAuthApiUrl(this.api, AuthApiEndpoint.Logout), {});
  }
}
