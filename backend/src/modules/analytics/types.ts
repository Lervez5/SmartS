export interface AnalyticsEvent {
  id: string;
  type: string;
  data: any;
  userId?: string;
  createdAt: Date;
}

export interface AnalyticsSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
}
