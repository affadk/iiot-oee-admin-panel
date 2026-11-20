import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import type { IamAssignment } from '../../../types/iam';
import type { Operator } from '../../../types/production';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

interface AssignmentsTabProps {
  assignments: IamAssignment[];
  operators: Operator[];
  isSubmitting: boolean;
  onOpenAssign: () => void;
  onRevoke: (assignment: IamAssignment) => void;
  onInspect: (operatorId: string) => void;
}

/** Tab User Assignments: tabel assignment. Search + memo tinggal di tab ini. */
export const AssignmentsTab: React.FC<AssignmentsTabProps> = ({
  assignments,
  operators,
  isSubmitting,
  onOpenAssign,
  onRevoke,
  onInspect,
}) => {
  const [assignmentSearch, setAssignmentSearch] = useState('');

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(
      (a) =>
        a.operator_id.toLowerCase().includes(q) ||
        a.operator_name.toLowerCase().includes(q) ||
        a.role_name.toLowerCase().includes(q) ||
        (a.scope_id ?? '').toLowerCase().includes(q)
    );
  }, [assignments, assignmentSearch]);

  // E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Render
  // kustom per kolom + aksi per baris (termasuk Anti-Lockout Guard)
  // dipindahkan ke ColumnDef.cell.
  const columns = useMemo<ColumnDef<IamAssignment, unknown>[]>(
    () => [
      {
        id: 'operator',
        header: 'Operator',
        cell: ({ row }) => {
          const a = row.original;
          const targetOp = operators.find((o) => o.operator_id === a.operator_id);
          return (
            <div className="text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <span>{a.operator_name}</span>
                {targetOp?.is_protected && <Badge variant="warning">Dilindungi</Badge>}
                {targetOp && !targetOp.is_active && <Badge variant="danger">Nonaktif</Badge>}
              </div>
              <div className="text-[11px] font-tabular text-slate-500">{a.operator_id}</div>
            </div>
          );
        },
      },
      {
        id: 'role',
        header: 'Assigned Role',
        cell: ({ row }) => <Badge variant="info">{row.original.role_name}</Badge>,
      },
      {
        id: 'scope',
        header: 'Scope Level & Target',
        cell: ({ row }) => {
          const a = row.original;
          const isOrgScope = a.scope_type === 'ORGANIZATION';
          return (
            <div className="text-xs font-tabular">
              <div className="flex items-center gap-1.5">
                <span>
                  {a.scope_type} {a.scope_id ? `(${a.scope_id})` : '(Global Plant)'}
                </span>
                <Badge variant={isOrgScope ? 'success' : 'neutral'}>
                  {isOrgScope ? 'Efektif' : 'Persiapan'}
                </Badge>
              </div>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const a = row.original;
          const targetOp = operators.find((o) => o.operator_id === a.operator_id);
          const isProtectedAdminAssignment =
            (Boolean(targetOp?.is_protected) || a.operator_id === 'ADM-001') && a.role_name === 'ADMIN';
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button size="sm" variant="outline" onClick={() => onInspect(a.operator_id)}>
                <Search className="w-3.5 h-3.5" />
                <span>Inspect</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={isProtectedAdminAssignment || isSubmitting}
                title={
                  isProtectedAdminAssignment
                    ? 'Anti-Lockout Guard: role ADMIN pada akun dilindungi tidak dapat dicabut.'
                    : undefined
                }
                onClick={() => onRevoke(a)}
              >
                Revoke
              </Button>
            </div>
          );
        },
      },
    ],
    [operators, isSubmitting, onInspect, onRevoke],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Cari user assignment"
            value={assignmentSearch}
            onChange={(e) => setAssignmentSearch(e.target.value)}
            placeholder="Cari operator, role, atau scope..."
            className="w-64 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
          <span className="text-xs text-slate-500">
            Catatan: Hanya scope <code className="font-mono font-semibold">ORGANIZATION</code> yang memberi hak akses Admin Panel aktif saat ini.
          </span>
        </div>
        <Button size="sm" onClick={onOpenAssign}>
          <Users className="w-3.5 h-3.5" />
          <span>Assign User Role</span>
        </Button>
      </div>
      <DataTable
        data={filteredAssignments}
        columns={columns}
        getRowId={(a) => a.id}
        emptyTitle="Tidak ada user assignment yang cocok."
      />
    </div>
  );
};
