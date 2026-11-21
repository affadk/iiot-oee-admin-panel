/**
 * Method HTTP — domain operators.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, checkAbortHttp } from './transport';
import { mapOperator } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { UserRole } from '../../../types/auth';
import { Operator } from '../../../types/production';

export const httpOperators = {
  // -- Operators (7 ops; roster terproteksi ADMIN/SUPERVISOR LAN) -----------
  async getOperators(signal?: AbortSignal): Promise<Operator[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      { path: ADMIN_ENDPOINTS.OPERATORS_LIST.buildPath(), signal, endpointKey: 'OPERATORS_LIST', capability: 'operator.read' },
      mapOperator,
      50,
    ).then((p) => p.data);
  },

  async getOperatorById(operatorId: string, signal?: AbortSignal): Promise<Operator> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.OPERATORS_GET.buildPath(operatorId), signal, endpointKey: 'OPERATORS_GET', capability: 'operator.read', resourceId: operatorId },
      mapOperator,
    );
  },

  async createOperator(data: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
    password: string;
    is_active?: boolean;
  }): Promise<Operator> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.OPERATORS_CREATE.buildPath(),
        body: {
          operatorId: data.operator_id.trim(),
          operatorName: data.name.trim(),
          role: data.role,
          password: data.password,
          ...(data.line_id ? { lineId: data.line_id.trim() } : {}),
          // E20 P20.5 (FAT-157, R7): kirim `isActive` bila diberikan
          // (§H.3, opsional, default server `true`) — sebelumnya tipe
          // punya tapi body tidak mengirimnya (operator selalu aktif).
          ...(data.is_active !== undefined ? { isActive: data.is_active } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'OPERATORS_CREATE',
        capability: 'operator.create',
        resourceId: data.operator_id,
      },
      mapOperator,
    );
  },

  async updateOperator(
    operatorId: string,
    patch: { name?: string; role?: UserRole; line_id?: string },
  ): Promise<Operator> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.OPERATORS_UPDATE.buildPath(operatorId),
        body: {
          ...(patch.name !== undefined ? { operatorName: patch.name } : {}),
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.line_id !== undefined ? { lineId: patch.line_id } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'OPERATORS_UPDATE',
        capability: 'operator.update',
        resourceId: operatorId,
      },
      mapOperator,
    );
  },

  async deleteOperator(operatorId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.OPERATORS_DELETE.buildPath(operatorId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'OPERATORS_DELETE',
      capability: 'operator.delete',
      resourceId: operatorId,
    });
    return { success: raw?.success ?? true };
  },

  async rotateOperatorPassword(operatorId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean; message?: string } | undefined>({
      method: 'PATCH',
      path: ADMIN_ENDPOINTS.OPERATORS_PASSWORD.buildPath(operatorId),
      body: { newPassword },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'OPERATORS_PASSWORD',
      capability: 'operator.password.rotate',
      resourceId: operatorId,
    });
    return { success: raw?.success ?? true, message: raw?.message ?? `Password untuk ${operatorId} berhasil dirotasi.` };
  },

  async toggleOperatorStatus(operatorId: string, isActive: boolean): Promise<Operator> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.OPERATORS_STATUS.buildPath(operatorId),
        body: { isActive },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'OPERATORS_STATUS',
        capability: 'operator.status.update',
        resourceId: operatorId,
      },
      mapOperator,
    );
  }
};
