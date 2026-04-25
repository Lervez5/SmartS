export interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  userId: string;
  stripeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentDto {
  amountCents: number;
  currency: string;
  userId: string;
}

export interface UpdatePaymentDto {
  status?: string;
  stripeId?: string;
}
