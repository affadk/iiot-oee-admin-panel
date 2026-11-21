import React, { useEffect, useState } from 'react';
import { Station } from '../../../types/assets';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

export interface StationRevokeDialogProps {
  target: Station | null;
  isRevoking: boolean;
  onClose: () => void;
  /** Dipanggil dengan reason 1..200; throw bila server menolak (mis. sudah REVOKED). */
  onConfirm: (reason: string) => Promise<void>;
}

export const StationRevokeDialog: React.FC<StationRevokeDialogProps> = ({
  target,
  isRevoking,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setReason('');
      setError(null);
    }
  }, [target]);

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 1 || trimmed.length > 200) {
      setError('Alasan wajib 1–200 karakter.');
      return;
    }
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err: any) {
      setError(err?.message || 'Gagal menonaktifkan stasiun.');
    }
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Nonaktifkan Stasiun ${target?.device_id ?? ''}?`}
      subtitle="Menonaktifkan = revoke: enrollment menjadi REVOKED dan kiosk dengan station ini tidak bisa login lagi. Tindakan ini SATU ARAH — tidak ada un-revoke lewat API."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isRevoking}>
            Batal
          </Button>
          <Button variant="danger" onClick={() => void handleConfirm()} isLoading={isRevoking}>
            Ya, Nonaktifkan Stasiun
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {error}
          </div>
        )}
        <Input
          label="Alasan penonaktifan (wajib, 1–200 karakter)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Mis. kiosk dipindah / tidak dipakai lagi"
          maxLength={200}
          error={error ?? undefined}
        />
      </div>
    </Modal>
  );
};
