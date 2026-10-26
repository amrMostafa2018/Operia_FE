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
