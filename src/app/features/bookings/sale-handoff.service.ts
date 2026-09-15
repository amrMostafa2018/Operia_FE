import { Injectable, signal } from '@angular/core';
import {
  BookingLineItem,
  PaymentMethodId,
} from './models/booking.model';

export interface SaleHandoffDraft {
  clientName: string;
  clientMobile: string;
  clientId: string | null;
  lineItems: BookingLineItem[];
  paymentMethod: PaymentMethodId;
  discount: number;
  paidAmount: number;
  serviceDuration: number;
}

export interface SellServicePayload extends SaleHandoffDraft {
  sendMessage: boolean;
}

@Injectable({ providedIn: 'root' })
export class SaleHandoffService {
  private readonly pendingDraft = signal<SaleHandoffDraft | null>(null);

  setDraft(draft: SaleHandoffDraft): void {
    this.pendingDraft.set(draft);
  }

  consumeDraft(): SaleHandoffDraft | null {
    const draft = this.pendingDraft();
    this.pendingDraft.set(null);
    return draft;
  }

  peekDraft(): SaleHandoffDraft | null {
    return this.pendingDraft();
  }
}
