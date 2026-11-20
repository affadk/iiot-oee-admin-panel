import { useMemo, useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import type { IamPolicyRule } from '../../../types/iam';
import { policyTargetsAdmin } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

interface PoliciesTabProps {
  policies: IamPolicyRule[];
  isSubmitting: boolean;
  onOpenCreatePolicy: () => void;
  onEditPolicy: (policy: IamPolicyRule) => void;
  onTogglePolicy: (policy: IamPolicyRule) => void;
  onDeletePolicy: (policy: IamPolicyRule) => void;
}

/** Tab Aturan Kebijakan: tabel policy. Search + memo tinggal di tab ini. */
export const PoliciesTab: React.FC<PoliciesTabProps> = ({
  policies,
  isSubmitting,
  onOpenCreatePolicy,
  onEditPolicy,
  onTogglePolicy,
  onDeletePolicy,
}) => {
  const [policySearch, setPolicySearch] = useState('');

  const filteredPolicies = useMemo(() => {
    const q = policySearch.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter(
      (p) =>
        p.roleName.toLowerCase().includes(q) ||
        p.subjectMatch.toLowerCase().includes(q) ||
        p.action.toLowerCase().includes(q) ||
        p.resourcePattern.toLowerCase().includes(q)
    );
  }, [policies, policySearch]);

  // E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Render
  // kustom per kolom + aksi per baris (termasuk proteksi policy admin)
  // dipindahkan ke ColumnDef.cell. Catatan: tabel lama tidak punya empty
  // state (daftar kosong = header saja); DataTable menampilkan empty
  // state standar — teks netral di bawah.
  const columns = useMemo<ColumnDef<IamPolicyRule, unknown>[]>(
    () => [
      {
        id: 'role',
        header: 'Role & Effect',
        cell: ({ row }) => {
          const pol = row.original;
          return (
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{pol.roleName}</div>
              <div className="text-[11px] text-slate-500 font-mono">{pol.subjectMatch}</div>
              <Badge variant={pol.effect === 'ALLOW' ? 'success' : 'danger'}>{pol.effect}</Badge>
            </div>
          );
        },
      },
      {
        id: 'action',
        header: 'Action / Resource Pattern',
        cell: ({ row }) => {
          const pol = row.original;
          return (
            <div className="text-xs font-mono text-[11px]">
              <div>{pol.action}</div>
              <div className="text-slate-500">{pol.resourcePattern}</div>
            </div>
          );
        },
      },
      {
        id: 'condition',
        header: 'Syarat Tambahan',
        cell: ({ row }) => {
          const pol = row.original;
          return (
            <div className="text-xs font-mono text-[11px] text-slate-600 dark:text-slate-300">
              {pol.abacCondition
                ? typeof pol.abacCondition === 'string'
                  ? pol.abacCondition
                  : JSON.stringify(pol.abacCondition)
                : '—'}
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? 'success' : 'neutral'}>
            {row.original.enabled ? 'ACTIVE' : 'DISABLED'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const pol = row.original;
          const isAdminProtected = policyTargetsAdmin(pol.subjectMatch);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                aria-label={`Edit policy ${pol.id}`}
                disabled={isAdminProtected || isSubmitting}
                onClick={() => onEditPolicy(pol)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isAdminProtected || isSubmitting}
                onClick={() => onTogglePolicy(pol)}
              >
                {pol.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label={`Hapus policy ${pol.id}`}
                disabled={isAdminProtected || isSubmitting}
                onClick={() => onDeletePolicy(pol)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [isSubmitting, onEditPolicy, onTogglePolicy, onDeletePolicy],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Cari aturan kebijakan"
            value={policySearch}
            onChange={(e) => setPolicySearch(e.target.value)}
            placeholder="Cari role, action, resource..."
            className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
          <span className="text-xs text-slate-500">
            Aturan pemberian (ALLOW) atau pembatasan (DENY) akses beserta syarat area kerja.
          </span>
        </div>
        <Button size="sm" onClick={onOpenCreatePolicy}>
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Aturan</span>
        </Button>
      </div>
      <DataTable
        data={filteredPolicies}
        columns={columns}
        getRowId={(pol) => pol.id}
        emptyTitle="Belum ada aturan kebijakan"
        emptyDescription="Tidak ada aturan kebijakan yang cocok dengan pencarian."
      />
    </div>
  );
};
