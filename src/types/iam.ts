export type ScopeLevel = 'ORGANIZATION' | 'SITE' | 'AREA' | 'LINE' | 'MACHINE' | 'DEVICE';

export interface IamInfo {
  mode: 'shadow' | 'enforce' | 'partial';
  authzVersion: number;
  effectiveInMode: string;
  enforcedDomains?: string[];
}

export interface IamRole {
  id: string;
  name: string;
  privilege_level: number;
  is_system: boolean;
  description: string;
  created_at: string;
  policy_count?: number;
}

export interface IamPermission {
  id: string;
  action: string;
  resource_type: string;
  description: string;
}

export interface IamAssignment {
  id: string;
  operator_id: string;
  operator_name: string;
  role_id: string;
  role_name: string;
  scope_type: ScopeLevel;
  scope_id: string | null;
  created_at: string;
}

export interface IamPolicyRule {
  id: string;
  role: string;
  subject_match?: string;
  role_id?: string;
  permission_id?: string;
  action: string;
  resource_pattern: string;
  eft: 'ALLOW' | 'DENY';
  abac_condition?: string | Record<string, unknown> | null;
  is_active: boolean;
  reason?: string;
}

export interface IamAuditDecision {
  id: string;
  subject: string;
  decision: 'ALLOW' | 'DENY';
  mode: 'shadow' | 'enforce';
  action: string;
  resource: string;
  reason?: string;
  timestamp: string;
}

export interface IamEffectivePermissions {
  operatorId: string;
  primaryRole: string;
  effectiveRoles: Array<{
    roleName: string;
    scopeType: ScopeLevel;
    scopeId: string | null;
  }>;
  permissions: Array<{
    action: string;
    resourceType: string;
    resourcePattern: string;
    effect: 'ALLOW' | 'DENY';
    sourceRole: string;
    abacCondition?: Record<string, unknown> | null;
  }>;
}
