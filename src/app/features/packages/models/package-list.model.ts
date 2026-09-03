export type PackageOfferType = 'package' | 'singleSession';
export type PackageListStatus = 'active' | 'cancelled';
export type PackageDurationUnit = 'minute';

export interface PackageCategoryOption {
  id: string;
  name: string;
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
  sessionCount: number;
  pulseCount: number | null;
  packageExpiryMonths: number | null;
  price: number;
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
  status: PackageListStatus;
  createdAt: string;
  endsAt: string | null;
}

export interface PackageDetail extends PackageListItem {
  description: string;
  subServiceCategoryId: string | null;
  sessionCount: number;
  pulseCount: number | null;
  packageExpiryMonths: number | null;
  discountCode: string;
  discountPercent: number | null;
}
