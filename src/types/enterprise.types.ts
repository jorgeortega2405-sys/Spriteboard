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
  scim_token_hash?: string | null;
  target_team_id: number | null;
  created_at: string;
  updated_at: string;
  users_count?: number;
}

export interface UserFederatedIdentity {
  id: number;
  tenant_id: number;
  user_id: number;
  external_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScimName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
}

export interface ScimEmail {
  value: string;
  primary?: boolean;
  type?: string;
}

export interface ScimMeta {
  resourceType: 'User' | 'Group' | 'ServiceProviderConfig';
  created?: string;
  lastModified?: string;
  location?: string;
}

export interface ScimUserResource {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name?: ScimName;
  displayName?: string;
  emails: ScimEmail[];
  active: boolean;
  meta: ScimMeta;
}

export interface ScimListResponse<T> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface ScimPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value?: any;
}

export interface ScimPatchRequest {
  schemas: string[];
  Operations: ScimPatchOperation[];
}
