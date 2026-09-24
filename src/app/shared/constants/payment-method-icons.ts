/** PrimeIcons for payment methods — shared by bookings and settings activity. */
export const PAYMENT_METHOD_ICONS = {
  cash: 'pi pi-money-bill',
  bankTransfer: 'pi pi-building-columns',
  instapay: 'pi pi-credit-card',
  vodafoneCash: 'pi pi-mobile',
  wallet: 'pi pi-wallet',
  fawry: 'pi pi-qrcode',
} as const;

export const PAYMENT_METHOD_ICON_CLASSES = {
  cash: 'method-icon--cash',
  bankTransfer: 'method-icon--bank',
  instapay: 'method-icon--instapay',
  vodafoneCash: 'method-icon--mobile',
  wallet: 'method-icon--wallet',
  fawry: 'method-icon--fawry',
} as const;
