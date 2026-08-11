export interface StatCard {
  labelKey: string;
  value: string;
  change: number;
  changeType: 'vs_yesterday' | 'vs_last_month';
  icon: string;
  iconBg: string;
}

export const MOCK_STATS: StatCard[] = [
  {
    labelKey: 'DASHBOARD.TODAY_BOOKINGS',
    value: '32',
    change: 14,
    changeType: 'vs_yesterday',
    icon: 'pi pi-calendar',
    iconBg: '#EAE9FF',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_BOOKINGS',
    value: '248',
    change: 16,
    changeType: 'vs_last_month',
    icon: 'pi pi-calendar-plus',
    iconBg: '#E8F8F0',
  },
  {
    labelKey: 'DASHBOARD.TOTAL_REVENUE',
    value: '5,680',
    change: 18,
    changeType: 'vs_yesterday',
    icon: 'pi pi-dollar',
    iconBg: '#FFF8E1',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_REVENUE',
    value: '78,450',
    change: 22,
    changeType: 'vs_last_month',
    icon: 'pi pi-chart-line',
    iconBg: '#FFE8EE',
  },
  {
    labelKey: 'DASHBOARD.NEW_CUSTOMERS',
    value: '54',
    change: 12,
    changeType: 'vs_last_month',
    icon: 'pi pi-users',
    iconBg: '#E8F4FF',
  },
];
