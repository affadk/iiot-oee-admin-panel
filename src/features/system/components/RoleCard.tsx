import React from 'react';
import { Edit3, Eye, Key, Lock, Trash2, X } from 'lucide-react';
import type { IamAssignment, IamPermission, IamPolicyRule, IamRole } from '../../../types/iam';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface RoleCardProps {
  role: IamRole;
  policies: IamPolicyRule[];
  assignments: IamAssignment[];
  permissions: IamPermission[];
  onOpenDetail: (roleId: string) => void;
  onOpenEditRole: (role: IamRole) => void;
  onOpenBind: (role: IamRole) => void;
  onDeleteRole: (role: IamRole) => void;
  onUnbind: (role: IamRole, permissionId: string, label: string) => void;
}

/**
 * Satu kartu role di tab Roles (E31.14, FAT-277 — diekstrak dari
 * RolesTab): header + aksi + chip permission terikat.
 */
export const RoleCard: React.FC<RoleCardProps> = ({
  role: r,
  policies,
  assignments,
  permissions,
  onOpenDetail,
  onOpenEditRole,
  onOpenBind,
  onDeleteRole,
  onUnbind,
}) => {
  const boundRules = policies.filter((p) => p.roleId === r.id && Boolean(p.permissionId));
  const assignedUserCount = assignments.filter(
    (a) => a.role_id === r.id || a.role_name === r.name
  ).length;

  return (
    <div
      className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{r.name}</span>
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
          {!r.is_system && r.name.trim().toUpperCase() !== 'ADMIN' && (
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
          {!r.is_system && r.name.trim().toUpperCase() !== 'ADMIN' && (
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
              const permObj = permissions.find((p) => p.id === br.permissionId);
              const permLabel = permObj
                ? `${permObj.action}:${permObj.resourceType}`
                : `${br.action} (${br.resourcePattern})`;
              const isDeny = br.effect === 'DENY';
              const hasCustomScope =
                permObj && br.resourcePattern !== `${permObj.resourceType}:*`;
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
                    {br.effect}
                  </span>
                  <span>{permLabel}</span>
                  {hasCustomScope && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      ({br.resourcePattern})
                    </span>
                  )}
                  {r.name !== 'ADMIN' && br.permissionId && (
                    <button
                      type="button"
                      aria-label={`Lepas permission ${permLabel} dari ${r.name}`}
                      onClick={() => onUnbind(r, br.permissionId!, permLabel)}
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
};
