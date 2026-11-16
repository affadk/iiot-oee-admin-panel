import { KeyRound, Trash2 } from 'lucide-react';
import type { MqttClient } from '../../../types/mqtt';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface DynSecClientsTabProps {
  clients: MqttClient[];
  canManage: { canInteract: boolean };
  onToggleClient: (client: MqttClient) => void;
  onDeleteClient: (username: string) => void;
  onDetachRole: (username: string, rolename: string) => void;
  onOpenAttachRole: (client: MqttClient) => void;
  onOpenRotatePassword: (client: MqttClient) => void;
}

export const DynSecClientsTab: React.FC<DynSecClientsTabProps> = ({
  clients,
  canManage,
  onToggleClient,
  onDeleteClient,
  onDetachRole,
  onOpenAttachRole,
  onOpenRotatePassword,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
            <th className="py-3 px-4">Username / Client ID</th>
            <th className="py-3 px-4">Roles (Attach / Detach)</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {clients.map((c) => (
            <tr key={c.username}>
              <td className="py-3 px-4 font-tabular">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{c.username}</div>
                <div className="text-[11px] text-slate-500">{c.clientid || c.textname || '-'}</div>
              </td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.roles.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[11px] font-mono"
                    >
                      {r}
                      {canManage.canInteract && (
                        <button
                          type="button"
                          aria-label={`Detach role ${r}`}
                          onClick={() => onDetachRole(c.username, r)}
                          className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {canManage.canInteract && (
                    <button
                      type="button"
                      onClick={() => onOpenAttachRole(c)}
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
                    >
                      + Role
                    </button>
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <Badge variant={c.enabled ? 'success' : 'danger'}>
                  {c.enabled ? 'ENABLED' : 'DISABLED'}
                </Badge>
              </td>
              <td className="py-3 px-4 text-right space-x-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canManage.canInteract}
                  onClick={() => onToggleClient(c)}
                >
                  {c.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canManage.canInteract}
                  onClick={() => onOpenRotatePassword(c)}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!canManage.canInteract}
                  onClick={() => onDeleteClient(c.username)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
