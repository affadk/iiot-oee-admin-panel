import type { BrokerConfigDiffResult } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

interface BrokerDiffModalProps {
  diffResult: BrokerConfigDiffResult | null;
  onClose: () => void;
}

/**
 * E23 Batch 1 (FAT-182, N-13): merender `lines[]` spec live
 * (`context`/`add`/`remove` + nomor baris lama/baru), bukan
 * `diff_summary`/`changed_keys` yang tidak ada di spec.
 */
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
          <p className="text-slate-500">
            Base: <span className="font-mono">{diffResult.baseVersionId ?? '—'}</span>
            {' · '}Checksum: <span className="font-mono">{diffResult.checksum || '—'}</span>
            {diffResult.truncated ? ' · (dipotong — diff tidak lengkap)' : ''}
          </p>
          {diffResult.lines.length === 0 ? (
            <p className="text-slate-500 py-2">Tidak ada perbedaan baris.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
                <tbody>
                  {diffResult.lines.map((line, idx) => (
                    <tr
                      key={idx}
                      className={
                        line.type === 'add'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                          : line.type === 'remove'
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                            : 'text-slate-700 dark:text-slate-300'
                      }
                    >
                      <td className="py-0.5 px-2 text-right text-slate-400 w-10 select-none">
                        {line.oldLine ?? ''}
                      </td>
                      <td className="py-0.5 px-2 text-right text-slate-400 w-10 select-none">
                        {line.newLine ?? ''}
                      </td>
                      <td className="py-0.5 px-2 w-4 text-center select-none">
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                      </td>
                      <td className="py-0.5 px-2 whitespace-pre-wrap break-all">{line.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
