export type InternalTicketCategory = 'access' | 'facilities' | 'hardware' | 'network' | 'other' | 'software';

export type InternalTicketPriority = 'high' | 'low' | 'medium' | 'urgent';

export type InternalTicketStatus = 'closed' | 'in_progress' | 'open' | 'resolved' | 'waiting_third_party';

export interface InternalTicketItem {
  assigned_agent_avatar?: string | null;
  assigned_agent_id: number | null;
  assigned_agent_username?: string | null;
  category: InternalTicketCategory;
  created_at: string;
  creator_avatar?: string | null;
  creator_email?: string | null;
  creator_id: number;
  creator_username: string;
  description: string;
  id: number;
  location: string | null;
  priority: InternalTicketPriority;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: number | null;
  resolved_by_username?: string | null;
  status: InternalTicketStatus;
  ticket_number: string;
  title: string;
  updated_at: string;
  uuid: string;
}

export interface InternalTicketMessageItem {
  created_at: string;
  id: number;
  is_internal_note: boolean;
  message: string;
  ticket_id: number;
  user_avatar?: string | null;
  user_id: number;
  user_username: string;
}

export interface InternalTicketStatsData {
  inProgress: number;
  myActive: number;
  open: number;
  resolved: number;
  total: number;
  urgent: number;
  waitingThirdParty: number;
}
