export interface Fine {
  id: string;
  issuer: string;
  offence: string;
  location?: string;
  issuedAt: string;
  dueAt?: string;
  discountUntil?: string;
  cents: number;
  discountedCents?: number;
  payable: boolean;
  reasonNotPayable?: string;
}

export type PaymentCallback = {
  paymentId: string;
  status: "paid" | "failed" | "cancelled" | "pending_issuer";
};

export interface FinesAdapter {
  lookup(
    userId: string,
  ): Promise<
    { checkedAt: string; coverage: string[]; fines: Fine[] } | "unavailable"
  >;
  startCheckout(
    userId: string,
    noticeIds: string[],
  ): Promise<{ url: string; paymentId: string }>;
  verifyCallback(request: Request): Promise<PaymentCallback | null>;
}
