/**
 * Method demo — domain operators.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Operator } from '../../../types/production';
import { UserRole, ApiError } from '../../../types/auth';
import { validateOperatorInput } from '../../../utils/capabilities';
import { OperatorSchema } from '../schemas';

/**
 * §H: larangan ADMIN ganda — role ADMIN hanya untuk akun root ADM-001.
 * Hierarki level DIHAPUS (E20 P20.3); otorisasi via guard policy + peran
 * efektif, bukan perbandingan level.
 */
function assertAdminSingletonTarget(operatorId: string, role: string): void {
  if (role === 'ADMIN' && operatorId !== 'ADM-001') {
    throw new ApiError({
      code: 'ADMIN_SINGLETON_DENIED',
      message: "Role ADMIN is reserved for the root account 'ADM-001'.",
      httpStatus: 403,
    });
  }
}

export const demoOperators = {
  // =========================================================================
  // OPERATORS (7 ops — ADMIN/SUPERVISOR read/create/status; ADMIN ONLY update/delete/password)
  // =========================================================================
  async getOperators(signal?: AbortSignal): Promise<Operator[]> {
    checkAbort(signal);
    assertCapability('operator.read', ['ADMIN', 'SUPERVISOR']);
    store.recordEndpoint('OPERATORS_LIST', ADMIN_ENDPOINTS.OPERATORS_LIST.buildPath());
    return store.operators.map((o) => OperatorSchema.parse({ ...o }));
  },

  async getOperatorById(operatorId: string, signal?: AbortSignal): Promise<Operator> {
    checkAbort(signal);
    assertCapability('operator.read', ['ADMIN', 'SUPERVISOR'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_GET', ADMIN_ENDPOINTS.OPERATORS_GET.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    return OperatorSchema.parse({ ...op });
  },

  async createOperator(data: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
    password: string;
    is_active?: boolean;
  }): Promise<Operator> {
    assertCapability('operator.create', ['ADMIN', 'SUPERVISOR'], { resourceId: data.operator_id });
    assertAdminSingletonTarget(data.operator_id, data.role);

    const errors = validateOperatorInput({
      operatorId: data.operator_id,
      operatorName: data.name,
      lineId: data.line_id,
      password: data.password,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan operator gagal.', errors);
    }

    store.recordEndpoint('OPERATORS_CREATE', ADMIN_ENDPOINTS.OPERATORS_CREATE.buildPath());
    const id = data.operator_id.trim();
    if (store.operators.some((o) => o.operator_id === id)) {
      throw new ApiError({
        code: 'OPERATOR_ALREADY_EXISTS',
        message: `Operator ID "${id}" sudah ada.`,
        httpStatus: 409,
      });
    }

    const newOp: Operator = OperatorSchema.parse({
      operator_id: id,
      name: data.name.trim(),
      role: data.role,
      line_id: data.line_id?.trim() || '',
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
    });
    store.operators.push(newOp);
    store.operatorPasswords.set(newOp.operator_id, data.password);
    store.addAudit('CREATE_OPERATOR', 'OPERATOR', newOp.operator_id, `Created operator ${newOp.name} (${newOp.role})`);
    return { ...newOp };
  },

  async updateOperator(
    operatorId: string,
    patch: { name?: string; role?: UserRole; line_id?: string }
  ): Promise<Operator> {
    assertCapability('operator.update', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_UPDATE', ADMIN_ENDPOINTS.OPERATORS_UPDATE.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    if ((op.is_protected || operatorId === 'ADM-001') && patch.role && patch.role !== 'ADMIN') {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: `Akun dilindungi (${op.operator_id}) tidak dapat diturunkan perannya.`,
        httpStatus: 403,
      });
    }
    // §H: perubahan label dicek terhadap ADMIN_SINGLETON_DENIED, bukan hierarki.
    if (patch.role) assertAdminSingletonTarget(operatorId, patch.role);
    const errors = validateOperatorInput({
      operatorName: patch.name ?? op.name,
      lineId: patch.line_id ?? op.line_id,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan operator gagal.', errors);
    }
    const roleChanged = patch.role !== undefined && patch.role !== op.role;
    if (patch.name !== undefined) op.name = patch.name.trim();
    if (patch.role !== undefined) op.role = patch.role;
    if (patch.line_id !== undefined) op.line_id = patch.line_id.trim();

    if (roleChanged) {
      store.iamInfo.authzVersion += 1;
      store.tokenAuthzVersion = store.iamInfo.authzVersion;
    }
    store.addAudit('UPDATE_OPERATOR', 'OPERATOR', operatorId, `Updated operator ${op.name}`);
    return OperatorSchema.parse({ ...op });
  },

  async deleteOperator(operatorId: string): Promise<{ success: boolean }> {
    assertCapability('operator.delete', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_DELETE', ADMIN_ENDPOINTS.OPERATORS_DELETE.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    if (op.is_protected || operatorId === 'ADM-001') {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: `Akun administrator dilindungi (${op.operator_id}) dan tidak dapat dihapus.`,
        httpStatus: 403,
      });
    }
    const activeWo = store.workOrders.find(
      (w) => w.operator_id === operatorId && w.status === 'ACTIVE'
    );
    if (activeWo) {
      throw new ApiError({
        code: 'OPERATOR_HAS_ACTIVE_WO',
        message: `Tidak dapat menghapus operator: masih aktif di Work Order ${activeWo.wo_id}.`,
        httpStatus: 409,
        activeWoId: activeWo.wo_id,
      });
    }
    // ON DELETE SET NULL for historical work orders + cascade cleanup for role assignments
    store.workOrders.forEach((wo) => {
      if (wo.operator_id === operatorId) {
        wo.operator_id = null;
        wo.operator_name = null;
      }
    });
    store.operators = store.operators.filter((o) => o.operator_id !== operatorId);
    store.iamAssignments = store.iamAssignments.filter((a) => a.operator_id !== operatorId);
    store.operatorPasswords.delete(operatorId);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_OPERATOR', 'OPERATOR', operatorId, `Deleted operator ${operatorId} (history preserved)`);
    return { success: true };
  },

  async rotateOperatorPassword(operatorId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    assertCapability('operator.password.rotate', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_PASSWORD', ADMIN_ENDPOINTS.OPERATORS_PASSWORD.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      throwValidationIssues('Password baru wajib 8–128 karakter.', {
        new_password: 'Minimal 8 dan maksimal 128 karakter.',
      });
    }
    store.operatorPasswords.set(operatorId, newPassword);
    store.addAudit('ROTATE_OPERATOR_PASSWORD', 'OPERATOR', operatorId, `Rotated password for ${operatorId}`);
    return { success: true, message: `Password untuk ${operatorId} berhasil dirotasi.` };
  },

  async toggleOperatorStatus(operatorId: string, isActive: boolean): Promise<Operator> {
    assertCapability('operator.status.update', ['ADMIN', 'SUPERVISOR'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_STATUS', ADMIN_ENDPOINTS.OPERATORS_STATUS.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    // §H: ADM-001 nonaktif → 400 PROTECTED_ACCOUNT (bukan 403).
    if ((op.is_protected || op.operator_id === 'ADM-001') && !isActive) {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: `Akun dilindungi (${op.operator_id}) tidak dapat dinonaktifkan.`,
        httpStatus: 400,
      });
    }

    const changed = op.is_active !== isActive;
    op.is_active = isActive;
    if (changed) {
      store.iamInfo.authzVersion += 1;
      store.tokenAuthzVersion = store.iamInfo.authzVersion;
    }
    store.addAudit('UPDATE_OPERATOR_STATUS', 'OPERATOR', operatorId, `Set active status to ${isActive}`);
    return OperatorSchema.parse({ ...op });
  }
};
