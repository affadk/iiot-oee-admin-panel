import React, { useEffect, useState } from 'react';
import { UserRole } from '../../../types/auth';
import { validateOperatorInput } from '../../../utils/capabilities';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { CreateOperatorInput } from '../hooks/useOperatorCrud';

export interface OperatorCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignableRoles: UserRole[];
  onSubmit: (input: CreateOperatorInput) => Promise<void>;
}

/**
 * Modal create operator (R9.5, dipindah dari OperatorsPage L824–894).
 * Form state lokal; membuka modal me-reset form dan mem-preset role ke
 * `assignableRoles[last]` (dulu preset opener L398).
 */
export const OperatorCreateModal: React.FC<OperatorCreateModalProps> = ({
  isOpen,
  onClose,
  assignableRoles,
  onSubmit,
}) => {
  const [newOpId, setNewOpId] = useState('OP-');
  const [newOpName, setNewOpName] = useState('');
  const [newOpRole, setNewOpRole] = useState<UserRole>('UNASSIGNED');
  const [newOpLineId, setNewOpLineId] = useState('');
  const [newOpPassword, setNewOpPassword] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewOpId('OP-');
      setNewOpName('');
      setNewOpRole('UNASSIGNED');
      setNewOpLineId('');
      setNewOpPassword('');
      setCreateErrors({});
      setSubmitError(null);
    }
  }, [isOpen, assignableRoles]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isCreating) return;
    const errs = validateOperatorInput({
      operatorId: newOpId,
      operatorName: newOpName,
      lineId: newOpLineId,
      password: newOpPassword,
      isCreate: true,
    });
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setIsCreating(true);
    setSubmitError(null);
    try {
      await onSubmit({
        operatorId: newOpId,
        name: newOpName,
        role: newOpRole,
        lineId: newOpLineId,
        password: newOpPassword,
      });
      setNewOpId('OP-');
      setNewOpName('');
      setNewOpPassword('');
      setCreateErrors({});
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal membuat akun operator.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isCreating && onClose()}
      title="Tambah Akun Operator Baru"
      subtitle="Kata sandi awal minimal 8 karakter."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isCreating}>
            Buat Akun Operator
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div
            role="alert"
            className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200"
          >
            {submitError}
          </div>
        )}
        <Input
          label="Operator ID"
          value={newOpId}
          onChange={(e) => setNewOpId(e.target.value.toUpperCase())}
          placeholder="OP-042"
          error={createErrors.operatorId}
          required
        />
        <Input
          label="Nama Lengkap"
          value={newOpName}
          onChange={(e) => setNewOpName(e.target.value)}
          placeholder="Contoh: Budi Santoso"
          error={createErrors.operatorName}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            id="create-operator-role"
            label="Peran Awal"
            value={newOpRole}
            onChange={(e) => setNewOpRole(e.target.value as UserRole)}
            options={['UNASSIGNED', ...assignableRoles.filter((r) => r !== 'UNASSIGNED')].map((r) => ({ value: r, label: r }))}
          />
          <Input
            label="Line ID"
            value={newOpLineId}
            onChange={(e) => setNewOpLineId(e.target.value.toUpperCase())}
            placeholder="LINE-01"
            error={createErrors.lineId}
          />
        </div>
        <Input
          label="Password Awal (8–128 karakter)"
          type="password"
          value={newOpPassword}
          onChange={(e) => setNewOpPassword(e.target.value)}
          placeholder="Minimal 8 karakter"
          error={createErrors.password}
          required
        />
      </form>
    </Modal>
  );
};
