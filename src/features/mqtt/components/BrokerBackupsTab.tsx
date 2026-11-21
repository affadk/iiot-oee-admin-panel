import { HardDrive } from 'lucide-react';
import type { BrokerBackup } from '../../../types/mqtt';
import { formatDateTime } from '../../../utils/formatDate';

interface BrokerBackupsTabProps {
  backups: BrokerBackup[];
}

export const BrokerBackupsTab: React.FC<BrokerBackupsTabProps> = ({ backups }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {backups.map((b) => (
        <div
          key={b.backup_id}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-sky-500 shrink-0" />
            <div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{b.filename}</div>
              <div className="text-slate-500 font-tabular">
                Version {b.version_id} · {b.size_bytes} bytes
              </div>
            </div>
          </div>
          <span className="text-slate-400 font-tabular">{formatDateTime(b.created_at)}</span>
        </div>
      ))}
    </div>
  );
};
