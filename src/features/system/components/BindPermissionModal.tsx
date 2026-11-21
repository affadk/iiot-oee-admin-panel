import { useMemo } from 'react';
import { FileCode2 } from 'lucide-react';
import type { IamPermission, IamRole } from '../../../types/iam';
import { isReservedPermission } from '../../../utils/capabilities';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

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
        <Select
          label="Target Role"
          value={bindRoleId}
          onChange={(e) => onRoleIdChange(e.target.value)}
          disabled={bindLockedMode === 'role'}
          options={roles.map((r) => { const blocked =
                selectedPerm && !r.is_system && isReservedPermission(selectedPerm.action, selectedPerm.resourceType);  return ({ value: r.id, label: `${r.name} ${blocked ? '(DIBLOKIR - RESERVED)' : ''}`, disabled: Boolean(blocked) }); })}
        />

        <Select
          label="Permission Sistem (Fixed Catalog)"
          value={selectedPermId}
          onChange={(e) => onPermIdChange(e.target.value)}
          disabled={bindLockedMode === 'permission'}
          options={permissions.map((p) => { const blocked =
                selectedRole && !selectedRole.is_system && isReservedPermission(p.action, p.resourceType);  return ({ value: p.id, label: `${p.action}:${p.resourceType} ${blocked ? '(RESERVED - BLOCKED)' : `— ${p.description}`}`, disabled: Boolean(blocked) }); })}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Effect"
            value={bindEffect}
            onChange={(e) => onEffectChange(e.target.value as 'ALLOW' | 'DENY')}
            options={[{ value: 'ALLOW', label: 'ALLOW' }, { value: 'DENY', label: `DENY ${isAdminRole ? '(Diblokir untuk ADMIN)' : ''}`, disabled: isAdminRole }]}
          />
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
            placeholder='{"attr": "subject.line_id", "eq": "LINE-01"}'
            className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
      </form>
    </Modal>
  );
};
