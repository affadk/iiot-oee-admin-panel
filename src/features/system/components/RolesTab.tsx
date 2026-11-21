import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { IamAssignment, IamPermission, IamPolicyRule, IamRole } from '../../../types/iam';
import { Button } from '../../../components/ui/Button';
import { RoleCard } from './RoleCard';
import { Select } from '../../../components/ui/Select';

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
          <Select
            aria-label="Filter tipe role"
            wrapperClassName="shrink-0"
            value={roleTypeFilter}
            onChange={(e) => setRoleTypeFilter(e.target.value as 'ALL' | 'SYSTEM' | 'CUSTOM')}
            options={[{ value: 'ALL', label: `Semua Tipe (${roles.length})` }, { value: 'SYSTEM', label: `Role Sistem (${roles.filter((r) => r.is_system).length})` }, { value: 'CUSTOM', label: `Custom Role (${roles.filter((r) => !r.is_system).length})` }]}
          />
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
        Hanya role ADMIN yang immutable dan tidak dapat diubah atau dihapus. SUPERVISOR, OPERATOR, dan MAINTENANCE adalah preset opsional — bisa diubah atau dihapus bila tidak dipakai. Custom role hanya efektif dalam mode <code className="font-mono">enforce</code>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRoles.map((r) => (
          <RoleCard
            key={r.id}
            role={r}
            policies={policies}
            assignments={assignments}
            permissions={permissions}
            onOpenDetail={onOpenDetail}
            onOpenEditRole={onOpenEditRole}
            onOpenBind={onOpenBind}
            onDeleteRole={onDeleteRole}
            onUnbind={onUnbind}
          />
        ))}
      </div>
    </div>
  );
};
