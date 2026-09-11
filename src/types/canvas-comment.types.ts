export interface CanvasCommentAuthor {
  avatar_url?: string | null;
  id: number;
  initials: string;
  username: string;
}

export interface CanvasCommentReply {
  author: CanvasCommentAuthor;
  canvas_id: number;
  content: string;
  created_at: string;
  id: number;
  parent_id: number;
  status: 'open' | 'resolved';
  updated_at: string;
  user_id: number;
  uuid: string;
}

export interface CanvasComment {
  author: CanvasCommentAuthor;
  canvas_id: number;
  content: string;
  created_at: string;
  frame_index: number;
  id: number;
  parent_id: number | null;
  pos_x: number | null;
  pos_y: number | null;
  replies: CanvasCommentReply[];
  reply_count: number;
  status: 'open' | 'resolved';
  updated_at: string;
  user_id: number;
  uuid: string;
}

export interface CreateCommentDto {
  content: string;
  frameIndex?: number;
  parentId?: string;
  posX?: number;
  posY?: number;
}

export interface UpdateCommentDto {
  content?: string;
  status?: 'open' | 'resolved';
}
