export type InquiryRecordStatus = 'active' | 'expired' | 'completed' | 'cancelled';
export type InquiryServiceType = 'package' | 'session';

export interface InquiryCustomerRecord {
  id: string;
  offerName: string;
  offerType: InquiryServiceType;
  purchasedAt: string;
  expiresOn: string | null;
  status: InquiryRecordStatus;
}

export interface CustomerInquiryResult {
  customerId: string;
  fullName: string;
  mobileNumber: string;
  registeredAt: string;
  membershipStatus: 'active' | 'inactive';
  operationCount: number;
  purchases: InquiryCustomerRecord[];
}

export interface InquiryBalance {
  total: number;
  used: number;
  remaining: number;
  bookable: number;
  released: number;
}

export interface InquiryCollection {
  id: string;
  installmentNumber: number;
  amount: number;
  paymentMethod: string;
  confirmedAtUtc: string;
  idempotencyKey: string;
  recordedBy: string | null;
}

export interface InquiryInstallment {
  number: number;
  amount: number;
  status: 'due' | 'paid' | 'cancelled';
}

export interface InquiryCompletedSession {
  sessionNumber: number;
  date: string;
  startMinutes: number;
  performer: string | null;
  pulsesUsed: number | null;
  notes: string | null;
  sessionType: string | null;
}

export interface InquiryPurchaseDetails {
  id: string;
  purchasedAt: string;
  startsOn: string | null;
  expiresOn: string | null;
  validityMonths: number | null;
  packageStatus: InquiryRecordStatus;
  paymentStatus: 'unknown' | 'unpaid' | 'partial' | 'fullyPaid';
  sessions: InquiryBalance | null;
  pulses: InquiryBalance | null;
  purchasePrice: number | null;
  amountPaid: number | null;
  amountRemaining: number | null;
  nextInstallmentNumber: number | null;
  installmentCount: number;
  installments: InquiryInstallment[];
  completedSessions: InquiryCompletedSession[];
  nextInstallmentEligible: boolean;
  nextInstallmentAmount: number | null;
  paymentMethods: string[];
  collections: InquiryCollection[];
}
