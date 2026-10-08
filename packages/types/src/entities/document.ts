export type DocumentType = "pdf" | "image" | "spreadsheet" | "other";

export interface Document {
  id: string;
  filename: string;
  url: string;
  type: DocumentType;
  category?: string | null;
  uploadedById?: string | null;
  relatedId?: string | null;
  relatedType?: string | null;
  createdAt: Date;
}
