import React, { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Operator } from '../../../types/production';
import { IamAssignment, IamRole, ScopeLevel } from '../../../types/iam';
import { isProtectedOperator } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { AssignRoleInput } from '../hooks/useOperatorRoleAssignment';

export interface OperatorDetailModalProps {
  operator: Operator;
  assignments: IamAssignment[];
  iamRoles: IamRole[];
  canManageIam: boolean;
  isRevokingRole: boolean;
  onClose: () => void;
  onRevokeRequest: (assignment: IamAssignment) => void;
  onAssignRole: (input: AssignRoleInput) => Promise<void>;
  /** Page pemilik routing — modal TIDAK memakai useNavigate. */
  onInspectPermissions: () => void;
}

/**
 * Modal detail & multi-role assignment (R9.5, diurai dari IIFE OperatorsPage L650–822).
 * Form quick-assign tinggal di dalam modal; koreksi default role (dulu
 * loadOperators L107–111) ikut pindah: default = role terakhir di `iamRoles`
 * bila nilai saat ini tidak ada di daftar.
 */
export const OperatorDetailModal: React.FC<OperatorDetailModalProps> = ({
  operator,
  assignments,
  iamRoles,
  canManageIam,
  isRevokingRole,
  onClose,
  onRevokeRequest,
  onAssignRole,
  onInspectPermissions,
}) => {
  const userAssignments = assignments.filter((a) => a.operator_id === operator.operator_id);
  const isProtectedRoot = isProtectedOperator(operator);

  const [quickAssignRoleName, setQuickAssignRoleName] = useState(() =>
    iamRoles.length > 0 && !iamRoles.some((r) => r.name === 'OPERATOR')
      ? iamRoles[iamRoles.length - 1].name
      : 'OPERATOR'
  );
  const [quickAssignScopeType, setQuickAssignScopeType] = useState<ScopeLevel>('ORGANIZATION');
  const [quickAssignScopeId, setQuickAssignScopeId] = useState('');
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (iamRoles.length > 0) {
      setQuickAssignRoleName((prev) =>
        iamRoles.some((r) => r.name === prev) ? prev : iamRoles[iamRoles.length - 1].name
      );
    }
  }, [iamRoles]);

  const handleQuickAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAssigningRole) return;
    if (quickAssignScopeType !== 'ORGANIZATION' && !quickAssignScopeId.trim()) {
      setAssignError('Scope ID wajib diisi untuk scope selain ORGANIZATION.');
      return;
    }
    setIsAssigningRole(true);
    setAssignError(null);
    try {
      await onAssignRole({
        roleName: quickAssignRoleName,
        scopeType: quickAssignScopeType,
        scopeId: quickAssignScopeId,
      });
      setQuickAssignScopeId('');
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Gagal menugaskan role.');
    } finally {
      setIsAssigningRole(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Detail Operator: ${operator.operator_id}`}
      subtitle={`${operator.name} · Primary Role: ${operator.role} · Line: ${operator.line_id}`}
      footer={
        <div className="flex items-center justify-between w-full">
          {canManageIam ? (
            <Button size="sm" variant="outline" onClick={onInspectPermissions}>
              <Search className="w-3.5 h-3.5" />
              <span>Inspeksi Izin Efektif</span>
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-500">Operator ID:</span>{' '}
            <span className="font-mono font-semibold">{operator.operator_id}</span>
          </div>
          <div>
            <span className="text-slate-500">Status:</span>{' '}
            <Badge variant={operator.is_active ? 'success' : 'danger'}>
              {operator.is_active ? 'ACTIVE' : 'SUSPENDED'}
            </Badge>
          </div>
          <div>
            <span className="text-slate-500">Primary Role:</span>{' '}
            <Badge variant="info">{operator.role}</Badge>
          </div>
          <div>
            <span className="text-slate-500">Line ID:</span>{' '}
            <span className="font-mono">{operator.line_id}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">Dibuat:</span>{' '}
            <span>{new Date(operator.created_at).toLocaleString()}</span>
            {isProtectedRoot && (
              <span className="ml-2">
                <Badge variant="warning">Akun Root Dilindungi</Badge>
              </span>
            )}
          </div>
        </div>

        {canManageIam && (
          <>
            <div className="space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-600" />
                <span>Penugasan Role IAM ({userAssignments.length})</span>
              </div>
              {userAssignments.length === 0 ? (
                <p className="text-slate-500 italic">
                  Belum ada penugasan eksplisit; memakai primary role ({operator.role}) pada scope ORGANIZATION.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {userAssignments.map((a) => {
                    const isProtectedAdminAsg = isProtectedRoot && a.role_name === 'ADMIN';
                    return (
                      <div
                        key={a.id}
                        className="p-2 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="info">{a.role_name}</Badge>
                          <span className="font-mono">
                            {a.scope_type}
                            {a.scope_id ? ` (${a.scope_id})` : ' (Global Plant)'}
                          </span>
                          <Badge variant={a.scope_type === 'ORGANIZATION' ? 'success' : 'neutral'}>
                            {a.scope_type === 'ORGANIZATION' ? 'Efektif' : 'Persiapan'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isProtectedAdminAsg || isRevokingRole}
                          onClick={() => onRevokeRequest(a)}
                        >
                          Revoke
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form
              onSubmit={handleQuickAssignRole}
              className="p-3 rounded border border-slate-200 dark:border-slate-700 space-y-3 bg-white dark:bg-slate-900"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Tambah Penugasan Role (Multi-Role Assignment)
              </div>
              {assignError && (
                <div
                  role="alert"
                  className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200"
                >
                  {assignError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-7">
                  <label htmlFor="quick-assign-role" className="block text-[11px] font-semibold mb-1">
                    Role
                  </label>
                  <select
                    id="quick-assign-role"
                    value={quickAssignRoleName}
                    onChange={(e) => setQuickAssignRoleName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    {iamRoles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-5">
                  <label htmlFor="quick-assign-scope" className="block text-[11px] font-semibold mb-1">
                    Scope
                  </label>
                  <select
                    id="quick-assign-scope"
                    value={quickAssignScopeType}
                    onChange={(e) => setQuickAssignScopeType(e.target.value as ScopeLevel)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="ORGANIZATION">ORGANIZATION (Efektif)</option>
                    <option value="SITE">SITE</option>
                    <option value="AREA">AREA</option>
                    <option value="LINE">LINE</option>
                    <option value="MACHINE">MACHINE</option>
                    <option value="DEVICE">DEVICE</option>
                  </select>
                </div>
              </div>
              {quickAssignScopeType !== 'ORGANIZATION' && (
                <Input
                  label="Scope ID"
                  value={quickAssignScopeId}
                  onChange={(e) => setQuickAssignScopeId(e.target.value)}
                  placeholder="Contoh: LINE-01"
                  required
                />
              )}
              <div className="flex justify-end">
                <Button type="submit" size="sm" isLoading={isAssigningRole}>
                  Assign Role ke {operator.operator_id}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
};
