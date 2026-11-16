import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { IamPermission, IamRole } from '../../../types/iam';
import { isReservedPermission } from '../../../utils/capabilities';
import { parseAbacCondition } from '../iamValidation';
import type { IamMutationDeps, UnbindTarget } from '../accessControlTypes';

/**
 * Bind / Unbind permission ke role.
 *
 * PENGECUALIAN pola form-di-modal: kedelapan state Bind + kedua opener
 * HARUS tinggal bersama dalam satu hook ini. `bindLockedMode` + prefill
 * kedua opener adalah satu state machine dual-entry — memecahnya (opener
 * di hook, field di modal, atau dua hook) akan men-desync sisi yang
 * terkunci dari nilai prefill-nya (bug desync, R9.5 §6.4).
 *
 * Default selectedPermId = permission pertama, hanya bila kosong
 * (prev || first) — dulu di loadIamData, kini via useEffect atas
 * permissions; pilihan user yang sedang berjalan tidak pernah di-reset
 * saat reload.
 */
export const useRolePermissions = ({
  roles,
  permissions,
  deps,
}: {
  roles: IamRole[];
  permissions: IamPermission[];
  deps: IamMutationDeps;
}) => {
  const { afterMutation, reportError, isSubmitting, setIsSubmitting, setFeedback } = deps;

  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [bindLockedMode, setBindLockedMode] = useState<'role' | 'permission' | null>(null);
  const [bindRoleId, setBindRoleId] = useState('');
  const [selectedPermId, setSelectedPermId] = useState('');
  const [bindResourcePattern, setBindResourcePattern] = useState('');
  const [bindEffect, setBindEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [bindAbacJson, setBindAbacJson] = useState('');
  const [bindReason, setBindReason] = useState('');
  const [unbindTarget, setUnbindTarget] = useState<UnbindTarget | null>(null);

  useEffect(() => {
    if (permissions.length > 0) {
      setSelectedPermId((prev) => prev || permissions[0].id);
    }
  }, [permissions]);

  const openBindFromRole = (role: IamRole, preselectedPerm?: IamPermission) => {
    const defaultPerm =
      preselectedPerm ||
      permissions.find((p) => role.is_system || !isReservedPermission(p.action, p.resource_type)) ||
      permissions[0];
    setBindLockedMode('role');
    setBindRoleId(role.id);
    setSelectedPermId(defaultPerm?.id ?? '');
    setBindResourcePattern(defaultPerm ? `${defaultPerm.resource_type}:*` : '*');
    setBindEffect('ALLOW');
    setBindAbacJson('');
    setBindReason('');
    setIsBindModalOpen(true);
  };

  const openAssignFromPermission = (perm: IamPermission) => {
    const reserved = isReservedPermission(perm.action, perm.resource_type);
    const defaultRole =
      (reserved
        ? roles.find((r) => r.name === 'SUPERVISOR') || roles.find((r) => r.is_system)
        : roles.find((r) => r.name === 'QUALITY_AUDITOR') || roles.find((r) => r.name !== 'ADMIN')) || roles[0];
    setBindLockedMode('permission');
    setSelectedPermId(perm.id);
    setBindRoleId(defaultRole?.id ?? '');
    setBindResourcePattern(`${perm.resource_type}:*`);
    setBindEffect('ALLOW');
    setBindAbacJson('');
    setBindReason('');
    setIsBindModalOpen(true);
  };

  const changeBindRoleId = (nextRoleId: string) => {
    setBindRoleId(nextRoleId);
    const nextRole = roles.find((r) => r.id === nextRoleId);
    if (nextRole?.name === 'ADMIN') {
      setBindEffect('ALLOW');
    }
  };

  const changeSelectedPermId = (nextPermId: string) => {
    setSelectedPermId(nextPermId);
    const nextPerm = permissions.find((p) => p.id === nextPermId);
    if (nextPerm) {
      setBindResourcePattern(`${nextPerm.resource_type}:*`);
    }
  };

  const handleBindPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const role = roles.find((r) => r.id === bindRoleId);
    const perm = permissions.find((p) => p.id === selectedPermId);
    if (!role || !perm) {
      setFeedback({ type: 'error', msg: 'Pilih role dan permission terlebih dahulu.' });
      return;
    }
    if (!role.is_system && isReservedPermission(perm.action, perm.resource_type)) {
      setFeedback({
        type: 'error',
        msg: `Permission "${perm.action}:${perm.resource_type}" adalah reserved permission dan diblokir untuk custom role.`,
      });
      return;
    }
    // Guard anti-lockout ADMIN (handler) — defence-in-depth bersama hint UI di modal.
    if (role.name === 'ADMIN' && bindEffect === 'DENY') {
      setFeedback({
        type: 'error',
        msg: 'Anti-Lockout Guard: Policy DENY pada role ADMIN dilarang.',
      });
      return;
    }
    const pattern = bindResourcePattern.trim() || `${perm.resource_type}:*`;
    if (!role.is_system && bindEffect === 'ALLOW' && (pattern === '*' || pattern === 'org:*')) {
      setFeedback({
        type: 'error',
        msg: 'Custom role tidak boleh diberikan wildcard resource pattern (*).',
      });
      return;
    }
    const parsedAbac = parseAbacCondition(bindAbacJson);
    if (!parsedAbac.ok) {
      setFeedback({ type: 'error', msg: parsedAbac.error });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.addIamRolePermission(role.id, perm.id, {
        resourcePattern: pattern,
        effect: bindEffect,
        abacCondition: parsedAbac.value,
        reason: bindReason.trim() || undefined,
      });
      setIsBindModalOpen(false);
      await afterMutation(
        `Permission ${perm.action}:${perm.resource_type} (${bindEffect} · ${pattern}) berhasil di-assign ke role ${role.name}.`,
      );
    } catch (err: unknown) {
      reportError(err, 'Gagal meng-assign permission ke role.', role.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmUnbindPermission = async () => {
    if (!unbindTarget || isSubmitting) return;
    const target = unbindTarget;
    setIsSubmitting(true);
    try {
      await apiClient.removeIamRolePermission(target.role.id, target.permissionId);
      setUnbindTarget(null);
      await afterMutation(`Permission "${target.label}" dilepas dari role ${target.role.name}.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal melepas permission dari role.', target.role.id);
      setUnbindTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isBindModalOpen,
    closeBindModal: () => setIsBindModalOpen(false),
    bindLockedMode,
    bindRoleId,
    selectedPermId,
    bindResourcePattern,
    setBindResourcePattern,
    bindEffect,
    setBindEffect,
    bindAbacJson,
    setBindAbacJson,
    bindReason,
    setBindReason,
    unbindTarget,
    requestUnbind: (role: IamRole, permissionId: string, label: string) =>
      setUnbindTarget({ role, permissionId, label }),
    closeUnbind: () => setUnbindTarget(null),
    openBindFromRole,
    openAssignFromPermission,
    changeBindRoleId,
    changeSelectedPermId,
    handleBindPermission,
    confirmUnbindPermission,
  };
};
