export const PERMISSION_CLAIM_TYPE = 'permission';

export const Permissions = {
  Admin: {
    DashboardRead: 'Admins:Dashboard:read',
    BookingRead: 'Admins:Booking:read',
    CustomersRead: 'Admins:Customers:read',
    BranchesRead: 'Admins:Branches:read',
    BranchesManage: 'Admins:Branches:manage',
    EmployeesRead: 'Admins:Employees:read',
    EmployeesManage: 'Admins:Employees:manage',
    PackagesRead: 'Admins:Packages:read',
    SettingsRead: 'Admins:Settings:read'
  },
} as const;

export type Permission = typeof Permissions.Admin[keyof typeof Permissions.Admin];
