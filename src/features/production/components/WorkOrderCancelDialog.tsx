import React from 'react';
import { WorkOrder } from '../../../types/production';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { Input } from '../../../components/ui/Input';

interface WorkOrderCancelDialogProps {
  cancelTarget: WorkOrder | null;
  cancelReason: string;
  onCancelReasonChange: (value: string) => void;
  isCancelling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const WorkOrderCancelDialog: React.FC<WorkOrderCancelDialogProps> = ({
  cancelTarget,
  cancelReason,
  onCancelReasonChange,
  isCancelling,
  onConfirm,
  onClose,
}) => {
  return (
    <ConfirmationDialog
      isOpen={Boolean(cancelTarget)}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Batalkan Work Order ${cancelTarget?.wo_id ?? ''}?`}
      variant="destructive"
      description={`Aksi ini akan membatalkan Work Order ${cancelTarget?.wo_id} (status menjadi Dibatalkan / ABORTED) dan membebaskan mesin terkait agar dapat digunakan kembali.`}
      impacts={[
        'Hanya dapat dilakukan oleh ADMIN dari jaringan lokal pabrik.',
        'Work Order yang sudah selesai atau dibatalkan tidak dapat dibatalkan ulang.',
      ]}
      confirmLabel="Ya, Batalkan WO"
      isLoading={isCancelling}
    >
      <Input
        label="Alasan Pembatalan (Opsional, maks 500 karakter)"
        value={cancelReason}
        onChange={(e) => onCancelReasonChange(e.target.value)}
        placeholder="Contoh: Revisi jadwal material dari PPIC"
        maxLength={500}
      />
    </ConfirmationDialog>
  );
};
