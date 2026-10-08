export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}
