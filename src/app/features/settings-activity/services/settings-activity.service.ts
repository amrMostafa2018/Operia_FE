import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface IdentitySettingsDto {
  activityName: string;
  contactPhone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  mainAddress: string | null;
  about: string | null;
  primaryPhotoUrl: string | null;
  additionalPhotoUrls: string[];
}

export interface PaymentMethodsDto {
  cashEnabled: boolean;
  bankTransferEnabled: boolean;
  bank?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  iban?: string | null;
  instapayEnabled: boolean;
  instapayId?: string | null;
  instapayAccountHolder?: string | null;
  eWalletEnabled: boolean;
  walletType?: string | null;
  walletHolderName?: string | null;
  walletNumber?: string | null;
  fawryEnabled: boolean;
  fawryServiceCode?: string | null;
  fawryNotes?: string | null;
}

export interface WorkingDayDto {
  day: string;
  enabled: boolean;
  fromTime: string;
  toTime: string;
}

export interface WorkingDaysSettingsDto {
  days: WorkingDayDto[];
  allowBookingOutsideWorkingHours: boolean;
}

export interface AuthorizedUserDto {
  id: string;
  name: string;
  email: string;
  isBanned: boolean;
}

export interface SecuritySettingsDto {
  enableTwoFactorAuthentication: boolean;
  loginAlertsEnabled: boolean;
  maskedPhone: string;
  users: AuthorizedUserDto[];
}

export interface UpdateSecurityRequest {
  enableTwoFactorAuthentication: boolean;
  loginAlertsEnabled: boolean;
  logoutOtherDevices: boolean;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword?: string;
  otpCode?: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsActivityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/settings`;

  getIdentity(): Observable<IdentitySettingsDto> {
    return this.http.get<IdentitySettingsDto>(`${this.baseUrl}/identity`);
  }

  updateIdentity(formData: FormData): Observable<IdentitySettingsDto> {
    return this.http.put<IdentitySettingsDto>(`${this.baseUrl}/identity`, formData);
  }

  getPaymentMethods(): Observable<PaymentMethodsDto> {
    return this.http.get<PaymentMethodsDto>(`${this.baseUrl}/payment-methods`);
  }

  updatePaymentMethods(payload: PaymentMethodsDto): Observable<PaymentMethodsDto> {
    return this.http.put<PaymentMethodsDto>(`${this.baseUrl}/payment-methods`, payload);
  }

  getWorkingDays(): Observable<WorkingDaysSettingsDto> {
    return this.http.get<WorkingDaysSettingsDto>(`${this.baseUrl}/working-days`);
  }

  updateWorkingDays(payload: WorkingDaysSettingsDto): Observable<WorkingDaysSettingsDto> {
    return this.http.put<WorkingDaysSettingsDto>(`${this.baseUrl}/working-days`, payload);
  }

  getSecurity(): Observable<SecuritySettingsDto> {
    return this.http.get<SecuritySettingsDto>(`${this.baseUrl}/security`);
  }

  updateSecurity(payload: UpdateSecurityRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/security`, payload);
  }

  sendPasswordOtp(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/security/password-otp`, {});
  }

  changePassword(payload: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/security/change-password`, payload);
  }

  banUser(userId: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/security/users/${encodeURIComponent(userId)}/ban`,
      {}
    );
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/security/users/${encodeURIComponent(userId)}`);
  }

  deactivateAccount(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/security/deactivate-account`, {});
  }
}
