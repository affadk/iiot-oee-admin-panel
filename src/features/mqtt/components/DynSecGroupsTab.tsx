import { Trash2, Users } from 'lucide-react';
import type { MqttGroup } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';

interface DynSecGroupsTabProps {
  groups: MqttGroup[];
  canManage: { canInteract: boolean };
  onOpenManage: (group: MqttGroup) => void;
  onDeleteGroup: (groupname: string) => void;
}

export const DynSecGroupsTab: React.FC<DynSecGroupsTabProps> = ({
  groups,
  canManage,
  onOpenManage,
  onDeleteGroup,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groups.map((g) => (
        <div
          key={g.groupname}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3 text-xs"
        >
          <div className="flex items-start justify-between">
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-500" />
              <span>{g.groupname}</span>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={!canManage.canInteract} onClick={() => onOpenManage(g)}>
                Kelola Anggota
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!canManage.canInteract}
                onClick={() => onDeleteGroup(g.groupname)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="text-[11px] space-y-1">
            <div>
              <span className="text-slate-400">Clients: </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {g.clients.length > 0 ? g.clients.join(', ') : '(kosong)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Roles: </span>
              <span className="font-mono text-sky-600 dark:text-sky-400">
                {g.roles.length > 0 ? g.roles.join(', ') : '(kosong)'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
