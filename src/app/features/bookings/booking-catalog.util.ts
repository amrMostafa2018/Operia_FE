import {
  PackageCategoryOption,
  PackageListItem,
} from '@app/features/packages/models/package-list.model';
import { PackageOption, ServiceCatalogItem } from './models/booking.model';

const DEFAULT_PACKAGE_ICON = 'pi pi-box';
const DEFAULT_SESSION_ICON = 'pi pi-sparkles';

export function mapPackageToCatalogItem(
  pkg: PackageListItem,
  categories: PackageCategoryOption[]
): ServiceCatalogItem {
  const category = categories.find(item => item.id === pkg.serviceCategoryId);
  const isPackage = pkg.offerType === 'package';

  return {
    id: pkg.id,
    name: pkg.name,
    category: pkg.serviceCategoryId,
    durationMinutes: pkg.sessionDurationMinutes,
    price: pkg.price,
    icon:
      normalizePrimeIcon(category?.icon) ||
      (isPackage ? DEFAULT_PACKAGE_ICON : DEFAULT_SESSION_ICON),
    type: isPackage ? 'package' : 'session',
  };
}

export function mapPackageToFilterOption(pkg: PackageListItem): PackageOption {
  return {
    id: pkg.id,
    name: pkg.name,
    durationMinutes: pkg.sessionDurationMinutes,
    serviceId: pkg.id,
  };
}

function normalizePrimeIcon(icon: string | undefined): string {
  const value = icon?.trim();
  if (!value) {
    return '';
  }
  if (value.startsWith('pi ')) {
    return value;
  }
  if (value.startsWith('pi-')) {
    return `pi ${value}`;
  }
  return `pi pi-${value}`;
}
