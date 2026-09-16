import type { RowDataPacket } from 'mysql2';

export type InternalTicketCategory = 'access' | 'facilities' | 'hardware' | 'network' | 'other' | 'software';

export type InternalTicketPriority = 'high' | 'low' | 'medium' | 'urgent';

export type InternalTicketStatus = 'closed' | 'in_progress' | 'open' | 'resolved' | 'waiting_third_party';

export interface InternalTicketRecord extends RowDataPacket {
  assigned_agent_avatar?: string | null;
  assigned_agent_id: number | null;
  assigned_agent_username?: string | null;
  category: InternalTicketCategory;
  created_at: Date | string;
  creator_avatar?: string | null;
  creator_email?: string | null;
  creator_id: number;
  creator_username: string;
  description: string;
  id: number;
  location: string | null;
  priority: InternalTicketPriority;
  resolution_note: string | null;
  resolved_at: Date | string | null;
  resolved_by: number | null;
  resolved_by_username?: string | null;
  status: InternalTicketStatus;
  ticket_number: string;
  updated_at: Date | string;
  uuid: string;
}

export interface InternalTicketMessageRecord extends RowDataPacket {
  created_at: Date | string;
  id: number;
  is_internal_note: boolean | number;
  message: string;
  ticket_id: number;
  user_avatar?: string | null;
  user_id: number;
  user_role?: string | null;
  user_username: string;
}

export interface InternalTicketListFilters {
  category?: InternalTicketCategory;
  filterScope?: 'all' | 'assigned_to_me' | 'created_by_me' | 'open_queue';
  limit?: number;
  page?: number;
  priority?: InternalTicketPriority;
  search?: string;
  status?: InternalTicketStatus | 'all';
}

export interface InternalTicketListResult {
  hasMore: boolean;
  page: number;
  tickets: InternalTicketRecord[];
  total: number;
}

export interface InternalTicketStats {
  inProgress: number;
  myActive: number;
  open: number;
  resolved: number;
  total: number;
  urgent: number;
  waitingThirdParty: number;
}

export interface CreateInternalTicketInput {
  category: InternalTicketCategory;
  creatorId: number;
  description: string;
  location?: string;
  priority?: InternalTicketPriority;
  title: string;
}
