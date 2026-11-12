export interface InstallmentRevenueRow {
  collectionId: string;
  purchaseId: string | null;
  saleId: string | null;
  customerName: string;
  offerName: string;
  installmentNumber: number | null;
  amount: number;
  paymentMethod: string;
  confirmedAtUtc: string;
  kind: 'Sale' | 'Installment' | 'Refund';
}

export interface InstallmentRevenuePage {
  total: number;
  confirmedTotal: number;
  items: InstallmentRevenueRow[];
}

export interface RevenueCard {
  transactionCount: number;
  grossCollected: number;
  refunds: number;
  netCollected: number;
}

export interface ActivityRevenueSummary {
  today: RevenueCard;
  month: RevenueCard;
}

export interface RevenueBranch {
  id: string;
  name: string;
}

export interface RevenueService {
  id: string;
  name: string;
}

export interface RevenueReportFilters {
  fromDate: string | null;
  toDate: string | null;
  branchId: string | null;
  serviceId: string | null;
  search?: string | null;
  status?: string | null;
  mobile?: string | null;
  customerName?: string | null;
  employeeId?: string | null;
}

export interface RevenueTransaction {
  transactionId: string;
  kind: 'SaleCollection' | 'Installment' | 'Refund';
  transactionAtUtc: string;
  customerName: string;
  mobile: string;
  service: string;
  branch: string;
  amount: number;
  paymentMethod: string;
  status: 'Paid' | 'Failed' | 'UnderReview' | 'Cancelled' | 'Refunded';
  saleId: string | null;
  purchaseId: string | null;
  paymentId: string | null;
  refundId: string | null;
  hasProof: boolean;
}

export interface RevenueReport {
  fromDate: string;
  toDate: string;
  timezoneId: string;
  total: number;
  page: number;
  pageSize: number;
  totals: { grossCollections: number; refunds: number; netCollected: number };
  today: RevenueReportCard;
  month: RevenueReportCard;
  items: RevenueTransaction[];
}

export interface RevenueReportCard {
  transactionCount: number;
  grossCollections: number;
  countChangePercent: number | null;
  amountChangePercent: number | null;
}

export interface RevenuePaymentHistory {
  atUtc: string;
  actor: string;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
}
