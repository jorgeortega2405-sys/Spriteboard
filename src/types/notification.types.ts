export type NotificationType =
  | 'canvas_invite'
  | 'team_invite'
  | 'canvas_comment'
  | 'system';

export interface NotificationItem {
  id: number;
  user_id: number;
  type: NotificationType | string;
  title: string;
  message: string;
  link_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface CreateNotificationDto {
  userId: number;
  type: NotificationType | string;
  title: string;
  message: string;
  linkUrl?: string | null;
}
