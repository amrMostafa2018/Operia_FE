import { User, UserRole } from '@core/models/user.model';
import { PERMISSION_CLAIM_TYPE } from '@core/models/permissions.model';

const ROLE_MAP: Record<string, UserRole> = {
  Admin: 'admin',
  SuperAdmin: 'super_admin',
  Reception: 'reception',
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

function decodeJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split('.')[1];
  if (!segment) {
    throw new Error('Invalid JWT');
  }

  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function claimValues(payload: Record<string, unknown>, type: string): string[] {
  const raw = payload[type];
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === 'string' && value.length > 0);
  }
  if (typeof raw === 'string' && raw) {
    return [raw];
  }
  return [];
}

function roleFromPayload(payload: Record<string, unknown>): UserRole {
  const raw =
    payload['role'] ??
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

  const roleName = Array.isArray(raw) ? raw[0] : raw;
  if (typeof roleName === 'string' && roleName in ROLE_MAP) {
    return ROLE_MAP[roleName];
  }

  return 'staff';
}

export function userFromAccessToken(token: string, name?: string): User {
  const payload = decodeJwtPayload(token);

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
  const fullName = claim(
    payload,
    'name',
    'full_name',
    'fullName',
    'unique_name',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
  );
  const activityTypeId = claim(payload, 'activity_type', 'activityTypeId');
  const tenantId = claim(payload, 'tenant_id', 'tenantId');
  const businessId = claim(payload, 'busineess_id', 'busineessId');

  return {
    id,
    name: (name ?? fullName)?.trim() || email,
    email,
    role: roleFromPayload(payload),
    permissions: claimValues(payload, PERMISSION_CLAIM_TYPE),
    ...(activityTypeId ? { activityTypeId } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(businessId ? { businessId } : {}),
    isActive: true,
  };
}
