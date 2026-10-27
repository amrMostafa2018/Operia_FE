export interface InstallmentRevenueRow {
  collectionId: string;
  purchaseId: string;
  customerName: string;
  offerName: string;
  installmentNumber: number;
  amount: number;
  paymentMethod: string;
  confirmedAtUtc: string;
}

export interface InstallmentRevenuePage {
  total: number;
  items: InstallmentRevenueRow[];
}
