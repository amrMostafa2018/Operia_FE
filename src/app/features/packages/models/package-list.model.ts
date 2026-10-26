export type PackageOfferType = 'package' | 'singleSession';
export type PackageListStatus = 'active' | 'cancelled';
export type PackageDurationUnit = 'minute';

export interface PackageInstallmentRow {
  amount: number;
  sessionsUnlocked: number;
}

export interface PackageInstallmentDetail extends PackageInstallmentRow {
  number: number;
  cumulativeAvailableSessions: number;
}

export interface PackageCategoryOption {
  id: string;
  name: string;
  icon?: string;
}

export interface PackageFormValue {
  name: string;
  status: boolean;
  offerType: PackageOfferType;
  description: string;
  serviceCategoryId: string | null;
  subServiceCategoryId: string | null;
  sessionDurationValue: number;
  sessionDurationUnit: PackageDurationUnit;
  sessionCount: number | null;
  pulseCount: number | null;
  packageExpiryMonths: number | null;
  price: number;
  cashEnabled: boolean;
  installmentEnabled: boolean;
  installmentPrice: number | null;
  firstPayment: number | null;
  installmentCount: number | null;
  installments: PackageInstallmentRow[];
  allStaff: boolean;
  staffIds: string[];
  discountCode: string;
  discountPercent: number | null;
}

export interface PackageListItem {
  id: string;
  name: string;
  offerType: PackageOfferType;
  sessionDurationMinutes: number;
  serviceCategoryId: string;
  serviceCategoryName: string;
  price: number;
  cashPriceAfterDiscount?: number;
  status: PackageListStatus;
  createdAt: string;
  endsAt: string | null;
}

export interface PackageDetail extends PackageListItem {
  description: string;
  subServiceCategoryId: string | null;
  sessionCount: number | null;
  pulseCount: number | null;
  packageExpiryMonths: number | null;
  discountCode: string;
  discountPercent: number | null;
  cashEnabled: boolean;
  installmentEnabled: boolean;
  installmentPrice: number | null;
  cashPriceAfterDiscount: number;
  firstPayment: number | null;
  installmentCount: number | null;
  installments: PackageInstallmentDetail[];
  allStaff: boolean;
  staffIds: string[];
}
