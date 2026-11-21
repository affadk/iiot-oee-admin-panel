import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { IamAssignment, ScopeLevel } from '../../../types/iam';
import { ApiError } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { FeedbackState } from './useOperators';

export interface AssignRoleInput {
  roleName: string;
  scopeType: ScopeLevel;
  scopeId: string;
}

export interface UseOperatorRoleAssignmentOptions {
  loadOperators: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  refreshCapabilities: () => Promise<void>;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
}

/**
 * Penugasan/pencabutan role IAM (R9.5, dipindah dari OperatorsPage L286–342).
 * Lock assign milik detail modal (form-nya di sana); hook hanya menjalankan
 * API + reload + refreshCapabilities + feedback, lalu melempar ulang agar
 * modal menampilkan submit error (preseden useDevices).
 */
export function useOperatorRoleAssignment({
  loadOperators,
  reportForbidden,
  refreshCapabilities,
  setFeedback,
}: UseOperatorRoleAssignmentOptions) {
  const [isRevokingRole, setIsRevokingRole] = useState(false);

  const assignRole = async (operatorId: string, input: AssignRoleInput): Promise<void> => {
    setFeedback(null);
    try {
      await apiClient.assignIamUserRole({
        operatorId,
        roleName: input.roleName,
        scopeType: input.scopeType,
        scopeId: input.scopeType === 'ORGANIZATION' ? null : input.scopeId.trim(),
      });
      await loadOperators();
      await refreshCapabilities();
      setFeedback({ type: 'success', msg: `Role ${input.roleName} berhasil ditugaskan ke ${operatorId}.` });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('access_control.manage', operatorId, err.message);
      }
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menugaskan role.' });
      throw err;
    }
  };

  const revokeRole = async (target: IamAssignment): Promise<void> => {
    if (isRevokingRole) return;
    setIsRevokingRole(true);
    setFeedback(null);
    try {
      await apiClient.revokeIamUserRole({
        id: target.id,
        operatorId: target.operator_id,
        roleName: target.role_name,
        scopeType: target.scope_type,
        scopeId: target.scope_id,
      });
      await loadOperators();
      await refreshCapabilities();
      setFeedback({ type: 'success', msg: `Role ${target.role_name} dicabut dari ${target.operator_id}.` });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('access_control.manage', target.operator_id, err.message);
      }
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal mencabut role.' });
    } finally {
      setIsRevokingRole(false);
    }
  };

  return { assignRole, revokeRole, isRevokingRole };
}
