export const PERMISSION_CLAIM_TYPE = 'permission';

export const Policies = {
  DashboardRead: 'Dashboard.Read',
  BookingsRead: 'Bookings.Read',
  BookingsManage: 'Bookings.Manage',
  CustomersRead: 'Customers.Read',
  CustomersManage: 'Customers.Manage',
  RevenueRead: 'Revenue.Read',
  RevenueReview: 'Revenue.Review',
  ReportsRead: 'Reports.Read',
  EmployeesRead: 'Employees.Read',
  EmployeesManage: 'Employees.Manage',
  PackagesRead: 'Packages.Read',
  PackagesManage: 'Packages.Manage',
  BranchesRead: 'Branches.Read',
  BranchesManage: 'Branches.Manage',
  GalleryManage: 'Gallery.Manage',
  SettingsManage: 'Settings.Manage',
  SubscriptionsManage: 'Subscriptions.Manage',
  OnboardingManage: 'Onboarding.Manage',
  PlatformManage: 'PlatformOperations.Manage',
} as const;

export type PolicyName = (typeof Policies)[keyof typeof Policies];

export interface PolicyRule {
  policy: string;
  allowAdminWithPermission: boolean;
  allowReception: boolean;
  allowStaff: boolean;
}

export const FRONTEND_POLICY_MATRIX: PolicyRule[] = [
  {
    policy: Policies.DashboardRead,
    allowAdminWithPermission: true,
    allowReception: true,
    allowStaff: false,
  },
  {
    policy: Policies.BookingsRead,
    allowAdminWithPermission: true,
    allowReception: true,
    allowStaff: true,
  },
  {
    policy: Policies.BookingsManage,
    allowAdminWithPermission: true,
    allowReception: true,
    allowStaff: false,
  },
  {
    policy: Policies.CustomersRead,
    allowAdminWithPermission: true,
    allowReception: true,
    allowStaff: false,
  },
  {
    policy: Policies.CustomersManage,
    allowAdminWithPermission: true,
    allowReception: true,
    allowStaff: false,
  },
  {
    policy: Policies.RevenueRead,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.RevenueReview,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.ReportsRead,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.EmployeesRead,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.EmployeesManage,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.PackagesRead,
    allowAdminWithPermission: true,
    allowReception: true,
    allowStaff: false,
  },
  {
    policy: Policies.PackagesManage,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.BranchesRead,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.BranchesManage,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.GalleryManage,
    allowAdminWithPermission: true,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.SettingsManage,
    allowAdminWithPermission: false,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.SubscriptionsManage,
    allowAdminWithPermission: false,
    allowReception: false,
    allowStaff: false,
  },
  {
    policy: Policies.OnboardingManage,
    allowAdminWithPermission: false,
    allowReception: false,
    allowStaff: false,
  },
];

export const Permissions = {
  Admin: {
    DashboardRead: Policies.DashboardRead,
    BookingRead: Policies.BookingsRead,
    CustomersRead: Policies.CustomersRead,
    BranchesRead: Policies.BranchesRead,
    BranchesManage: Policies.BranchesManage,
    EmployeesRead: Policies.EmployeesRead,
    EmployeesManage: Policies.EmployeesManage,
    PackagesRead: Policies.PackagesRead,
    SettingsRead: Policies.SettingsManage,
  },
} as const;

export type Permission = (typeof Permissions.Admin)[keyof typeof Permissions.Admin];
