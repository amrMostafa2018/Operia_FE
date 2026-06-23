export type UserRole = 'super_admin' | 'admin' | 'reception' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
  branchId?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
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

export interface ApiAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}
