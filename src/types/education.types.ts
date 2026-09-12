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

export interface ClassroomAssignment {
  id: number;
  uuid: string;
  classroom_id: number;
  classroom_uuid?: string;
  teacher_id: number;
  teacher_username?: string;
  canvas_template_id?: number | null;
  template_uuid?: string | null;
  template_name?: string | null;
  title: string;
  description?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  submission_count?: number;
  my_submission?: ClassroomSubmission | null;
}

export interface CreateAssignmentDto {
  title: string;
  description?: string;
  templateUuid?: string;
  dueDate?: string;
}

export interface ClassroomSubmission {
  id: number;
  assignment_id: number;
  assignment_uuid?: string;
  assignment_title?: string;
  student_id: number;
  student_username?: string;
  student_avatar?: string | null;
  canvas_id: number;
  canvas_uuid?: string;
  canvas_name?: string;
  canvas_thumbnail?: string | null;
  status: 'draft' | 'submitted' | 'reviewed';
  feedback?: string | null;
  grade?: string | null;
  submitted_at?: string | null;
  created_at: string;
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
