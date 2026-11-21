import type { BrokerConfirmAction } from '../hooks/useBrokerConfig';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface BrokerConfirmModalProps {
  confirmAction: BrokerConfirmAction | null;
  onClose: () => void;
  confirmReason: string;
  onReasonChange: (value: string) => void;
  confirmCheckbox: boolean;
  onCheckboxChange: (checked: boolean) => void;
  onExecute: () => void;
  isWorking: boolean;
}

export const BrokerConfirmModal: React.FC<BrokerConfirmModalProps> = ({
  confirmAction,
  onClose,
  confirmReason,
  onReasonChange,
  confirmCheckbox,
  onCheckboxChange,
  onExecute,
  isWorking,
}) => {
  return (
    <Modal
      isOpen={Boolean(confirmAction)}
      onClose={onClose}
      title={
        confirmAction
          ? `${confirmAction.type === 'APPLY' ? 'Apply' : 'Rollback'} Versi ${confirmAction.version.version_id}`
          : 'Konfirmasi Broker Operation'
      }
      subtitle="Harap centang konfirmasi persetujuan dan tuliskan alasan perubahan (maksimal 500 karakter)."
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isWorking}>
            Batal
          </Button>
          <Button
            variant="danger"
            disabled={!confirmCheckbox}
            isLoading={isWorking}
            onClick={onExecute}
          >
            Eksekusi {confirmAction?.type}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
          Operasi ini akan memuat ulang layanan komunikasi mesin dan membuat cadangan otomatis sebelumnya.
        </div>
        <Input
          label="Alasan Perubahan (maks 500 karakter)"
          value={confirmReason}
          onChange={(e) => onReasonChange(e.target.value)}
          maxLength={500}
          required
        />
        <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={confirmCheckbox}
            onChange={(e) => onCheckboxChange(e.target.checked)}
            className="mt-0.5"
          />
          <span>Saya menyetujui dan mengonfirmasi penerapan perubahan pengaturan koneksi ini.</span>
        </label>
      </div>
    </Modal>
  );
};
