import React from 'react';
import { Edit3, Eye, KeyRound, Trash2 } from 'lucide-react';
import { Operator } from '../../../types/production';
import { IamAssignment } from '../../../types/iam';
import { UserRole } from '../../../types/auth';
import { CapabilityKey, canManageTargetRole, isProtectedOperator } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface OperatorsTableProps {
  operators: Operator[];
  assignments: IamAssignment[];
  isLoading: boolean;
  currentUserRole: UserRole;
  togglingId: string | null;
  /** Dipanggil per baris di dalam .map — JANGAN precompute boolean, JANGAN useAuth di sini. */
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
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Operator ID &amp; Nama</th>
              <th className="py-3 px-4">Peran &amp; Multi-Role</th>
              <th className="py-3 px-4">Line / Scope</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aksi Administratif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Memuat operator...
                </td>
              </tr>
            ) : operators.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Tidak ada operator yang sesuai filter.
                </td>
              </tr>
            ) : (
              operators.map((op) => {
                const canManageTarget = canManageTargetRole(currentUserRole, op.role);
                const isProtectedRoot = isProtectedOperator(op);
                const rowStatusCap = checkCapability('operator.status.update', op.operator_id);
                const rowUpdateCap = checkCapability('operator.update', op.operator_id);
                const rowRotatePwdCap = checkCapability('operator.password.rotate', op.operator_id);
                const rowDeleteCap = checkCapability('operator.delete', op.operator_id);
                const opAssignments = assignments.filter((a) => a.operator_id === op.operator_id);

                return (
                  <tr key={op.operator_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                        <span>{op.name}</span>
                        {isProtectedRoot && <Badge variant="info">Dilindungi</Badge>}
                      </div>
                      <div className="text-[11px] font-tabular text-slate-500">{op.operator_id}</div>
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                      {op.line_id}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={op.is_active ? 'success' : 'danger'}>
                        {op.is_active ? 'ACTIVE' : 'SUSPENDED'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
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
                            !canManageTarget ||
                            isProtectedRoot ||
                            Boolean(togglingId)
                          }
                          title={
                            isProtectedRoot
                              ? `Akun dilindungi (${op.operator_id})`
                              : !canManageTarget
                              ? `Hierarki peran: ${currentUserRole} tidak dapat mengubah akun ${op.role}`
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
