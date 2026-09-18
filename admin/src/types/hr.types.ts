import { RowDataPacket } from 'mysql2';
import { UserRole } from './auth.types.js';

export type ContractType = 'contractor' | 'full_time' | 'internship' | 'part_time' | 'temporary';
export type WorkMode = 'hybrid' | 'onsite' | 'remote';
export type EmployeeStatus = 'active' | 'onboarding' | 'suspended' | 'terminated';
export type DocumentType = 'contract' | 'id_card' | 'nda' | 'other' | 'resume';
export type CompensationChangeType = 'department_transfer' | 'hire' | 'promotion' | 'role_change' | 'salary_adjustment';
export type TimeOffRequestType = 'maternity_paternity' | 'other' | 'personal' | 'sick_leave' | 'unpaid' | 'vacation';
export type TimeOffStatus = 'approved' | 'cancelled' | 'pending' | 'rejected';

export interface EmployeeRecord extends RowDataPacket {
  avatar_url?: string | null;
  contract_type: ContractType;
  created_at: Date;
  currency: string;
  department: string;
  document_id: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  first_name: string;
  hire_date: Date | string;
  id: number;
  job_title: string;
  last_name: string;
  manager_id: number | null;
  manager_job_title?: string | null;
  manager_name?: string | null;
  personal_email: string;
  phone: string | null;
  role?: UserRole;
  roles?: UserRole[];
  salary: number | null;
  status: EmployeeStatus;
  updated_at: Date;
  user_id: number;
  username?: string;
  uuid: string;
  work_email: string;
  work_mode: WorkMode;
}

export interface EmployeeDocumentRecord extends RowDataPacket {
  created_at: Date;
  document_type: DocumentType;
  employee_id: number;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  id: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_by_username?: string;
  uuid: string;
}

export interface CompensationHistoryRecord extends RowDataPacket {
  approved_by_name?: string | null;
  approved_by_user_id: number | null;
  change_type: CompensationChangeType;
  created_at: Date;
  currency: string;
  effective_date: Date | string;
  employee_id: number;
  id: number;
  new_department: string;
  new_job_title: string;
  new_salary: number | null;
  previous_department: string | null;
  previous_job_title: string | null;
  previous_salary: number | null;
  reason: string | null;
  uuid: string;
}

export interface TimeOffBalanceRecord extends RowDataPacket {
  employee_id: number;
  id: number;
  personal_days_used: number;
  sick_days_used: number;
  updated_at: Date;
  vacation_days_total: number;
  vacation_days_used: number;
  year: number;
}

export interface TimeOffRequestRecord extends RowDataPacket {
  created_at: Date;
  employee_department?: string;
  employee_id: number;
  employee_name?: string;
  employee_uuid?: string;
  end_date: Date | string;
  id: number;
  reason: string | null;
  rejection_reason: string | null;
  request_type: TimeOffRequestType;
  reviewed_by_name?: string | null;
  reviewed_by_user_id: number | null;
  start_date: Date | string;
  status: TimeOffStatus;
  total_days: number;
  updated_at: Date;
  uuid: string;
}

export interface OrgChartNode {
  avatar_url?: string | null;
  department: string;
  direct_reports_count: number;
  id: number;
  job_title: string;
  manager_id: number | null;
  name: string;
  role?: string;
  status: EmployeeStatus;
  subordinates?: OrgChartNode[];
  user_id: number;
  uuid: string;
  work_email: string;
}

export interface HireEmployeeInput {
  contract_type?: ContractType;
  currency?: string;
  department: string;
  document_id: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  first_name: string;
  hire_date?: string;
  job_title: string;
  last_name: string;
  manager_id?: number | null;
  personal_email: string;
  phone?: string;
  role: UserRole;
  salary?: number;
  username?: string;
  work_email: string;
  work_mode?: WorkMode;
}
