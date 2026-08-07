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
  SettingsManage: 'Settings.Manage',
  SubscriptionsRead: 'Subscriptions.Read',
  SubscriptionsManage: 'Subscriptions.Manage',
  OnboardingManage: 'Onboarding.Manage',
  PlatformManage: 'PlatformOperations.Manage',
} as const;

export type PolicyName = (typeof Policies)[keyof typeof Policies];
