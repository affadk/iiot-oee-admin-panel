/**
 * Method HTTP — domain iam: info, roles, permissions, user-roles.
 *
 * Dipisah dari `http/iam.ts` (401/600) pada FAT-285 (E32.4), mengikuti pola
 * demo (`demo/iam/roles.ts` vs `demo/iam/policies.ts`, E20 P20.3) dan
 * kontrak rule 2 (urutan domain sama di kedua sisi). Barrel penggabung ada
 * di `http/iam.ts`. Tanpa mengubah perilaku.
 *
 * E20 P20.3: baca IAM digate `access_control.read` (kunci terpisah dari
 * `access_control.manage` untuk tulis); body tulis policy/permission
 * camelCase (§3.4, spec 042) — TANPA `reason` di baris policy (hanya di audit
 * IAM); TANPA `privilege_level`/`policy_count`; revoke user-role idempoten.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, checkAbortHttp } from '../transport';
import { mapIamRole, mapIamPermission, mapIamAssignment, mapIamInfo } from '../mappers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { IamInfo, IamRole, IamPermission, IamAssignment, ScopeLevel } from '../../../../types/iam';

const IAM_READ_CAPABILITY = 'access_control.read' as const;
const IAM_MANAGE_CAPABILITY = 'access_control.manage' as const;

export const httpIamRoles = {
  // -- IAM (Guide §4.6g: tanpa privilege_level; peran dari server) --------------
  async getIamInfo(signal?: AbortSignal): Promise<IamInfo> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson({ path: ADMIN_ENDPOINTS.IAM_INFO.buildPath(), signal, endpointKey: 'IAM_INFO', capability: IAM_READ_CAPABILITY }, mapIamInfo);
  },

  async getIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_ROLES_LIST.buildPath(), signal, endpointKey: 'IAM_ROLES_LIST', capability: IAM_READ_CAPABILITY },
      mapIamRole,
      100,
    ).then((p) => p.data);
  },

  async createIamRole(data: { name: string; description?: string }): Promise<IamRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // §3.4: body = {name, description} — TANPA privilege_level (hierarki
    // statis dihapus backend-side, E20 P20.3).
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_ROLES_CREATE.buildPath(),
        body: { name: data.name.trim(), ...(data.description ? { description: data.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_ROLES_CREATE',
        capability: IAM_MANAGE_CAPABILITY,
      },
      mapIamRole,
    );
  },

  async updateIamRole(
    roleId: string,
    changes: { description?: string }
  ): Promise<IamRole> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.IAM_ROLES_UPDATE.buildPath(roleId),
        body: { ...(changes.description !== undefined ? { description: changes.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_ROLES_UPDATE',
        capability: IAM_MANAGE_CAPABILITY,
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
      capability: IAM_MANAGE_CAPABILITY,
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },

  async getIamPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.IAM_PERMISSIONS_LIST.buildPath(), signal, endpointKey: 'IAM_PERMISSIONS_LIST', capability: IAM_READ_CAPABILITY },
      mapIamPermission,
      100,
    ).then((p) => p.data);
  },

  async createIamPermission(data: Omit<IamPermission, 'id'>): Promise<IamPermission> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    // §3.4: body tulis permission camelCase {action, resourceType, description}.
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.IAM_PERMISSIONS_CREATE.buildPath(),
        body: { action: data.action, resourceType: data.resourceType, ...(data.description ? { description: data.description } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'IAM_PERMISSIONS_CREATE',
        capability: IAM_MANAGE_CAPABILITY,
      },
      mapIamPermission,
    );
  },

  async addIamRolePermission(
    roleId: string,
    permissionId: string,
    options?: { resourcePattern?: string; effect?: 'ALLOW' | 'DENY'; abacCondition?: Record<string, unknown> | null }
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
        // E28 Batch A (FAT-229 MUT-03): POST menolak `abacCondition: null`
        // (optional record, bukan nullable) — omit bila kosong/null.
        ...(options?.abacCondition !== undefined && options.abacCondition !== null
          ? { abacCondition: options.abacCondition }
          : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'IAM_ROLE_PERMISSIONS_ADD',
      capability: IAM_MANAGE_CAPABILITY,
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
      capability: IAM_MANAGE_CAPABILITY,
      resourceId: roleId,
    });
    return { success: raw?.success ?? true };
  },

  /**
   * E28 Batch A (B17): spec 20 Nov mendukung filter server-side
   * `?operatorId=` — kirim ke server, jangan saring client-side bila hanya
   * satu operator yang dibutuhkan.
   */
  async getIamUserRoles(
    filters: { operatorId?: string } = {},
    signal?: AbortSignal,
  ): Promise<IamAssignment[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.IAM_USER_ROLES_LIST.buildPath(),
        query: filters.operatorId ? { operatorId: filters.operatorId } : undefined,
        signal,
        endpointKey: 'IAM_USER_ROLES_LIST',
        capability: IAM_READ_CAPABILITY,
      },
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
        capability: IAM_MANAGE_CAPABILITY,
        resourceId: data.operatorId,
      },
      mapIamAssignment,
    );
  },
  /**
   * §3.4: tanpa baris cocok → 200 `{success:true, removed:0}` (idempoten,
   * BUKAN 404).
   */
  async revokeIamUserRole(assignment: {
    id?: string;
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<{ success: boolean; removed: number }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean; removed?: number } | undefined>({
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
      capability: IAM_MANAGE_CAPABILITY,
      resourceId: assignment.operatorId,
    });
    return { success: raw?.success ?? true, removed: raw?.removed ?? 1 };
  },
};
