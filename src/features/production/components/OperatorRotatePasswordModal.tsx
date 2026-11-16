import React, { useEffect, useState } from 'react';
import { Operator } from '../../../types/production';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

export interface OperatorRotatePasswordModalProps {
  operator: Operator | null;
  onClose: () => void;
  onSubmit: (operatorId: string, newPassword: string) => Promise<void>;
}

/**
 * Modal rotasi password (R9.5, dipindah dari OperatorsPage L950–977).
 * Validasi panjang 8–128 karakter inline di modal, bukan via
 * validateOperatorInput (perilaku asli L232–235).
 */
export const OperatorRotatePasswordModal: React.FC<OperatorRotatePasswordModalProps> = ({
  operator,
  onClose,
  onSubmit,
}) => {
  const [newPwdValue, setNewPwdValue] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (operator) {
      setNewPwdValue('');
      setSubmitError(null);
    }
  }, [operator]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!operator || isRotating) return;
    if (newPwdValue.length < 8 || newPwdValue.length > 128) {
      setSubmitError('Password baru wajib 8–128 karakter.');
      return;
    }
    setIsRotating(true);
    setSubmitError(null);
    try {
      await onSubmit(operator.operator_id, newPwdValue);
      setNewPwdValue('');
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal merotasi password.');
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(operator)}
      onClose={() => !isRotating && onClose()}
      title={`Rotasi Password ${operator?.operator_id ?? ''}`}
      subtitle="Pengaturan ulang kata sandi hanya tersedia untuk Admin dari jaringan lokal pabrik."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isRotating}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isRotating}>
            Simpan Password Baru
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
          label="Password Baru (8–128 karakter)"
          type="password"
          value={newPwdValue}
          onChange={(e) => setNewPwdValue(e.target.value)}
          placeholder="Masukkan password baru yang kuat"
          required
        />
      </form>
    </Modal>
  );
};
