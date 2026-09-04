/**
 * Tipos e Interfaces para el Sistema de Telemetría y Métricas en Apache Cassandra
 */

export interface HttpMetricInput {
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  ip?: string | null;
  userAgent?: string | null;
  timestamp?: Date;
}

export interface TelemetryEventInput {
  eventName: string;
  category: string;
  userId?: number | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: Date;
}

export interface SystemMetricInput {
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  eventLoopLagMs: number;
  activeRequests: number;
  timestamp?: Date;
}

export interface WebVitalInput {
  metricName: string;
  value: number;
  rating: string;
  pagePath: string;
  timestamp?: Date;
}

export interface TelemetryStatsSummary {
  today: string;
  totalRequests: number;
  avgDurationMs: number;
  statusDistribution: {
    '2xx': number;
    '3xx': number;
    '4xx': number;
    '5xx': number;
  };
  recentMetrics: Array<{
    id: string;
    route: string;
    method: string;
    statusCode: number;
    durationMs: number;
    timestamp: Date;
  }>;
  recentEvents: Array<{
    id: string;
    eventName: string;
    category: string;
    userId: number | null;
    timestamp: Date;
  }>;
  latestSystemMetrics: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    eventLoopLagMs: number;
    activeRequests: number;
    timestamp: Date;
  } | null;
}
