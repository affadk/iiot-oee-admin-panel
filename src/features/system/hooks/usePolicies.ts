import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { IamPolicyRule } from '../../../types/iam';
import { parseAbacCondition } from '../iamValidation';
import type { IamMutationDeps } from '../accessControlTypes';

export interface CreatePolicyPayload {
  role: string;
  eft: 'ALLOW' | 'DENY';
  action: string;
  resource: string;
  abacJson: string;
  reason: string;
}

export interface UpdatePolicyPayload {
  eft: 'ALLOW' | 'DENY';
  action: string;
  resource: string;
  abacJson: string;
  reason: string;
}

/**
 * Create / Edit / Toggle / Delete policy.
 *
 * Field form tinggal di dalam modal masing-masing (CreatePolicyModal /
 * EditPolicyModal, termasuk select template `polTemplatePermId` yang live
 * sebagai controlled value); hook ini menyimpan flag buka + target dan
 * menyediakan aksi onSubmit(payload). editPolicyTarget ganda sebagai open
 * flag DAN target mutasi — jangan dipisah. Sukses create hanya
 * membersihkan abacJson/reason (dilakukan modal).
 */
export const usePolicies = ({ deps }: { deps: IamMutationDeps }) => {
  const { afterMutation, reportError, isSubmitting, setIsSubmitting, setFeedback } = deps;

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [editPolicyTarget, setEditPolicyTarget] = useState<IamPolicyRule | null>(null);
  const [deletePolicyTarget, setDeletePolicyTarget] = useState<IamPolicyRule | null>(null);

  const createPolicy = async (payload: CreatePolicyPayload): Promise<boolean> => {
    if (isSubmitting) return false;
    const parsed = parseAbacCondition(payload.abacJson);
    if (!parsed.ok) {
      setFeedback({ type: 'error', msg: parsed.error });
      return false;
    }
    setIsSubmitting(true);
    try {
      await apiClient.createIamPolicy({
        role: payload.role,
        eft: payload.eft,
        action: payload.action.trim(),
        resource_pattern: payload.resource.trim(),
        abac_condition: parsed.value,
        is_active: true,
        reason: payload.reason.trim() || undefined,
      });
      setIsPolicyModalOpen(false);
      await afterMutation(`Policy ${payload.eft} untuk ${payload.role} berhasil ditambahkan.`);
      return true;
    } catch (err: unknown) {
      reportError(err, 'Gagal membuat aturan hak akses.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePolicy = async (payload: UpdatePolicyPayload): Promise<boolean> => {
    if (!editPolicyTarget || isSubmitting) return false;
    const target = editPolicyTarget;
    const parsed = parseAbacCondition(payload.abacJson);
    if (!parsed.ok) {
      setFeedback({ type: 'error', msg: parsed.error });
      return false;
    }
    setIsSubmitting(true);
    try {
      await apiClient.updateIamPolicy(target.id, {
        eft: payload.eft,
        action: payload.action.trim(),
        resource_pattern: payload.resource.trim(),
        abac_condition: parsed.value,
        reason: payload.reason.trim() || undefined,
      });
      setEditPolicyTarget(null);
      await afterMutation(`Policy ${target.id} berhasil diperbarui.`);
      return true;
    } catch (err: unknown) {
      reportError(err, 'Gagal memperbarui aturan hak akses.', target.id);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePolicy = async (pol: IamPolicyRule) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.updateIamPolicy(pol.id, { is_active: !pol.is_active });
      await afterMutation(`Status policy ${pol.id} diubah menjadi ${!pol.is_active ? 'ACTIVE' : 'DISABLED'}.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal mengubah status policy.', pol.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeletePolicy = async () => {
    if (!deletePolicyTarget || isSubmitting) return;
    const target = deletePolicyTarget;
    setIsSubmitting(true);
    try {
      await apiClient.deleteIamPolicy(target.id);
      setDeletePolicyTarget(null);
      await afterMutation(`Policy ${target.id} dihapus.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal menghapus policy.', target.id);
      setDeletePolicyTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isPolicyModalOpen,
    openCreatePolicyModal: () => setIsPolicyModalOpen(true),
    closeCreatePolicyModal: () => setIsPolicyModalOpen(false),
    editPolicyTarget,
    openEditPolicyModal: (pol: IamPolicyRule) => setEditPolicyTarget(pol),
    closeEditPolicyModal: () => setEditPolicyTarget(null),
    deletePolicyTarget,
    requestDeletePolicy: (pol: IamPolicyRule) => setDeletePolicyTarget(pol),
    closeDeletePolicy: () => setDeletePolicyTarget(null),
    createPolicy,
    updatePolicy,
    handleTogglePolicy,
    confirmDeletePolicy,
  };
};
