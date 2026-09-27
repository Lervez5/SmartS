export interface InventoryItem {
  id: string;
  name: string;
  category?: string | null;
  quantity: number;
  unit?: string | null;
  location?: string | null;
  minThreshold?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
