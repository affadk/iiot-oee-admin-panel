import { useMemo } from 'react';
import { Edit3, Eye, KeyRound, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Operator } from '../../../types/production';
import { IamAssignment } from '../../../types/iam';
import { CapabilityKey, isProtectedOperator } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface UseOperatorColumnsParams {
  assignments: IamAssignment[];
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

// E32.7 (FAT-288): definisi kolom dipindah dari components/OperatorsTable.tsx
// — render per kolom vs shell DataTable; mengikuti preseden
// production/components/WorkOrderColumns.tsx. Tampilan akhir sama
// (sel dibungkus text-xs; DataTable sendiri text-sm).
export function useOperatorColumns({
  assignments,
  togglingId,
  checkCapability,
  onDetail,
  onToggle,
  onEdit,
  onRotatePwd,
  onDelete,
}: UseOperatorColumnsParams) {
  return useMemo<ColumnDef<Operator, unknown>[]>(
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
}
