export interface DashboardSummary {
  accountsToday: number;
  accountsTotal: number;
  accountsYesterday: number;
  canvasesToday: number;
  canvasesTotal: number;
  canvasesYesterday: number;
  ticketsActive: number;
  ticketsResolved: number;
  ticketsTotal: number;
  activeSubscribers: number;
  totalSubscribers: number;
}

export interface DashboardTimeSeriesPoint {
  date: string;
  label: string;
  accounts: number;
  canvases: number;
}

export interface DashboardTierDistribution {
  free: number;
  pro: number;
  business: number;
}

export interface DashboardTicketsByStatus {
  queued: number;
  in_progress: number;
  escalated: number;
  resolved: number;
  closed: number;
}

export interface DashboardStatsResponse {
  summary: DashboardSummary;
  trends: DashboardTimeSeriesPoint[];
  tiers: DashboardTierDistribution;
  tickets: DashboardTicketsByStatus;
}
