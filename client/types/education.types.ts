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
  students_count?: number;
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

export interface SchoolStudent {
  id: number;
  user_id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  classrooms_count: number;
  source: 'sso_scim' | 'classroom' | 'domain';
  source_label: string;
  status: 'active';
  created_at: string;
}

export type AcademicRole = 'superadmin' | 'campus_admin' | 'faculty_admin' | 'professor' | 'ta' | 'student' | 'staff';

export interface UniversityCampus {
  id: number;
  tenant_id: number;
  name: string;
  code?: string | null;
  city?: string | null;
  faculties_count?: number;
  members_count?: number;
  created_at: string;
  updated_at: string;
}

export interface UniversityFaculty {
  id: number;
  campus_id: number;
  tenant_id: number;
  name: string;
  code?: string | null;
  dean_user_id?: number | null;
  dean_username?: string | null;
  campus_name?: string | null;
  members_count?: number;
  created_at: string;
  updated_at: string;
}

export interface UniversityMember {
  id: number;
  tenant_id: number;
  campus_id?: number | null;
  faculty_id?: number | null;
  user_id: number;
  academic_role: AcademicRole;
  student_code?: string | null;
  status: 'active' | 'suspended' | 'graduated';
  username?: string;
  email?: string;
  avatar_url?: string | null;
  subscription_tier?: string;
  campus_name?: string | null;
  faculty_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UniversityOverviewDto {
  tenant: {
    id: number;
    uuid: string;
    name: string;
    domain: string;
    sso_enabled: boolean;
    scim_enabled: boolean;
  };
  campuses: UniversityCampus[];
  faculties: UniversityFaculty[];
  total_students: number;
  total_professors: number;
  total_campuses: number;
  total_faculties: number;
  is_admin: boolean;
}
