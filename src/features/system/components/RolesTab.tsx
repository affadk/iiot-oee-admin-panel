import { useMemo, useState } from 'react';
import { Edit3, Eye, Key, Lock, Plus, Trash2, X } from 'lucide-react';
import type { IamAssignment, IamPermission, IamPolicyRule, IamRole } from '../../../types/iam';
import { CUSTOM_ROLE_MAX_LEVEL } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface RolesTabProps {
  roles: IamRole[];
  policies: IamPolicyRule[];
  assignments: IamAssignment[];
  permissions: IamPermission[];
  onOpenCreateRole: () => void;
  onOpenDetail: (roleId: string) => void;
  onOpenEditRole: (role: IamRole) => void;
  onOpenBind: (role: IamRole) => void;
  onDeleteRole: (role: IamRole) => void;
  onUnbind: (role: IamRole, permissionId: string, label: string) => void;
}

/** Tab Roles: filter + grid kartu role. Filter state + memo tinggal di tab ini. */
export const RolesTab: React.FC<RolesTabProps> = ({
  roles,
  policies,
  assignments,
  permissions,
  onOpenCreateRole,
  onOpenDetail,
  onOpenEditRole,
  onOpenBind,
  onDeleteRole,
  onUnbind,
}) => {
  const [roleFilterQuery, setRoleFilterQuery] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL');

  const filteredRoles = useMemo(() => {
    const q = roleFilterQuery.trim().toLowerCase();
    return roles.filter((r) => {
      if (roleTypeFilter === 'SYSTEM' && !r.is_system) return false;
      if (roleTypeFilter === 'CUSTOM' && r.is_system) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    });
  }, [roles, roleFilterQuery, roleTypeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter tipe role"
            value={roleTypeFilter}
            onChange={(e) => setRoleTypeFilter(e.target.value as 'ALL' | 'SYSTEM' | 'CUSTOM')}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Semua Tipe ({roles.length})</option>
            <option value="SYSTEM">Role Sistem ({roles.filter((r) => r.is_system).length})</option>
            <option value="CUSTOM">Custom Role ({roles.filter((r) => !r.is_system).length})</option>
          </select>
          <input
            type="search"
            aria-label="Cari role"
            value={roleFilterQuery}
            onChange={(e) => setRoleFilterQuery(e.target.value)}
            placeholder="Cari nama atau deskripsi role..."
            className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
        <Button size="sm" onClick={onOpenCreateRole}>
          <Plus className="w-3.5 h-3.5" />
          <span>Custom Role</span>
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Role sistem (ADMIN, SUPERVISOR, OPERATOR, MAINTENANCE) dilindungi dan tidak dapat diubah atau dihapus. Custom role dibatasi maksimal level {CUSTOM_ROLE_MAX_LEVEL} dan hanya efektif dalam mode <code className="font-mono">enforce</code>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRoles.map((r) => {
          const boundRules = policies.filter((p) => p.role_id === r.id && Boolean(p.permission_id));
          const assignedUserCount = assignments.filter(
            (a) => a.role_id === r.id || a.role_name === r.name
          ).length;
          return (
            <div
              key={r.id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{r.name}</span>
                    <Badge variant={r.is_system ? 'info' : 'neutral'}>Level {r.privilege_level}</Badge>
                    {r.is_system && (
                      <Badge variant="warning">
                        <span className="inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" /> System
                        </span>
                      </Badge>
                    )}
                    {assignedUserCount > 0 && (
                      <Badge variant="success">{assignedUserCount} User</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Detail role ${r.name}`}
                    onClick={() => onOpenDetail(r.id)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Detail</span>
                  </Button>
                  {!r.is_system && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Edit role ${r.name}`}
                      onClick={() => onOpenEditRole(r)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onOpenBind(r)}>
                    <Key className="w-3.5 h-3.5" />
                    <span>Assign Perm</span>
                  </Button>
                  {!r.is_system && (
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Hapus role ${r.name}`}
                      onClick={() => onDeleteRole(r)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {boundRules.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Permission Terikat ({boundRules.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {boundRules.map((br) => {
                      const permObj = permissions.find((p) => p.id === br.permission_id);
                      const permLabel = permObj
                        ? `${permObj.action}:${permObj.resource_type}`
                        : `${br.action} (${br.resource_pattern})`;
                      const isDeny = br.eft === 'DENY';
                      const hasCustomScope =
                        permObj && br.resource_pattern !== `${permObj.resource_type}:*`;
                      return (
                        <span
                          key={br.id}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono ${
                            isDeny
                              ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span
                            className={`font-sans text-[10px] font-bold uppercase ${
                              isDeny
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {br.eft}
                          </span>
                          <span>{permLabel}</span>
                          {hasCustomScope && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              ({br.resource_pattern})
                            </span>
                          )}
                          {r.name !== 'ADMIN' && br.permission_id && (
                            <button
                              type="button"
                              aria-label={`Lepas permission ${permLabel} dari ${r.name}`}
                              onClick={() => onUnbind(r, br.permission_id!, permLabel)}
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
