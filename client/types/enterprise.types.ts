export type EnterpriseTenantType = 'business' | 'university' | 'school';

export interface EnterpriseTenant {
  id: number;
  uuid: string;
  owner_id: number;
  tenant_type: EnterpriseTenantType;
  name: string;
  domain: string;
  sso_enabled: boolean;
  idp_entity_id: string | null;
  idp_sso_url: string | null;
  idp_certificate: string | null;
  scim_enabled: boolean;
  target_team_id: number | null;
  created_at: string;
  updated_at: string;
  users_count?: number;
}

export interface EnterpriseSsoConfigDto {
  domain: string;
  sso_enabled?: boolean;
  idp_entity_id?: string;
  idp_sso_url?: string;
  idp_certificate?: string;
  scim_enabled?: boolean;
  target_team_id?: number | null;
}

export interface ScimTokenGenerateResult {
  token: string;
  scim_url: string;
}
