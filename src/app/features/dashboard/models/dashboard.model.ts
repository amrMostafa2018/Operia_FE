export interface StatCard {
  labelKey: string;
  value: string;
  change: number;
  changeType: 'vs_yesterday' | 'vs_last_month';
  icon: string;
  iconBg: string;
  sparkline: string;
}

export const MOCK_STATS: StatCard[] = [
  {
    labelKey: 'DASHBOARD.TODAY_BOOKINGS',
    value: '32',
    change: 14,
    changeType: 'vs_yesterday',
    icon: 'pi pi-calendar',
    iconBg: '#EAE9FF',
    sparkline: '0,22 12,18 24,20 36,14 48,16 60,10 72,12 80,8',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_BOOKINGS',
    value: '248',
    change: 16,
    changeType: 'vs_last_month',
    icon: 'pi pi-calendar-plus',
    iconBg: '#E8F8F0',
    sparkline: '0,26 12,22 24,24 36,16 48,18 60,10 72,12 80,6',
  },
  {
    labelKey: 'DASHBOARD.TOTAL_REVENUE',
    value: '5,680',
    change: 18,
    changeType: 'vs_yesterday',
    icon: 'pi pi-dollar',
    iconBg: '#FFF8E1',
    sparkline: '0,20 14,18 28,22 42,12 56,14 70,8 80,10',
  },
  {
    labelKey: 'DASHBOARD.MONTHLY_REVENUE',
    value: '78,450',
    change: 22,
    changeType: 'vs_last_month',
    icon: 'pi pi-chart-line',
    iconBg: '#FFE8EE',
    sparkline: '0,24 10,22 22,18 34,20 48,12 62,8 80,5',
  },
  {
    labelKey: 'DASHBOARD.NEW_CUSTOMERS',
    value: '54',
    change: 12,
    changeType: 'vs_last_month',
    icon: 'pi pi-users',
    iconBg: '#E8F4FF',
    sparkline: '0,20 16,14 32,18 48,10 64,12 80,7',
  },
];
