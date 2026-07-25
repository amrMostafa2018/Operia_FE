export type UserRole =
  'super_admin' | 'admin' | 'reception' | 'staff' | 'platform_admin' | 'unknown';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
  branchId?: string;
  tenantId?: string;
  businessId?: string;
  businessName?: string;
  avatarUrl?: string;
  activityTypeId?: string;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  phoneNumber: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginInitiateResponse {
  requiresOtp: boolean;
  userId: string;
}

export interface VerifyLoginOtpRequest {
  userId: string;
  code: string;
}

export interface RegisterInitiateRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
}

export interface RegisterInitiateResponse {
  requiresOtp: boolean;
  registrationId: string;
}

export interface VerifyRegisterOtpRequest {
  registrationId: string;
  code: string;
}

export interface ResendRegisterOtpRequest {
  registrationId: string;
}

export interface ResendLoginOtpRequest {
  userId: string;
}

export interface ForgotPasswordRequest {
  phoneNumber: string;
}

export interface VerifyForgotPasswordOtpRequest {
  phoneNumber: string;
  otpCode: string;
}

export interface VerifyForgotPasswordOtpResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  phoneNumber: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ApiAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface VerifyLoginOtpResponse {
  requiresPasswordChange: boolean;
  resetToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}
