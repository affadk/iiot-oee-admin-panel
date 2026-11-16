import { useEffect, useState } from 'react';
import type { IamRole, ScopeLevel } from '../../../types/iam';
import type { Operator } from '../../../types/production';
import type { AssignUserRolePayload } from '../hooks/useAssignments';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface AssignUserRoleModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  operators: Operator[];
  roles: IamRole[];
  defaultOperatorId: string;
  onClose: () => void;
  onSubmit: (payload: AssignUserRolePayload) => Promise<boolean>;
}

/**
 * Modal Tetapkan Peran ke Operator. Field form milik modal; default
 * operator (operator pertama) diterapkan hanya bila field masih kosong.
 * Sukses hanya membersihkan scopeId.
 */
export const AssignUserRoleModal: React.FC<AssignUserRoleModalProps> = ({
  isOpen,
  isSubmitting,
  operators,
  roles,
  defaultOperatorId,
  onClose,
  onSubmit,
}) => {
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [assignRoleName, setAssignRoleName] = useState('SUPERVISOR');
  const [assignScopeType, setAssignScopeType] = useState<ScopeLevel>('ORGANIZATION');
  const [assignScopeId, setAssignScopeId] = useState('');

  useEffect(() => {
    if (defaultOperatorId && !assignOperatorId) setAssignOperatorId(defaultOperatorId);
  }, [defaultOperatorId, assignOperatorId]);

  const submit = async () => {
    if (isSubmitting) return;
    const ok = await onSubmit({
      operatorId: assignOperatorId,
      roleName: assignRoleName,
      scopeType: assignScopeType,
      scopeId: assignScopeId,
    });
    if (ok) setAssignScopeId('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tetapkan Peran ke Operator"
      subtitle="Pilih operator, peran, dan area tugas yang diberikan."
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void submit()} isLoading={isSubmitting}>
            Simpan Assignment
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold mb-1">Operator</label>
          <select
            value={assignOperatorId}
            onChange={(e) => setAssignOperatorId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            {operators.map((op) => (
              <option key={op.operator_id} value={op.operator_id}>
                {op.operator_id} · {op.name} ({op.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Role</label>
          <select
            value={assignRoleName}
            onChange={(e) => setAssignRoleName(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name} (Level {r.privilege_level})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Scope Type</label>
          <select
            value={assignScopeType}
            onChange={(e) => setAssignScopeType(e.target.value as ScopeLevel)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            <option value="ORGANIZATION">ORGANIZATION (Global — Efektif di Admin Panel)</option>
            <option value="SITE">SITE (Persiapan)</option>
            <option value="AREA">AREA (Persiapan)</option>
            <option value="LINE">LINE (Persiapan)</option>
            <option value="MACHINE">MACHINE (Persiapan)</option>
            <option value="DEVICE">DEVICE (Persiapan)</option>
          </select>
        </div>
        {assignScopeType !== 'ORGANIZATION' && (
          <Input
            label="Scope ID"
            value={assignScopeId}
            onChange={(e) => setAssignScopeId(e.target.value)}
            placeholder="Contoh: LINE-01 atau CNC-MILLING-01"
            required
          />
        )}
      </form>
    </Modal>
  );
};
