import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';
import {
  applyServerFieldErrors,
  extractApiFieldErrors,
  translateApiFieldErrors,
} from '@core/utils/api-error.util';
import { PackagePayload } from '@app/features/packages/package.service';
import { PackageDetail, PackageOfferType } from '@app/features/packages/models/package-list.model';
import { BookingLineItem } from './models/booking.model';

export const DEFAULT_UNLISTED_CATEGORY_ICON = 'pi-tag';

const UNLISTED_API_FIELD_ALIASES: Record<string, string> = {
  sessionDurationMinutes: 'durationMinutes',
};

const UNLISTED_CATEGORY_CREATE_FIELD_ALIASES: Record<string, string> = {
  name: 'serviceCategoryId',
};

/** Converts the unlisted-service form into the catalog API payload and its default offer values. */
export function toUnlistedPackagePayload(value: {
  name: string;
  offerType: PackageOfferType;
  serviceCategoryId: string | null;
  durationMinutes: number;
  price: number;
}): PackagePayload {
  const isPackage = value.offerType === 'package';

  return {
    name: value.name.trim(),
    isActive: true,
    offerType: value.offerType,
    description: '',
    serviceCategoryId: value.serviceCategoryId,
    subServiceCategoryId: null,
    sessionDurationMinutes: Number(value.durationMinutes) || 0,
    sessionCount: isPackage ? 1 : 0,
    pulseCount: isPackage ? 0 : null,
    packageExpiryMonths: isPackage ? 12 : null,
    price: Number(value.price) || 0,
    discountCode: '',
    discountPercent: null,
  };
}

/** Adds a newly created catalog offer to the booking as an unlisted line item. */
export function toLineItemFromCreatedPackage(pkg: PackageDetail): BookingLineItem {
  const isPackage = pkg.offerType === 'package';

  return {
    id: `line-${pkg.id}-${Date.now()}`,
    name: pkg.name,
    type: 'unlisted',
    quantity: 1,
    price: pkg.price,
    durationMinutes: pkg.sessionDurationMinutes,
    packageSessionLinked: isPackage,
    categoryId: pkg.serviceCategoryId || null,
    categoryName: pkg.serviceCategoryName || null,
    catalogPackageId: pkg.id,
    customerPackageId: null,
  };
}

/** Maps catalog API field errors back to the unlisted-service form. */
export function applyUnlistedPackageApiErrors(
  form: FormGroup,
  error: HttpErrorResponse,
  translate: (key: string) => string
): boolean {
  const remapped: Record<string, string> = {};

  for (const [field, value] of Object.entries(extractApiFieldErrors(error))) {
    const target = UNLISTED_API_FIELD_ALIASES[field] ?? field;
    if (!remapped[target]) {
      remapped[target] = value;
    }
  }

  const translated = translateApiFieldErrors(remapped, translate);
  applyServerFieldErrors(form, translated);
  return Object.keys(translated).length > 0;
}

/** Shows a category creation error on the category control. */
export function applyUnlistedCategoryCreateErrors(
  categoryControl: AbstractControl,
  error: HttpErrorResponse,
  translate: (key: string) => string
): boolean {
  const remapped: Record<string, string> = {};

  for (const [field, value] of Object.entries(extractApiFieldErrors(error))) {
    const target = UNLISTED_CATEGORY_CREATE_FIELD_ALIASES[field] ?? field;
    if (!remapped[target]) {
      remapped[target] = value;
    }
  }

  const translated = translateApiFieldErrors(remapped, translate);
  const message = translated['serviceCategoryId'];
  if (!message) {
    return false;
  }

  categoryControl.setErrors({ ...categoryControl.errors, server: message });
  categoryControl.markAsTouched();
  return true;
}
