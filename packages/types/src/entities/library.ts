export interface Book {
  id: string;
  isbn?: string | null;
  title: string;
  author?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  category?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookCopy {
  id: string;
  bookId: string;
  book?: Book;
  barcode?: string | null;
  location?: string | null;
  status: "available" | "checked_out" | "lost" | "maintenance";
  createdAt: Date;
}

export interface Borrowing {
  id: string;
  copyId: string;
  studentId: string;
  checkedOutAt: Date;
  dueDate: Date;
  returnedAt?: Date | null;
}
