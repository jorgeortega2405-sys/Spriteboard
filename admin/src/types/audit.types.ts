export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AuditStatus = 'failure' | 'success';

export interface AdminAuditInput {
  action: string;
  actorId: number;
  actorRole?: string;
  actorUsername?: string;
  description: string;
  ipAddress?: string;
  module: string;
  newValues?: Record<string, unknown> | string | null;
  oldValues?: Record<string, unknown> | string | null;
  riskLevel?: AuditRiskLevel;
  status?: AuditStatus;
  targetId?: number | string;
  targetType?: string;
  userAgent?: string;
}

export interface AdminAuditRecord {
  action: string;
  actor_id: number;
  actor_role: string;
  actor_username: string;
  bucket_month: string;
  created_at: string;
  description: string;
  id: string;
  ip_address: string;
  module: string;
  new_values: string | null;
  old_values: string | null;
  risk_level: AuditRiskLevel;
  status: AuditStatus;
  target_id: string;
  target_type: string;
  user_agent: string;
}

export interface CopilotAuditInput {
  adminId: number;
  adminUsername?: string;
  executionTimeMs?: number;
  modelReply: string;
  pageContext: string;
  sqlQueriesExecuted?: Array<{ executionTimeMs: number; rowsCount: number; sql: string }>;
  success?: boolean;
  userPrompt: string;
}

export interface CopilotAuditRecord {
  admin_id: number;
  admin_username: string;
  bucket_month: string;
  created_at: string;
  execution_time_ms: number;
  id: string;
  model_reply: string;
  page_context: string;
  sql_queries_executed: string;
  success: boolean;
  user_prompt: string;
}

export interface UserChatMessageRecord {
  content: string;
  created_at: string;
  feedback_rating: string;
  is_admin: boolean;
  message_id: string;
  metadata: string;
  model_name: string;
  sender_role: string;
  session_id: string;
  tokens_completion: number;
  tokens_prompt: number;
  user_id: number;
  username: string;
}

export interface UserChatSessionRecord {
  bucket_month: string;
  created_at: string;
  first_message: string;
  last_message_at: string;
  session_id: string;
  total_messages: number;
  user_id: number;
}
