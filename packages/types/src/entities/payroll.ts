export type PayrollStatus = "pending" | "paid" | "cancelled";

export interface PayrollRecord {
  id: string;
  staffId: string;
  period: string;
  grossAmount: number;
  deductions?: number | null;
  netAmount: number;
  currency: string;
  status: PayrollStatus;
  paidAt?: Date | null;
  createdAt: Date;
}
