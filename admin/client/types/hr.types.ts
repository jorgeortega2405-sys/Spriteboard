export type ContractType = 'contractor' | 'full_time' | 'internship' | 'part_time' | 'temporary';
export type WorkMode = 'hybrid' | 'onsite' | 'remote';
export type EmployeeStatus = 'active' | 'onboarding' | 'suspended' | 'terminated';
export type DocumentType = 'contract' | 'id_card' | 'nda' | 'other' | 'resume';
export type CompensationChangeType = 'department_transfer' | 'hire' | 'promotion' | 'role_change' | 'salary_adjustment';
export type TimeOffRequestType = 'maternity_paternity' | 'other' | 'personal' | 'sick_leave' | 'unpaid' | 'vacation';
export type TimeOffStatus = 'approved' | 'cancelled' | 'pending' | 'rejected';

export interface Employee {
  avatar_url?: string | null;
  contract_type: ContractType;
  created_at: string;
  currency: string;
  department: string;
  document_id: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  first_name: string;
  hire_date: string;
  id: number;
  job_title: string;
  last_name: string;
  manager_id?: number | null;
  manager_job_title?: string | null;
  manager_name?: string | null;
  personal_email: string;
  phone?: string | null;
  role?: string;
  roles?: string[];
  salary?: number | null;
  status: EmployeeStatus;
  updated_at: string;
  user_id: number;
  username?: string;
  uuid: string;
  work_email: string;
  work_mode: WorkMode;
}

export interface EmployeeDocument {
  created_at: string;
  document_type: DocumentType;
  employee_id: number;
  file_name: string;
  file_size_bytes: number;
  id: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_by_username?: string;
  uuid: string;
}

export interface CompensationHistoryItem {
  approved_by_name?: string | null;
  approved_by_user_id: number | null;
  change_type: CompensationChangeType;
  created_at: string;
  currency: string;
  effective_date: string;
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

export interface TimeOffBalance {
  employee_id: number;
  id: number;
  personal_days_used: number;
  sick_days_used: number;
  vacation_days_remaining: number;
  vacation_days_total: number;
  vacation_days_used: number;
  year: number;
}

export interface TimeOffRequest {
  created_at: string;
  employee_department?: string;
  employee_id: number;
  employee_name?: string;
  employee_uuid?: string;
  end_date: string;
  id: number;
  reason: string | null;
  rejection_reason: string | null;
  request_type: TimeOffRequestType;
  reviewed_by_name?: string | null;
  reviewed_by_user_id: number | null;
  start_date: string;
  status: TimeOffStatus;
  total_days: number;
  updated_at: string;
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

export interface EmployeesResponse {
  employees: Employee[];
  pagination: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface EmployeeDetailResponse {
  balance?: TimeOffBalance;
  career_history?: CompensationHistoryItem[];
  documents: EmployeeDocument[];
  employee: Employee;
  manager?: Employee | null;
}
