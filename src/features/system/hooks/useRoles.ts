import { useMemo, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { IamRole } from '../../../types/iam';
import type { IamMutationDeps } from '../accessControlTypes';

export interface CreateRolePayload {
  name: string;
  level: number;
  description: string;
}

export interface UpdateRolePayload {
  level: number;
  description: string;
}

/**
 * Create / Edit / Delete custom role + modal Detail.
 *
 * Field form (nama/level/deskripsi) + error validasi field tinggal di dalam
 * modal masing-masing; hook ini hanya menyimpan flag buka + target dan
 * menyediakan aksi onSubmit(payload) yang mengembalikan true bila sukses.
 * Reset field saat sukses (create: nama/deskripsi/level 25) dilakukan modal;
 * update TIDAK me-reset — modal menutup via target di-null-kan.
 * editRoleTarget ganda sebagai open flag DAN target mutasi — jangan dipisah.
 */
export const useRoles = ({ roles, deps }: { roles: IamRole[]; deps: IamMutationDeps }) => {
  const { afterMutation, reportError, isSubmitting, setIsSubmitting, setFeedback } = deps;

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState<IamRole | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<IamRole | null>(null);
  const [detailRoleId, setDetailRoleId] = useState<string | null>(null);

  const detailRole = useMemo(
    () => (detailRoleId ? roles.find((r) => r.id === detailRoleId) ?? null : null),
    [detailRoleId, roles],
  );

  const createRole = async (payload: CreateRolePayload): Promise<boolean> => {
    if (isSubmitting) return false;
    setIsSubmitting(true);
    try {
      const created = await apiClient.createIamRole({
        name: payload.name,
        privilege_level: payload.level,
        description: payload.description,
      });
      setIsRoleModalOpen(false);
      await afterMutation(`Custom role "${created.name}" berhasil dibuat.`);
      return true;
    } catch (err: unknown) {
      reportError(err, 'Gagal membuat custom role.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRole = async (payload: UpdateRolePayload): Promise<boolean> => {
    if (!editRoleTarget || isSubmitting) return false;
    const target = editRoleTarget;
    if (target.is_system) {
      setFeedback({ type: 'error', msg: 'Role sistem dilindungi dan tidak dapat diubah.' });
      return false;
    }
    setIsSubmitting(true);
    try {
      const updated = await apiClient.updateIamRole(target.id, {
        description: payload.description,
        privilege_level: payload.level,
      });
      setEditRoleTarget(null);
      await afterMutation(`Role "${updated.name}" berhasil diperbarui.`, false);
      return true;
    } catch (err: unknown) {
      reportError(err, 'Gagal memperbarui role.', target.id);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteRole = async (): Promise<void> => {
    if (!deleteRoleTarget || isSubmitting) return;
    const target = deleteRoleTarget;
    setIsSubmitting(true);
    try {
      await apiClient.deleteIamRole(target.id);
      // Cross-clear: role yang dihapus adalah detail yang sedang terbuka.
      if (detailRoleId === target.id) setDetailRoleId(null);
      setDeleteRoleTarget(null);
      await afterMutation(`Role "${target.name}" berhasil dihapus.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal menghapus role.', target.id);
      setDeleteRoleTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isRoleModalOpen,
    openCreateRole: () => setIsRoleModalOpen(true),
    closeCreateRole: () => setIsRoleModalOpen(false),
    editRoleTarget,
    openEditRole: (role: IamRole) => setEditRoleTarget(role),
    closeEditRole: () => setEditRoleTarget(null),
    deleteRoleTarget,
    requestDeleteRole: (role: IamRole) => setDeleteRoleTarget(role),
    closeDeleteRole: () => setDeleteRoleTarget(null),
    detailRoleId,
    detailRole,
    openDetail: (roleId: string) => setDetailRoleId(roleId),
    closeDetail: () => setDetailRoleId(null),
    createRole,
    updateRole,
    confirmDeleteRole,
  };
};
