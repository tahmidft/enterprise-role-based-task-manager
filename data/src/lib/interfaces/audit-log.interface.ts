export interface IAuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}
