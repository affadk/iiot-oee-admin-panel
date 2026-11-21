import { useEffect, useState } from 'react';
import type { IamRole, ScopeLevel } from '../../../types/iam';
import type { Operator } from '../../../types/production';
import type { AssignUserRolePayload } from '../hooks/useAssignments';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

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
        <Select
          label="Operator"
          value={assignOperatorId}
          onChange={(e) => setAssignOperatorId(e.target.value)}
          options={operators.map((op) => ({ value: op.operator_id, label: `${op.operator_id} · ${op.name} (${op.role})` }))}
        />
        <Select
          label="Role"
          value={assignRoleName}
          onChange={(e) => setAssignRoleName(e.target.value)}
          options={roles.map((r) => ({ value: r.name, label: r.name }))}
        />
        <Select
          label="Scope Type"
          value={assignScopeType}
          onChange={(e) => setAssignScopeType(e.target.value as ScopeLevel)}
          options={[{ value: 'ORGANIZATION', label: 'ORGANIZATION (Global — Efektif di Admin Panel)' }, { value: 'SITE', label: 'SITE (Persiapan)' }, { value: 'AREA', label: 'AREA (Persiapan)' }, { value: 'LINE', label: 'LINE (Persiapan)' }, { value: 'MACHINE', label: 'MACHINE (Persiapan)' }, { value: 'DEVICE', label: 'DEVICE (Persiapan)' }]}
        />
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
