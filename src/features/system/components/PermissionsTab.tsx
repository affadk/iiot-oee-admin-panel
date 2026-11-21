import { useMemo, useState } from 'react';
import { Key } from 'lucide-react';
import type { IamPermission, IamPolicyRule } from '../../../types/iam';
import { isReservedPermission } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';

interface PermissionsTabProps {
  permissions: IamPermission[];
  policies: IamPolicyRule[];
  onAssignFromPermission: (permission: IamPermission) => void;
}

/**
 * Tab Katalog Permission Sistem (Fixed Master Data · READ-ONLY).
 * Tidak ada UI create/edit/delete di tab ini — hanya "Assign ke Role".
 * Filter + `filteredPermissions` (dulu inline di IIFE, kini useMemo) tinggal
 * di tab ini.
 */
export const PermissionsTab: React.FC<PermissionsTabProps> = ({
  permissions,
  policies,
  onAssignFromPermission,
}) => {
  const [permDomainFilter, setPermDomainFilter] = useState<string>('ALL');
  const [permSearchQuery, setPermSearchQuery] = useState('');

  const domainTypes = useMemo(
    () => Array.from(new Set(permissions.map((p) => p.resourceType))).sort(),
    [permissions],
  );

  const filteredPermissions = useMemo(() => {
    const q = permSearchQuery.trim().toLowerCase();
    return permissions.filter((p) => {
      if (permDomainFilter !== 'ALL' && p.resourceType !== permDomainFilter) return false;
      if (!q) return true;
      return (
        `${p.action}:${p.resourceType}`.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [permissions, permDomainFilter, permSearchQuery]);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-200 space-y-1">
        <div className="font-semibold">
          Katalog Permission Sistem
        </div>
        <p>
          Daftar permission di bawah didefinisikan oleh guard API backend (<code className="font-mono">action:resourceType</code>). Permission baru bisa ditambahkan bila pasangannya punya rute penjaga (guard <code className="font-mono">INERT_PERMISSION</code>); duplikat ditolak (<code className="font-mono">PERMISSION_EXISTS</code>). Gunakan tombol <strong>Assign ke Role</strong> untuk menetapkan izin ke peran tertentu.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter domain permission"
            wrapperClassName="shrink-0"
            value={permDomainFilter}
            onChange={(e) => setPermDomainFilter(e.target.value)}
            options={[{ value: 'ALL', label: `Semua Domain (${permissions.length})` }, ...domainTypes.map((dt) => ({ value: dt, label: dt }))]}
          />
          <input
            type="search"
            aria-label="Cari permission"
            value={permSearchQuery}
            onChange={(e) => setPermSearchQuery(e.target.value)}
            placeholder="Cari action atau deskripsi..."
            className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
        <span className="text-[11px] text-slate-500">
          Menampilkan {filteredPermissions.length} dari {permissions.length} permission sistem
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPermissions.map((p) => {
          const reserved = isReservedPermission(p.action, p.resourceType);
          const directBindings = policies.filter(
            (pol) =>
              pol.enabled &&
              (pol.permissionId === p.id ||
                (pol.action === p.action &&
                  (pol.resourcePattern === `${p.resourceType}:*` ||
                    pol.resourcePattern.startsWith(`${p.resourceType}:`))) ||
                pol.action === `${p.action}:${p.resourceType}`)
          );
          return (
            <div
              key={p.id}
              className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {p.action}:{p.resourceType}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="neutral">Sistem</Badge>
                    {reserved && <Badge variant="danger">RESERVED</Badge>}
                  </div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{p.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 mr-1">
                    Aturan Aktif:
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-mono text-[10px]">
                    ADMIN (*:*)
                  </span>
                  {directBindings.map((pol) => (
                    <span
                      key={pol.id}
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                        pol.effect === 'DENY'
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {pol.effect} {pol.roleName}
                    </span>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAssignFromPermission(p)}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Assign ke Role</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
