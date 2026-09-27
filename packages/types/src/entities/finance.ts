export type FinanceTransactionType = "fee" | "payment" | "refund" | "adjustment" | "credit";

export type FinanceTransactionStatus = "pending" | "completed" | "failed" | "cancelled";

export interface FinanceTransaction {
  id: string;
  studentId: string;
  type: FinanceTransactionType;
  amount: number;
  currency: string;
  status: FinanceTransactionStatus;
  description?: string | null;
  reference?: string | null;
  dueDate?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
