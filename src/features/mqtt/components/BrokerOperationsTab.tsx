import { History } from 'lucide-react';
import type { BrokerOperation } from '../../../types/mqtt';
import { Badge } from '../../../components/ui/Badge';
import { formatDateTime } from '../../../utils/formatDate';

interface BrokerOperationsTabProps {
  operations: BrokerOperation[];
}

export const BrokerOperationsTab: React.FC<BrokerOperationsTabProps> = ({ operations }) => {
  return (
    <div className="space-y-3">
      {operations.map((op) => (
        <div
          key={op.operation_id}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2 text-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-tabular">
              <History className="w-4 h-4 text-sky-500" />
              <span className="font-bold text-slate-900 dark:text-slate-100">{op.operation_id}</span>
              <Badge variant="info">{op.type}</Badge>
              <span className="text-slate-500">Version: {op.version_id}</span>
            </div>
            <Badge variant={op.status === 'SUCCEEDED' ? 'success' : op.status === 'FAILED' ? 'danger' : 'warning'}>
              {op.status}
            </Badge>
          </div>
          {op.reason && <div className="text-slate-600 dark:text-slate-300">Reason: {op.reason}</div>}
          {/* E23 Batch 3 (FAT-200, N-31): field operasi spec yang dulu
              dibuang — tampilkan bila ada (aktor/fase/waktu/error). */}
          {(op.actorName || op.phase || op.startedAt || op.finishedAt) && (
            <div className="text-slate-500 dark:text-slate-400">
              {[
                op.actorName ? `Aktor: ${op.actorName}` : null,
                op.phase ? `Fase: ${op.phase}` : null,
                op.startedAt ? `Mulai: ${formatDateTime(op.startedAt)}` : null,
                op.finishedAt ? `Selesai: ${formatDateTime(op.finishedAt)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {op.error && (
            <div role="alert" className="text-red-700 dark:text-red-300">
              Error: {op.error.code} — {op.error.message}
            </div>
          )}
          {op.steps && op.steps.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {op.steps.map((s, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]"
                >
                  {s.step}: {s.status}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
