import { User, UserRole } from '../models/user.model';

const ROLE_MAP: Record<string, UserRole> = {
  Admin: 'admin',
  Staff: 'staff',
};

function claim(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return '';
}

function roleFromPayload(payload: Record<string, unknown>): UserRole {
  const raw =
    payload['role'] ??
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

  const roleName = Array.isArray(raw) ? raw[0] : raw;
  if (typeof roleName === 'string' && roleName in ROLE_MAP) {
    return ROLE_MAP[roleName];
  }

  return 'admin';
}

export function userFromAccessToken(token: string, name?: string): User {
  const payload = JSON.parse(atob(token.split('.')[1])) as Record<string, unknown>;

  const id = claim(
    payload,
    'sub',
    'nameid',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
  );
  const email = claim(
    payload,
    'email',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
  );

  return {
    id,
    name: name ?? email,
    email,
    role: roleFromPayload(payload),
    isActive: true,
  };
}
