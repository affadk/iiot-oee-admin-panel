import React, { useMemo } from 'react';
import { Edit3, Eye, KeyRound, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Operator } from '../../../types/production';
import { IamAssignment } from '../../../types/iam';
import { UserRole } from '../../../types/auth';
import { CapabilityKey, isProtectedOperator } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

export interface OperatorsTableProps {
  operators: Operator[];
  assignments: IamAssignment[];
  isLoading: boolean;
  currentUserRole: UserRole;
  togglingId: string | null;
  /** Dipanggil per baris di dalam cell renderer — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onDetail: (operatorId: string) => void;
  onToggle: (op: Operator) => void;
  onEdit: (op: Operator) => void;
  onRotatePwd: (op: Operator) => void;
  onDelete: (op: Operator) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Semua
// render kustom per kolom + aksi per baris (termasuk tombol kondisional
// Edit/Password/Hapus) dipindahkan ke ColumnDef.cell — tampilan akhir sama
// (sel dibungkus text-xs seperti sebelumnya; DataTable sendiri text-sm).
/** Tabel operator (R9.5, dipindah dari OperatorsPage L486–648). */
export const OperatorsTable: React.FC<OperatorsTableProps> = ({
  operators,
  assignments,
  isLoading,
  currentUserRole,
  togglingId,
  checkCapability,
  onDetail,
  onToggle,
  onEdit,
  onRotatePwd,
  onDelete,
}) => {
  const columns = useMemo<ColumnDef<Operator, unknown>[]>(
    () => [
      {
        id: 'operator',
        header: 'Operator ID & Nama',
        cell: ({ row }) => {
          const op = row.original;
          const isProtectedRoot = isProtectedOperator(op);
          return (
            <div className="text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <span>{op.name}</span>
                {isProtectedRoot && <Badge variant="info">Dilindungi</Badge>}
              </div>
              <div className="text-[11px] font-tabular text-slate-500">{op.operator_id}</div>
            </div>
          );
        },
      },
      {
        id: 'roles',
        header: 'Peran & Multi-Role',
        cell: ({ row }) => {
          const op = row.original;
          const opAssignments = assignments.filter((a) => a.operator_id === op.operator_id);
          return (
            <div className="text-xs">
              <div className="flex flex-wrap items-center gap-1">
                <Badge
                  variant={
                    op.role === 'ADMIN'
                      ? 'danger'
                      : op.role === 'SUPERVISOR'
                      ? 'warning'
                      : op.role === 'MAINTENANCE'
                      ? 'info'
                      : 'neutral'
                  }
                >
                  {op.role}
                </Badge>
                {opAssignments
                  .filter((a) => a.role_name !== op.role || a.scope_type !== 'ORGANIZATION')
                  .map((a) => (
                    <Badge key={a.id} variant={a.scope_type === 'ORGANIZATION' ? 'success' : 'neutral'}>
                      +{a.role_name} ({a.scope_type})
                    </Badge>
                  ))}
              </div>
            </div>
          );
        },
      },
      {
        id: 'line',
        header: 'Line / Scope',
        cell: ({ row }) => (
          <div className="text-xs font-tabular text-slate-700 dark:text-slate-300">
            {/* E28 Batch B (FAT-224, E2E-10): ADM-001 (admin,
                scope organisasi) tak punya line_id — sel kosong
                diganti '—', konsisten dengan sel kosong lain. */}
            {row.original.line_id || '—'}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'success' : 'danger'}>
            {row.original.is_active ? 'ACTIVE' : 'SUSPENDED'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi Administratif',
        cell: ({ row }) => {
          const op = row.original;
          const isProtectedRoot = isProtectedOperator(op);
          const rowStatusCap = checkCapability('operator.status.update', op.operator_id);
          const rowUpdateCap = checkCapability('operator.update', op.operator_id);
          const rowRotatePwdCap = checkCapability('operator.password.rotate', op.operator_id);
          const rowDeleteCap = checkCapability('operator.delete', op.operator_id);
          return (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                aria-label={`Detail operator ${op.operator_id}`}
                onClick={() => onDetail(op.operator_id)}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Detail</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                isLoading={togglingId === op.operator_id}
                disabled={
                  !rowStatusCap.canInteract ||
                  isProtectedRoot ||
                  Boolean(togglingId)
                }
                title={
                  isProtectedRoot
                    ? `Akun dilindungi (${op.operator_id})`
                    : !rowStatusCap.canInteract
                    ? rowStatusCap.reason
                    : 'Aktifkan/nonaktifkan operator'
                }
                onClick={() => onToggle(op)}
              >
                {op.is_active ? 'Suspend' : 'Activate'}
              </Button>

              {rowUpdateCap.canInteract && (
                <Button size="sm" variant="outline" onClick={() => onEdit(op)}>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>
              )}

              {rowRotatePwdCap.canInteract && (
                <Button size="sm" variant="secondary" onClick={() => onRotatePwd(op)}>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Password</span>
                </Button>
              )}

              {rowDeleteCap.canInteract && !isProtectedRoot && (
                <Button size="sm" variant="danger" onClick={() => onDelete(op)}>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [assignments, togglingId, checkCapability, onDetail, onToggle, onEdit, onRotatePwd, onDelete],
  );

  return (
    <DataTable
      data={operators}
      columns={columns}
      getRowId={(op) => op.operator_id}
      isLoading={isLoading}
      emptyTitle="Tidak ada operator yang sesuai filter."
    />
  );
};
