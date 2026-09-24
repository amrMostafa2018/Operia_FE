export interface StatCard {
  labelKey: string;
  value: number;
  isCurrency?: boolean;
  icon: string;
  iconBg: string;
}

export const MOCK_STATS: StatCard[] = [
  {
    labelKey: 'DASHBOARD.NEW_CUSTOMERS_MONTH',
    value: 54,
    icon: 'pi pi-users',
    iconBg: '#E8F4FF',
  },
  {
    labelKey: 'DASHBOARD.TODAY_BOOKINGS',
    value: 32,
    icon: 'pi pi-calendar',
    iconBg: '#EAE9FF',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_BOOKINGS_TOTAL',
    value: 248,
    icon: 'pi pi-calendar-plus',
    iconBg: '#E8F8F0',
  },
  {
    labelKey: 'DASHBOARD.TODAY_REVENUE',
    value: 5680,
    isCurrency: true,
    icon: 'pi pi-dollar',
    iconBg: '#FFF8E1',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_REVENUE_TOTAL',
    value: 78450,
    isCurrency: true,
    icon: 'pi pi-chart-line',
    iconBg: '#FFE8EE',
  },
];
