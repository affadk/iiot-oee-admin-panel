/**
 * Method HTTP — domain iam.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, checkAbortHttp } from './transport';
import { mapIamRole, mapIamPermission, mapIamAssignment, mapIamPolicy, mapIamAuditDecision, mapIamInfo, mapIamSubjectEffectivePermissions } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { IamInfo, IamRole, IamPermission, IamAssignment, IamPolicyRule, IamAuditDecision, IamEffectivePermissions, ScopeLevel } from '../../../types/iam';

export const httpIam = {
  // -- IAM (Guide §4.6g: tanpa privilege_level; peran dari server) --------------
  async getIamInfo(signal?: AbortSignal): Promise<IamInfo> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson({ path: ADMIN_ENDPOINTS.IAM_INFO.buildPath(), signal, endpointKey: 'IAM_INFO' }, mapIamInfo);
  },

  async getIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_ROLES_LIST.buildPath(), signal, endpointKey: 'IAM_ROLES_LIST', capability: 'access_control.manage' },
      mapIamRole,
      100,
    ).then((p) => p.data);
  },

  async createIamRole(data: { name: string; privilege_level?: number; description?: string }): Promise<IamRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // Guide §4.6g: body server = {name, description?, reason?} — TANPA
    // privilege_level (hierarki statis dihapus backend-side). Parameter
    // privilege_level diterima agar pemanggil demo tetap typecheck, tapi
    // TIDAK dikirim.
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_ROLES_CREATE.buildPath(),
        body: { name: data.name.trim(), ...(data.description ? { description: data.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_ROLES_CREATE',
        capability: 'access_control.manage',
      },
      mapIamRole,
    );
  },

  async updateIamRole(
    roleId: string,
    patch: { description?: string; privilege_level?: number }
  ): Promise<IamRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // privilege_level diterima (kompatibilitas demo) tapi tidak dikirim —
    // lihat createIamRole.
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.IAM_ROLES_UPDATE.buildPath(roleId),
        body: { ...(patch.description !== undefined ? { description: patch.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_ROLES_UPDATE',
        capability: 'access_control.manage',
        resourceId: roleId,
      },
      mapIamRole,
    );
  },

  async deleteIamRole(roleId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_ROLES_DELETE.buildPath(roleId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_ROLES_DELETE',
      capability: 'access_control.manage',
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },

  async getIamPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_PERMISSIONS_LIST.buildPath(), signal, endpointKey: 'IAM_PERMISSIONS_LIST', capability: 'access_control.manage' },
      mapIamPermission,
      100,
    ).then((p) => p.data);
  },

  async createIamPermission(data: Omit<IamPermission, 'id'>): Promise<IamPermission> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_PERMISSIONS_CREATE.buildPath(),
        body: { action: data.action, resource_type: data.resource_type, ...(data.description ? { description: data.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_PERMISSIONS_CREATE',
        capability: 'access_control.manage',
      },
      mapIamPermission,
    );
  },

  async addIamRolePermission(
    roleId: string,
    permissionId: string,
    options?: { resourcePattern?: string; effect?: 'ALLOW' | 'DENY'; abacCondition?: Record<string, unknown> | null; reason?: string }
  ): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_ADD.buildPath(roleId),
      body: {
        permissionId,
        ...(options?.resourcePattern ? { resourcePattern: options.resourcePattern } : {}),
        ...(options?.effect ? { effect: options.effect } : {}),
        ...(options?.abacCondition !== undefined ? { abacCondition: options.abacCondition } : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_ROLE_PERMISSIONS_ADD',
      capability: 'access_control.manage',
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },

  async removeIamRolePermission(roleId: string, permissionId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_DELETE.buildPath(roleId, permissionId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_ROLE_PERMISSIONS_DELETE',
      capability: 'access_control.manage',
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },

  async getIamUserRoles(signal?: AbortSignal): Promise<IamAssignment[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_USER_ROLES_LIST.buildPath(), signal, endpointKey: 'IAM_USER_ROLES_LIST', capability: 'access_control.manage' },
      mapIamAssignment,
      100,
    ).then((p) => p.data);
  },

  async assignIamUserRole(data: {
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<IamAssignment> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_USER_ROLES_CREATE.buildPath(),
        body: {
          operatorId: data.operatorId,
          roleName: data.roleName,
          scopeType: data.scopeType,
          ...(data.scopeId ? { scopeId: data.scopeId } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_USER_ROLES_CREATE',
        capability: 'access_control.manage',
        resourceId: data.operatorId,
      },
      mapIamAssignment,
    );
  },
  async revokeIamUserRole(assignment: {
    id?: string;
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_USER_ROLES_DELETE.buildPath(),
      body: {
        operatorId: assignment.operatorId,
        roleName: assignment.roleName,
        scopeType: assignment.scopeType,
        ...(assignment.scopeId ? { scopeId: assignment.scopeId } : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_USER_ROLES_DELETE',
      capability: 'access_control.manage',
      resourceId: assignment.operatorId,
    });
    return { success: raw?.success ?? true };
  },
  async getIamPolicies(signal?: AbortSignal): Promise<IamPolicyRule[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_POLICIES_LIST.buildPath(), signal, endpointKey: 'IAM_POLICIES_LIST', capability: 'access_control.manage' },
      mapIamPolicy,
      100,
    ).then((p) => p.data);
  },

  async createIamPolicy(data: Omit<IamPolicyRule, 'id'>): Promise<IamPolicyRule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_POLICIES_CREATE.buildPath(),
        body: { ...data },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_POLICIES_CREATE',
        capability: 'access_control.manage',
      },
      mapIamPolicy,
    );
  },

  async updateIamPolicy(
    policyId: string,
    patch: Partial<Pick<IamPolicyRule, 'eft' | 'action' | 'resource_pattern' | 'abac_condition' | 'is_active' | 'reason'>>
  ): Promise<IamPolicyRule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.IAM_POLICIES_UPDATE.buildPath(policyId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_POLICIES_UPDATE',
        capability: 'access_control.manage',
        resourceId: policyId,
      },
      mapIamPolicy,
    );
  },

  async deleteIamPolicy(policyId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.IAM_POLICIES_DELETE.buildPath(policyId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_POLICIES_DELETE',
      capability: 'access_control.manage',
      resourceId: policyId,
    });
    return { success: raw?.success ?? true };
  },

  async getSubjectEffectivePermissions(
    operatorId: string,
    signal?: AbortSignal
  ): Promise<IamEffectivePermissions> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.IAM_SUBJECT_EFFECTIVE_PERMISSIONS.buildPath(operatorId),
      signal,
      endpointKey: 'IAM_SUBJECT_EFFECTIVE_PERMISSIONS',
      capability: 'access_control.manage',
      resourceId: operatorId,
    });
    return mapIamSubjectEffectivePermissions(raw, operatorId);
  },

  async getIamAuditDecisions(limit = 100, signal?: AbortSignal): Promise<IamAuditDecision[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.IAM_AUDIT.buildPath(),
        query: { limit, envelope: true },
        signal,
        endpointKey: 'IAM_AUDIT',
        capability: 'access_control.manage',
      },
      mapIamAuditDecision,
      limit,
    ).then((p) => p.data);
  },

  async toggleIamPolicy(policyId: string, isActive: boolean): Promise<IamPolicyRule> {
    return httpIam.updateIamPolicy(policyId, { is_active: isActive });
  }
};
