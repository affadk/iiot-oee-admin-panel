import { CheckCircle2, GitCompare, RotateCcw, Trash2 } from 'lucide-react';
import type { BrokerConfigVersion } from '../../../types/mqtt';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface BrokerVersionsTabProps {
  versions: BrokerConfigVersion[];
  canManage: { canInteract: boolean };
  onViewDiff: (versionId: string) => void;
  onDiscard: (versionId: string) => void;
  onRequestApply: (version: BrokerConfigVersion) => void;
  onRequestRollback: (version: BrokerConfigVersion) => void;
}

export const BrokerVersionsTab: React.FC<BrokerVersionsTabProps> = ({
  versions,
  canManage,
  onViewDiff,
  onDiscard,
  onRequestApply,
  onRequestRollback,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
            <th className="py-3 px-4">Version ID &amp; Summary</th>
            <th className="py-3 px-4">Applied By / Timestamp</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Workflow Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {versions.map((ver) => (
            <tr key={ver.version_id}>
              <td className="py-3 px-4">
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{ver.version_id}</div>
                <div className="text-slate-500 mt-0.5">{ver.summary}</div>
              </td>
              <td className="py-3 px-4 font-tabular text-slate-500">
                <div>{ver.applied_by}</div>
                <div>{new Date(ver.applied_at).toLocaleString()}</div>
              </td>
              <td className="py-3 px-4">
                <Badge
                  variant={
                    ver.status === 'ACTIVE'
                      ? 'success'
                      : ver.status === 'STAGED'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {ver.status}
                </Badge>
              </td>
              <td className="py-3 px-4 text-right space-x-1.5">
                <Button size="sm" variant="outline" onClick={() => onViewDiff(ver.version_id)}>
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Diff</span>
                </Button>
                {ver.status === 'STAGED' && (
                  <>
                    <Button
                      size="sm"
                      disabled={!canManage.canInteract}
                      onClick={() => onRequestApply(ver)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!canManage.canInteract}
                      onClick={() => onDiscard(ver.version_id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discard</span>
                    </Button>
                  </>
                )}
                {ver.status !== 'ACTIVE' && ver.status !== 'STAGED' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canManage.canInteract}
                    onClick={() => onRequestRollback(ver)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rollback</span>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
