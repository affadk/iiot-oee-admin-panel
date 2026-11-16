import React, { useEffect, useState } from 'react';
import { Operator } from '../../../types/production';
import { UserRole } from '../../../types/auth';
import { isProtectedOperator, validateOperatorInput } from '../../../utils/capabilities';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { UpdateOperatorInput } from '../hooks/useOperatorCrud';
import { ALL_ROLES } from '../hooks/useOperators';

export interface OperatorEditModalProps {
  operator: Operator | null;
  onClose: () => void;
  onSubmit: (operatorId: string, input: UpdateOperatorInput) => Promise<void>;
}

/**
 * Modal edit operator (R9.5, dipindah dari OperatorsPage L896–948).
 * Form state lokal, diinisialisasi dari prop `operator` tiap target berganti.
 */
export const OperatorEditModal: React.FC<OperatorEditModalProps> = ({ operator, onClose, onSubmit }) => {
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('OPERATOR');
  const [editLineId, setEditLineId] = useState('LINE-01');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (operator) {
      setEditName(operator.name);
      setEditRole(operator.role);
      setEditLineId(operator.line_id);
      setEditErrors({});
      setSubmitError(null);
    }
  }, [operator]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!operator || isEditing) return;
    const errs = validateOperatorInput({
      operatorName: editName,
      lineId: editLineId,
      isCreate: false,
    });
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setIsEditing(true);
    setSubmitError(null);
    try {
      await onSubmit(operator.operator_id, { name: editName, role: editRole, lineId: editLineId });
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal memperbarui profil operator.');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(operator)}
      onClose={() => !isEditing && onClose()}
      title={`Edit Operator ${operator?.operator_id ?? ''}`}
      subtitle="Perubahan data akun hanya tersedia untuk Admin dari jaringan lokal pabrik. Custom multi-role dikelola via Detail / Access Control."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isEditing}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isEditing}>
            Simpan Perubahan
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
          label="Nama Lengkap"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          error={editErrors.operatorName}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-operator-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Peran Sistem (Primary Role)
            </label>
            <select
              id="edit-operator-role"
              value={editRole}
              disabled={Boolean(operator && isProtectedOperator(operator))}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Line ID"
            value={editLineId}
            onChange={(e) => setEditLineId(e.target.value.toUpperCase())}
            error={editErrors.lineId}
          />
        </div>
      </form>
    </Modal>
  );
};
