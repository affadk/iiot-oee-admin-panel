import { useMemo } from 'react';
import { FileCode2 } from 'lucide-react';
import type { IamPermission, IamRole } from '../../../types/iam';
import { isReservedPermission } from '../../../utils/capabilities';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface BindPermissionModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  roles: IamRole[];
  permissions: IamPermission[];
  bindLockedMode: 'role' | 'permission' | null;
  bindRoleId: string;
  selectedPermId: string;
  bindResourcePattern: string;
  bindEffect: 'ALLOW' | 'DENY';
  bindAbacJson: string;
  onClose: () => void;
  onRoleIdChange: (roleId: string) => void;
  onPermIdChange: (permId: string) => void;
  onResourcePatternChange: (value: string) => void;
  onEffectChange: (effect: 'ALLOW' | 'DENY') => void;
  onAbacJsonChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

/**
 * Modal Assign / Bind Permission to Role. Form state tinggal di hook
 * useRolePermissions (pengecualian pola form-di-modal — lihat hook).
 * `bindLockedMode === null` = kedua select enabled. Hint DENY-diblokir
 * untuk ADMIN di sini adalah defence-in-depth bersama guard handler.
 */
export const BindPermissionModal: React.FC<BindPermissionModalProps> = ({
  isOpen,
  isSubmitting,
  roles,
  permissions,
  bindLockedMode,
  bindRoleId,
  selectedPermId,
  bindResourcePattern,
  bindEffect,
  bindAbacJson,
  onClose,
  onRoleIdChange,
  onPermIdChange,
  onResourcePatternChange,
  onEffectChange,
  onAbacJsonChange,
  onSubmit,
}) => {
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === bindRoleId) ?? null,
    [roles, bindRoleId],
  );
  const selectedPerm = useMemo(
    () => permissions.find((p) => p.id === selectedPermId) ?? null,
    [permissions, selectedPermId],
  );
  const isAdminRole = selectedRole?.name === 'ADMIN';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        bindLockedMode === 'permission' && selectedPerm
          ? `Assign Permission ${selectedPerm.action}:${selectedPerm.resourceType} ke Role`
          : `Assign Permission ke Role ${selectedRole?.name ?? ''}`
      }
      subtitle="Tetapkan izin dari katalog sistem ke peran target beserta pola resource dan syarat ABAC (opsional)."
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={onSubmit} isLoading={isSubmitting}>
            Assign Permission
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Target Role
          </label>
          <select
            value={bindRoleId}
            disabled={bindLockedMode === 'role'}
            onChange={(e) => onRoleIdChange(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 disabled:opacity-60"
          >
            {roles.map((r) => {
              const blocked =
                selectedPerm && !r.is_system && isReservedPermission(selectedPerm.action, selectedPerm.resourceType);
              return (
                <option key={r.id} value={r.id} disabled={Boolean(blocked)}>
                  {r.name} {blocked ? '(DIBLOKIR - RESERVED)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Permission Sistem (Fixed Catalog)
          </label>
          <select
            value={selectedPermId}
            disabled={bindLockedMode === 'permission'}
            onChange={(e) => onPermIdChange(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 disabled:opacity-60"
          >
            {permissions.map((p) => {
              const blocked =
                selectedRole && !selectedRole.is_system && isReservedPermission(p.action, p.resourceType);
              return (
                <option key={p.id} value={p.id} disabled={Boolean(blocked)}>
                  {p.action}:{p.resourceType} {blocked ? '(RESERVED - BLOCKED)' : `— ${p.description}`}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Effect
            </label>
            <select
              value={bindEffect}
              onChange={(e) => onEffectChange(e.target.value as 'ALLOW' | 'DENY')}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="ALLOW">ALLOW</option>
              <option value="DENY" disabled={isAdminRole}>
                DENY {isAdminRole ? '(Diblokir untuk ADMIN)' : ''}
              </option>
            </select>
          </div>
          <Input
            label="Resource Pattern"
            value={bindResourcePattern}
            onChange={(e) => onResourcePatternChange(e.target.value)}
            placeholder={selectedPerm ? `${selectedPerm.resourceType}:*` : 'telemetry:*'}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
            <FileCode2 className="w-3.5 h-3.5" /> Syarat Kondisi ABAC JSON (Opsional)
          </label>
          <textarea
            rows={2}
            value={bindAbacJson}
            onChange={(e) => onAbacJsonChange(e.target.value)}
            placeholder='{"line_id": "LINE-01"}'
            className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
      </form>
    </Modal>
  );
};
