/**
 * Method demo — domain IAM: roles: info + CRUD.
 *
 * Dipisah dari demo/iam/roles.ts (482 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya (../roles.ts).
 */
import { store } from '../../store';
import { checkAbort, assertCapability, throwValidationIssues } from '../../helpers';
import { ADMIN_ENDPOINTS } from '../../../endpoints';
import { ApiError } from '../../../../../types/auth';
import { IamInfo, IamRole } from '../../../../../types/iam';
import { VALIDATION_PATTERNS, isAdminRoleName } from '../../../../../utils/capabilities';
import { IamRoleSchema } from '../../../schemas';

export const demoIamRolesCrud = {
  async getIamInfo(signal?: AbortSignal): Promise<IamInfo> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    store.recordEndpoint('IAM_INFO', ADMIN_ENDPOINTS.IAM_INFO.buildPath());
    return { ...store.iamInfo };
  },

  async getIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    store.recordEndpoint('IAM_ROLES_LIST', ADMIN_ENDPOINTS.IAM_ROLES_LIST.buildPath());
    return store.iamRoles.map((r) => IamRoleSchema.parse({ ...r }));
  },

  async createIamRole(data: { name: string; description: string }): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN']);
    const trimmedName = data.name.trim();
    const trimmedDesc = data.description.trim();
    const fieldErrors: Record<string, string> = {};

    if (!VALIDATION_PATTERNS.IAM_ROLE_NAME.test(trimmedName)) {
      fieldErrors.name = 'Nama role wajib diawali huruf, panjang 2–64 karakter (huruf, angka, "_", "-").';
    }
    if (trimmedDesc.length < 3 || trimmedDesc.length > 256) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembuatan custom role gagal.', fieldErrors);
    }

    store.recordEndpoint('IAM_ROLES_CREATE', ADMIN_ENDPOINTS.IAM_ROLES_CREATE.buildPath());
    // §3.4: hanya ADMIN yang immutable/reserved — preset lain boleh dibuat
    // ulang bila sudah dihapus.
    if (isAdminRoleName(trimmedName)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Nama "ADMIN" dicadangkan (immutable) dan tidak dapat dibuat ulang.',
        httpStatus: 403,
      });
    }
    if (store.iamRoles.some((r) => r.name.toUpperCase() === trimmedName.toUpperCase())) {
      throw new ApiError({ code: 'CONFLICT', message: `Role "${trimmedName}" sudah ada.`, httpStatus: 409 });
    }

    const newRole: IamRole = IamRoleSchema.parse({
      id: `role-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      name: trimmedName,
      is_system: false,
      description: trimmedDesc,
      created_at: new Date().toISOString(),
    });
    store.iamRoles.push(newRole);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('CREATE_ROLE', 'IAM', newRole.id, `Created custom IAM role ${newRole.name}`);
    return { ...newRole };
  },

  async updateIamRole(
    roleId: string,
    patch: { description?: string }
  ): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_UPDATE', ADMIN_ENDPOINTS.IAM_ROLES_UPDATE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isAdminRoleName(role.name)) {
      throw new ApiError({
        code: 'ROLE_IMMUTABLE',
        message: 'Role ADMIN immutable dan tidak dapat diubah.',
        httpStatus: 403,
      });
    }
    const fieldErrors: Record<string, string> = {};
    if (patch.description !== undefined && (patch.description.trim().length < 3 || patch.description.trim().length > 256)) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembaruan role gagal.', fieldErrors);
    }
    if (patch.description !== undefined) role.description = patch.description.trim();
    store.addAudit('UPDATE_ROLE', 'IAM', roleId, `Updated IAM role ${role.name}`);
    return IamRoleSchema.parse({ ...role });
  },

  async deleteIamRole(roleId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_DELETE', ADMIN_ENDPOINTS.IAM_ROLES_DELETE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isAdminRoleName(role.name)) {
      throw new ApiError({
        code: 'ROLE_IMMUTABLE',
        message: 'Role ADMIN immutable dan tidak dapat dihapus.',
        httpStatus: 403,
      });
    }
    const activeAssignments = store.iamAssignments.filter(
      (a) => a.role_id === roleId || a.role_name === role.name
    );
    if (activeAssignments.length > 0) {
      throw new ApiError({
        code: 'ROLE_IN_USE',
        message: `Role "${role.name}" masih ter-assign ke operator ${activeAssignments[0].operator_id}. Cabut penugasan user terlebih dahulu sebelum menghapus role.`,
        httpStatus: 409,
      });
    }
    const remainingPolicies = store.iamPolicies.filter((p) => p.roleId === roleId);
    if (remainingPolicies.length > 0) {
      // §3.4: role masih punya policy → 409 ROLE_IN_USE. Policy TIDAK dihapus
      // diam-diam (perilaku lama dihapus, E20 P20.3).
      throw new ApiError({
        code: 'ROLE_IN_USE',
        message: `Role "${role.name}" masih memiliki ${remainingPolicies.length} policy. Hapus policy role terlebih dahulu sebelum menghapus role.`,
        httpStatus: 409,
      });
    }
    store.iamRoles = store.iamRoles.filter((r) => r.id !== roleId);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_ROLE', 'IAM', roleId, `Deleted custom IAM role ${role.name}`);
    return { success: true };
  }
};
