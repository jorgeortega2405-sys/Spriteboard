export interface Team {
  id: number;
  uuid: string;
  owner_id: number;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  user_role?: 'owner' | 'admin' | 'member';
}

export interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role: 'admin' | 'member';
  created_at: string;
  username?: string;
  email?: string;
  avatar_url?: string | null;
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  color?: string;
}

export interface AddTeamMemberDto {
  userId: number;
  role?: 'admin' | 'member';
}

export interface CanvasTeam {
  id: number;
  canvas_id: number;
  team_id: number;
  role: 'editor' | 'viewer';
  created_at: string;
  team_uuid?: string;
  team_name?: string;
  team_color?: string;
  member_count?: number;
}
