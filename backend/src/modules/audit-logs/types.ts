export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  details: string;
  createdAt: Date;
}

export interface CreateAuditLogDto {
  userId?: string;
  action: string;
  details: string;
}
