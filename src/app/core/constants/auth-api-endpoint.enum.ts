export enum AuthApiEndpoint {
  Login = '/auth/login',
  Register = '/auth/register',
  VerifyOtp = '/auth/verify-otp',
  CompleteFirstLogin = '/auth/complete-first-login',
  VerifyRegisterOtp = '/auth/verify-register-otp',
  ResendLoginOtp = '/auth/resend-login-otp',
  ResendRegisterOtp = '/auth/resend-register-otp',
  Refresh = '/auth/refresh',
  Capabilities = '/auth/capabilities',
  Logout = '/auth/logout',
  ForgotPassword = '/auth/forgot-password',
  VerifyForgotPasswordOtp = '/auth/verify-forgot-password-otp',
  ResetPassword = '/auth/reset-password',
  ResendForgotPasswordOtp = '/auth/resend-forgot-password-otp',
}

/** Endpoints that do not require an access token. */
export const PUBLIC_AUTH_API_ENDPOINTS: readonly AuthApiEndpoint[] = [
  AuthApiEndpoint.Login,
  AuthApiEndpoint.Register,
  AuthApiEndpoint.VerifyOtp,
  AuthApiEndpoint.CompleteFirstLogin,
  AuthApiEndpoint.VerifyRegisterOtp,
  AuthApiEndpoint.ResendLoginOtp,
  AuthApiEndpoint.ResendRegisterOtp,
  AuthApiEndpoint.Refresh,
  AuthApiEndpoint.ForgotPassword,
  AuthApiEndpoint.VerifyForgotPasswordOtp,
  AuthApiEndpoint.ResetPassword,
  AuthApiEndpoint.ResendForgotPasswordOtp,
];

/** OTP flows where 401 should not redirect to the login page. */
export const OTP_AUTH_API_ENDPOINTS: readonly AuthApiEndpoint[] = [
  AuthApiEndpoint.VerifyOtp,
  AuthApiEndpoint.VerifyRegisterOtp,
  AuthApiEndpoint.ResendLoginOtp,
  AuthApiEndpoint.ResendRegisterOtp,
  AuthApiEndpoint.VerifyForgotPasswordOtp,
  AuthApiEndpoint.ResendForgotPasswordOtp,
];

/** Auth form endpoints where 401 should stay on the page for inline errors. */
export const AUTH_FORM_API_ENDPOINTS: readonly AuthApiEndpoint[] = [
  AuthApiEndpoint.Login,
  AuthApiEndpoint.Register,
  AuthApiEndpoint.ForgotPassword,
  AuthApiEndpoint.ResetPassword,
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
