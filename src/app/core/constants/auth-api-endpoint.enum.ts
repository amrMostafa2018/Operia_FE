export enum AuthApiEndpoint {
  Login = '/auth/login',
  Register = '/auth/register',
  VerifyOtp = '/auth/verify-otp',
  VerifyRegisterOtp = '/auth/verify-register-otp',
  ResendLoginOtp = '/auth/resend-login-otp',
  ResendRegisterOtp = '/auth/resend-register-otp',
  Refresh = '/auth/refresh',
  Logout = '/auth/logout',
}

/** Endpoints that do not require an access token. */
export const PUBLIC_AUTH_API_ENDPOINTS: readonly AuthApiEndpoint[] = [
  AuthApiEndpoint.Login,
  AuthApiEndpoint.Register,
  AuthApiEndpoint.VerifyOtp,
  AuthApiEndpoint.VerifyRegisterOtp,
  AuthApiEndpoint.ResendLoginOtp,
  AuthApiEndpoint.ResendRegisterOtp,
  AuthApiEndpoint.Refresh,
];

/** OTP flows where 401 should not redirect to the login page. */
export const OTP_AUTH_API_ENDPOINTS: readonly AuthApiEndpoint[] = [
  AuthApiEndpoint.VerifyOtp,
  AuthApiEndpoint.VerifyRegisterOtp,
  AuthApiEndpoint.ResendLoginOtp,
  AuthApiEndpoint.ResendRegisterOtp,
];

export function buildAuthApiUrl(baseUrl: string, endpoint: AuthApiEndpoint): string {
  return `${baseUrl}${endpoint}`;
}

export function urlIncludesAuthEndpoint(
  url: string,
  endpoints: readonly AuthApiEndpoint[]
): boolean {
  return endpoints.some(endpoint => url.includes(endpoint));
}
