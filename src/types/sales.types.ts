export interface SalesInquiryInput {
  company_email: string;
  company_name: string;
  company_size: string;
  contact_reason: string;
  country_or_region: string;
  department: string;
  first_name: string;
  how_can_we_help: string;
  ip_address?: string;
  last_name: string;
  phone_number: string;
  role_level: string;
  user_id?: number | null;
}

export interface SalesInquiryRecord extends SalesInquiryInput {
  created_at: string;
  id: number;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  updated_at: string;
  uuid: string;
}
