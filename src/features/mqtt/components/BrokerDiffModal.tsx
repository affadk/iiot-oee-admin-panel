import type { BrokerDiffResult } from '../hooks/useBrokerConfig';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

interface BrokerDiffModalProps {
  diffResult: BrokerDiffResult | null;
  onClose: () => void;
}

export const BrokerDiffModal: React.FC<BrokerDiffModalProps> = ({ diffResult, onClose }) => {
  return (
    <Modal
      isOpen={Boolean(diffResult)}
      onClose={onClose}
      title={`Diff Konfigurasi: ${diffResult?.version_id ?? ''}`}
      footer={<Button onClick={onClose}>Tutup</Button>}
    >
      {diffResult && (
        <div className="space-y-3 text-xs">
          <p className="font-medium text-slate-800 dark:text-slate-200">{diffResult.diff_summary}</p>
          <div>
            <div className="text-slate-400 mb-1">Changed Schema Keys:</div>
            <div className="flex flex-wrap gap-1.5">
              {diffResult.changed_keys.map((k) => (
                <span key={k} className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 font-mono text-sky-800 dark:text-sky-300">
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
