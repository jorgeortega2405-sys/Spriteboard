export interface AnalyticsOverviewData {
  activeCanvases30d: number;
  aiFeedbackDislikes: number;
  aiFeedbackLikes: number;
  aiFeedbackTotal: number;
  aiSatisfactionPercent: number;
  arrEstimated: number;
  avgCanvasSizeBytes: number;
  avgDurationSeconds: number;
  avgOrderValue: number;
  canvasCommentsTotal: number;
  canvasViewsTotal: number;
  canvasesTotal: number;
  classroomsTotal: number;
  compressedStorageBytes: number;
  compressionSavingsPercent: number;
  conversionRatePercent: number;
  dau: number;
  foldersTotal: number;
  googleAuthPercent: number;
  mau: number;
  mrrEstimated: number;
  newUsers30d: number;
  privateCanvasesTotal: number;
  publicCanvasesTotal: number;
  purchasesCount: number;
  rawStorageBytes: number;
  schoolsTotal: number;
  snapshotsTotal: number;
  stickinessRatio: number;
  teamMembersTotal: number;
  teamsTotal: number;
  tierDistribution: { business: number; free: number; pro: number };
  totalRevenue: number;
  twoFactorAdoptionPercent: number;
  usersTotal: number;
  wau: number;
}

export interface AnalyticsTrendPoint {
  canvases: number;
  date: string;
  label: string;
  rawStorageMb: number;
  revenue: number;
  storageMb: number;
  users: number;
  views: number;
}

export interface AnalyticsBreakdownData {
  activityByDay: { count: number; day: string }[];
  activityByHour: { count: number; hour: number }[];
  authDistribution: { googleAuth: number; passwordOnly: number; twoFactorEnabled: number };
  formats: { count: number; label: string }[];
  geoDistribution: { code: string; count: number; country: string }[];
  preferences: { languages: { count: number; label: string }[]; themes: { count: number; label: string }[] };
  resolutions: { count: number; label: string }[];
  tiers: { business: number; free: number; pro: number };
}

export interface AnalyticsFinancialsAndTeamsData {
  aiHealth: {
    dislikes: number;
    likes: number;
    satisfactionPercent: number;
    total: number;
  };
  purchasesByPlan: { count: number; planId: string; revenue: number }[];
  recentPurchases: {
    amount: number;
    billingPeriod: string;
    createdAt: string;
    currency: string;
    id: number;
    planId: string;
    status: string;
    userEmail: string;
    username: string;
  }[];
  revenueByPeriod: { billingPeriod: string; count: number; revenue: number }[];
  teamsOverview: {
    avgMembersPerTeam: number;
    classroomsCount: number;
    schoolsCount: number;
    teamsCount: number;
    totalMembers: number;
  };
}

export interface AnalyticsRankingsData {
  topCanvases: {
    accessLevel: string;
    commentsCount: number;
    creatorUsername: string;
    height: number;
    id: number;
    name: string;
    sizeBytes: number;
    updatedAt: string;
    uuid: string;
    viewsCount: number;
    width: number;
  }[];
  topCreators: {
    avatarUrl: string | null;
    canvasCount: number;
    tier: string;
    totalBytes: number;
    totalComments: number;
    totalViews: number;
    userId: number;
    username: string;
  }[];
}

export interface DatabaseSchemaColumn {
  columnComment?: string;
  columnDefault?: string | null;
  columnKey: string;
  columnName: string;
  dataType?: string;
  isNullable: boolean;
  typeFormatted?: string;
}

export interface DatabaseSchemaTable {
  columns: DatabaseSchemaColumn[];
  database?: string;
  databaseName?: string;
  engine?: string;
  estimatedRows: number;
  tableComment?: string;
  tableName: string;
}

export interface RedisKeyPattern {
  dataStructure?: string;
  description: string;
  pattern: string;
  ttl: string;
  type?: string;
}

export interface DatabaseSchemaResponse {
  databases: {
    description?: string;
    engine?: string;
    name: string;
    tables: DatabaseSchemaTable[];
  }[];
  redisKeys?: RedisKeyPattern[];
}

export interface SqlQueryResult {
  columns: string[];
  executionTimeMs: number;
  ok?: boolean;
  query?: string;
  rowCount?: number;
  rows: Record<string, any>[];
  totalRows?: number;
  truncated?: boolean;
}
