export type ExpenseStatus = "pending" | "approved" | "paid" | "cancelled";

export interface Expense {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  currency: string;
  status: ExpenseStatus;
  category?: string | null;
  date: Date;
  approvedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
