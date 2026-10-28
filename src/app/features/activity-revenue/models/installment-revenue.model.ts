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
