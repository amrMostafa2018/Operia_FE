export const PERMISSION_CLAIM_TYPE = 'permission';

export const Permissions = {
  Admin: {
    DashboardRead: 'Admins:Dashboard:read',
    BookingRead: 'Admins:Booking:read',
    CustomersRead: 'Admins:Customers:read',
    ReportsRead: 'Admins:Reports:read',
    BranchesRead: 'Admins:Branches:read',
    EmployeesRead: 'Admins:Employees:read',
    PackagesRead: 'Admins:Packages:read',
    SettingsRead: 'Admins:Settings:read'
  },
  Staff: {
    Read: 'Staff:read',
    Write: 'Staff:write',
  },
} as const;

export type Permission =
  | typeof Permissions.Admin[keyof typeof Permissions.Admin]
  | typeof Permissions.Staff[keyof typeof Permissions.Staff];
