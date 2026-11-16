import { Shield, Trash2 } from 'lucide-react';
import type { MqttAclType, MqttRole } from '../../../types/mqtt';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface DynSecRolesTabProps {
  roles: MqttRole[];
  canManage: { canInteract: boolean };
  onOpenAddAcl: (role: MqttRole) => void;
  onDeleteRole: (rolename: string) => void;
  onRemoveAcl: (rolename: string, acltype: MqttAclType, topic: string) => void;
}

export const DynSecRolesTab: React.FC<DynSecRolesTabProps> = ({
  roles,
  canManage,
  onOpenAddAcl,
  onDeleteRole,
  onRemoveAcl,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {roles.map((r) => (
        <div
          key={r.rolename}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3 text-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-sky-500" />
                <span>{r.rolename}</span>
              </div>
              <p className="text-slate-500 mt-0.5">{r.textdescription || r.textname || 'MQTT Role'}</p>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={!canManage.canInteract} onClick={() => onOpenAddAcl(r)}>
                + ACL
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!canManage.canInteract}
                onClick={() => onDeleteRole(r.rolename)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {r.acls.length === 0 ? (
              <div className="text-slate-400 italic">Belum ada aturan topik komunikasi (akses dibatasi secara bawaan).</div>
            ) : (
              r.acls.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/50 font-mono text-[11px]">
                  <div>
                    <Badge variant={a.allow ? 'success' : 'danger'}>{a.allow ? 'ALLOW' : 'DENY'}</Badge>{' '}
                    <span className="ml-1 text-slate-500">{a.acltype}</span>{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{a.topic}</span>
                  </div>
                  {canManage.canInteract && (
                    <button
                      type="button"
                      onClick={() => onRemoveAcl(r.rolename, a.acltype, a.topic)}
                      className="text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
