export type TeamType = 'team' | 'classroom';

export interface Classroom {
  id: number;
  uuid: string;
  owner_id: number;
  name: string;
  description: string | null;
  color: string;
  team_type: TeamType;
  join_code: string | null;
  school_id: number | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
  user_role?: 'owner' | 'admin' | 'member';
  owner_username?: string;
  owner_avatar?: string | null;
}

export interface CreateClassroomDto {
  name: string;
  description?: string;
  color?: string;
  schoolId?: number;
}


export interface SchoolOrganization {
  id: number;
  uuid: string;
  admin_id: number;
  name: string;
  domain?: string | null;
  max_teachers: number;
  created_at: string;
  updated_at: string;
  teachers_count?: number;
  classrooms_count?: number;
  teachers?: SchoolTeacher[];
  is_admin?: boolean;
}

export interface SchoolTeacher {
  id: number;
  school_id: number;
  user_id: number;
  status: 'invited' | 'active' | 'revoked';
  created_at: string;
  username?: string;
  email?: string;
  avatar_url?: string | null;
}
