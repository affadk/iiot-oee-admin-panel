import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { IamAssignment, ScopeLevel } from '../../../types/iam';
import type { Operator } from '../../../types/production';
import type { IamMutationDeps } from '../accessControlTypes';

export interface AssignUserRolePayload {
  operatorId: string;
  roleName: string;
  scopeType: ScopeLevel;
  scopeId: string;
}

/**
 * Assign / Revoke user-role.
 *
 * Field form tinggal di dalam AssignUserRoleModal; hook ini menyimpan flag
 * buka + target revoke dan menyediakan aksi onSubmit(payload). Default
 * operator = operator pertama (dulu di-set loader via prev || first) —
 * dihitung di sini sebagai defaultOperatorId dan diterapkan modal hanya
 * bila field-nya masih kosong, supaya reload tidak me-reset pilihan user.
 * Sukses assign hanya membersihkan scopeId (dilakukan modal).
 */
export const useAssignments = ({
  operators,
  deps,
}: {
  operators: Operator[];
  deps: IamMutationDeps;
}) => {
  const { afterMutation, reportError, isSubmitting, setIsSubmitting, setFeedback } = deps;

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<IamAssignment | null>(null);

  const defaultOperatorId = operators[0]?.operator_id ?? '';

  const assignUserRole = async (payload: AssignUserRolePayload): Promise<boolean> => {
    if (isSubmitting) return false;
    if (payload.scopeType !== 'ORGANIZATION' && !payload.scopeId.trim()) {
      setFeedback({ type: 'error', msg: 'Scope ID wajib diisi untuk scope selain ORGANIZATION.' });
      return false;
    }
    setIsSubmitting(true);
    try {
      await apiClient.assignIamUserRole({
        operatorId: payload.operatorId,
        roleName: payload.roleName,
        scopeType: payload.scopeType,
        scopeId: payload.scopeType === 'ORGANIZATION' ? null : payload.scopeId.trim(),
      });
      setIsAssignModalOpen(false);
      await afterMutation(`Role ${payload.roleName} berhasil di-assign ke ${payload.operatorId}.`);
      return true;
    } catch (err: unknown) {
      reportError(err, 'Gagal assign user role.', payload.operatorId);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmRevokeAssignment = async () => {
    if (!revokeTarget || isSubmitting) return;
    const target = revokeTarget;
    setIsSubmitting(true);
    try {
      await apiClient.revokeIamUserRole({
        id: target.id,
        operatorId: target.operator_id,
        roleName: target.role_name,
        scopeType: target.scope_type,
        scopeId: target.scope_id,
      });
      setRevokeTarget(null);
      await afterMutation(`Assignment ${target.role_name} pada ${target.operator_id} berhasil dicabut.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal mencabut assignment.', target.operator_id);
      setRevokeTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isAssignModalOpen,
    openAssignModal: () => setIsAssignModalOpen(true),
    closeAssignModal: () => setIsAssignModalOpen(false),
    defaultOperatorId,
    revokeTarget,
    requestRevoke: (assignment: IamAssignment) => setRevokeTarget(assignment),
    closeRevoke: () => setRevokeTarget(null),
    assignUserRole,
    confirmRevokeAssignment,
  };
};
