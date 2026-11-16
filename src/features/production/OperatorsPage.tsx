import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Edit3,
  Trash2,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Users,
  Search,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { Operator } from '../../types/production';
import { IamAssignment, IamRole, ScopeLevel } from '../../types/iam';
import { UserRole, ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import { canManageTargetRole, validateOperatorInput } from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';

const ALL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'];

export const OperatorsPage: React.FC = () => {
  const { currentUser, reportForbidden, checkCapability, refreshCapabilities } = useAuth();
  const navigate = useNavigate();
  const canRead = useCapability('operator.read');
  const canCreate = useCapability('operator.create');
  const canManageIam = useCapability('access_control.manage');

  const [operators, setOperators] = useState<Operator[]>([]);
  const [iamRoles, setIamRoles] = useState<IamRole[]>([]);
  const [assignments, setAssignments] = useState<IamAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Detail & Role Assignment Modal
  const [detailOperatorId, setDetailOperatorId] = useState<string | null>(null);
  const [quickAssignRoleName, setQuickAssignRoleName] = useState('OPERATOR');
  const [quickAssignScopeType, setQuickAssignScopeType] = useState<ScopeLevel>('ORGANIZATION');
  const [quickAssignScopeId, setQuickAssignScopeId] = useState('');
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [revokeAssignmentTarget, setRevokeAssignmentTarget] = useState<IamAssignment | null>(null);
  const [isRevokingRole, setIsRevokingRole] = useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOpId, setNewOpId] = useState('OP-');
  const [newOpName, setNewOpName] = useState('');
  const [newOpRole, setNewOpRole] = useState<UserRole>('OPERATOR');
  const [newOpLineId, setNewOpLineId] = useState('LINE-01');
  const [newOpPassword, setNewOpPassword] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  // Edit Modal (ADMIN + LAN only)
  const [editTarget, setEditTarget] = useState<Operator | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('OPERATOR');
  const [editLineId, setEditLineId] = useState('LINE-01');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Rotate Password Modal (ADMIN + LAN only)
  const [pwdTarget, setPwdTarget] = useState<Operator | null>(null);
  const [newPwdValue, setNewPwdValue] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // Status toggle guard
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Delete Confirmation (ADMIN + LAN only)
  const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const loadOperators = useCallback(async () => {
    if (!canRead.canInteract) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await apiClient.getOperators();
      setOperators(list);
      if (canManageIam.canInteract) {
        const [rolesList, userRolesList] = await Promise.all([
          apiClient.getIamRoles(),
          apiClient.getIamUserRoles(),
        ]);
        setIamRoles(rolesList);
        setAssignments(userRolesList);
        if (rolesList.length > 0) {
          setQuickAssignRoleName((prev) =>
            rolesList.some((r) => r.name === prev) ? prev : rolesList[rolesList.length - 1].name
          );
        }
      } else {
        setIamRoles([]);
        setAssignments([]);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.read', undefined, err.message);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar operator.');
    } finally {
      setIsLoading(false);
    }
  }, [canRead.canInteract, canManageIam.canInteract, reportForbidden]);

  useEffect(() => {
    void loadOperators();
  }, [loadOperators]);

  const assignableRoles = ALL_ROLES.filter((r) => canManageTargetRole(currentUser.role, r));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    const errs = validateOperatorInput({
      operatorId: newOpId,
      operatorName: newOpName,
      lineId: newOpLineId,
      password: newOpPassword,
      isCreate: true,
    });
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const created = await apiClient.createOperator({
        operator_id: newOpId.trim(),
        name: newOpName.trim(),
        role: newOpRole,
        line_id: newOpLineId.trim() || 'LINE-01',
        password: newOpPassword,
      });
      await loadOperators();
      setSuccessMsg(`Akun operator ${created.operator_id} (${created.role}) berhasil dibuat.`);
      setIsCreateOpen(false);
      setNewOpId('OP-');
      setNewOpName('');
      setNewOpPassword('');
      setCreateErrors({});
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.create', newOpId, err.message);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat akun operator.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || isEditing) return;
    const errs = validateOperatorInput({
      operatorName: editName,
      lineId: editLineId,
      isCreate: false,
    });
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setIsEditing(true);
    setErrorMsg(null);
    try {
      const updated = await apiClient.updateOperator(editTarget.operator_id, {
        name: editName.trim(),
        role: editRole,
        line_id: editLineId.trim() || 'LINE-01',
      });
      await loadOperators();
      await refreshCapabilities();
      setSuccessMsg(`Profil operator ${updated.operator_id} berhasil diperbarui.`);
      setEditTarget(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.update', editTarget.operator_id, err.message);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui profil operator.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleToggleStatus = async (op: Operator) => {
    if (togglingId) return;
    setTogglingId(op.operator_id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await apiClient.toggleOperatorStatus(op.operator_id, !op.is_active);
      await loadOperators();
      setSuccessMsg(`Status ${updated.operator_id} diubah menjadi ${updated.is_active ? 'ACTIVE' : 'SUSPENDED'}.`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.status.update', op.operator_id, err.message);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengubah status operator.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTarget || isRotating) return;
    if (newPwdValue.length < 8 || newPwdValue.length > 128) {
      setErrorMsg('Password baru wajib 8–128 karakter.');
      return;
    }
    setIsRotating(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.rotateOperatorPassword(pwdTarget.operator_id, newPwdValue);
      setSuccessMsg(res.message);
      setPwdTarget(null);
      setNewPwdValue('');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.password.rotate', pwdTarget.operator_id, err.message);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal merotasi password.');
    } finally {
      setIsRotating(false);
    }
  };

  const handleDeleteOperator = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await apiClient.deleteOperator(deleteTarget.operator_id);
      const deletedId = deleteTarget.operator_id;
      if (detailOperatorId === deletedId) setDetailOperatorId(null);
      await loadOperators();
      setSuccessMsg(
        `Operator ${deletedId} dihapus. Riwayat Work Order terdahulu tetap tersimpan untuk arsip.`
      );
      setDeleteTarget(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.delete', deleteTarget.operator_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Operator ${deleteTarget.operator_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      const extraWo = err instanceof ApiError && err.activeWoId ? ` (Active WO: ${err.activeWoId})` : '';
      setErrorMsg(`${err instanceof Error ? err.message : 'Gagal menghapus operator.'}${extraWo}`);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailOperatorId || isAssigningRole) return;
    if (quickAssignScopeType !== 'ORGANIZATION' && !quickAssignScopeId.trim()) {
      setErrorMsg('Scope ID wajib diisi untuk scope selain ORGANIZATION.');
      return;
    }
    setIsAssigningRole(true);
    setErrorMsg(null);
    try {
      await apiClient.assignIamUserRole({
        operatorId: detailOperatorId,
        roleName: quickAssignRoleName,
        scopeType: quickAssignScopeType,
        scopeId: quickAssignScopeType === 'ORGANIZATION' ? null : quickAssignScopeId.trim(),
      });
      setQuickAssignScopeId('');
      await loadOperators();
      await refreshCapabilities();
      setSuccessMsg(`Role ${quickAssignRoleName} berhasil ditugaskan ke ${detailOperatorId}.`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('access_control.manage', detailOperatorId, err.message);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menugaskan role.');
    } finally {
      setIsAssigningRole(false);
    }
  };

  const confirmRevokeRole = async () => {
    if (!revokeAssignmentTarget || isRevokingRole) return;
    setIsRevokingRole(true);
    setErrorMsg(null);
    try {
      await apiClient.revokeIamUserRole({
        id: revokeAssignmentTarget.id,
        operatorId: revokeAssignmentTarget.operator_id,
        roleName: revokeAssignmentTarget.role_name,
        scopeType: revokeAssignmentTarget.scope_type,
        scopeId: revokeAssignmentTarget.scope_id,
      });
      const revoked = revokeAssignmentTarget;
      setRevokeAssignmentTarget(null);
      await loadOperators();
      await refreshCapabilities();
      setSuccessMsg(`Role ${revoked.role_name} dicabut dari ${revoked.operator_id}.`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('access_control.manage', revokeAssignmentTarget.operator_id, err.message);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mencabut role.');
      setRevokeAssignmentTarget(null);
    } finally {
      setIsRevokingRole(false);
    }
  };

  const filteredOperators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return operators.filter((op) => {
      if (roleFilter !== 'ALL') {
        const hasAssigned = assignments.some((a) => a.operator_id === op.operator_id && a.role_name === roleFilter);
        if (op.role !== roleFilter && !hasAssigned) return false;
      }
      if (statusFilter === 'ACTIVE' && !op.is_active) return false;
      if (statusFilter === 'SUSPENDED' && op.is_active) return false;
      if (!q) return true;
      return (
        op.operator_id.toLowerCase().includes(q) ||
        op.name.toLowerCase().includes(q) ||
        op.line_id.toLowerCase().includes(q) ||
        op.role.toLowerCase().includes(q)
      );
    });
  }, [operators, assignments, searchQuery, roleFilter, statusFilter]);

  const detailOperator = useMemo(
    () => (detailOperatorId ? operators.find((o) => o.operator_id === detailOperatorId) ?? null : null),
    [detailOperatorId, operators]
  );

  if (!canRead.canInteract) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses Daftar Operator Dibatasi</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {canRead.reason || 'Daftar akun operator hanya dapat dilihat oleh Admin atau Supervisor dari jaringan lokal pabrik.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Operator Accounts &amp; Hierarki Peran
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Admin dan Supervisor di jaringan lokal dapat menambah atau mengaktifkan akun dengan tingkat akses di bawah perannya. Ubah data, multi-role assignment, hapus akun, dan atur ulang kata sandi tersedia untuk Admin.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setNewOpRole(assignableRoles[assignableRoles.length - 1] || 'OPERATOR');
            setCreateErrors({});
            setIsCreateOpen(true);
          }}
          disabled={!canCreate.canInteract || assignableRoles.length === 0}
          title={!canCreate.canInteract ? canCreate.reason : 'Buat akun operator baru via LAN'}
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Operator</span>
        </Button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Cari operator"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ID, nama, atau line..."
            className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
          <select
            aria-label="Filter peran operator"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Semua Peran</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            {iamRoles
              .filter((r) => !r.is_system)
              .map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name} (Custom)
                </option>
              ))}
          </select>
          <select
            aria-label="Filter status operator"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED')}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
        <span className="text-[11px] text-slate-500">
          Menampilkan {filteredOperators.length} dari {operators.length} operator
        </span>
      </div>

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
              ) : filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada operator yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredOperators.map((op) => {
                  const canManageTarget = canManageTargetRole(currentUser.role, op.role);
                  const isProtectedRoot = Boolean(op.is_protected || op.operator_id === 'ADM-001');
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
                            onClick={() => setDetailOperatorId(op.operator_id)}
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
                                ? `Hierarki peran: ${currentUser.role} tidak dapat mengubah akun ${op.role}`
                                : !rowStatusCap.canInteract
                                ? rowStatusCap.reason
                                : 'Aktifkan/nonaktifkan operator'
                            }
                            onClick={() => handleToggleStatus(op)}
                          >
                            {op.is_active ? 'Suspend' : 'Activate'}
                          </Button>

                          {rowUpdateCap.canInteract && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditTarget(op);
                                setEditName(op.name);
                                setEditRole(op.role);
                                setEditLineId(op.line_id);
                                setEditErrors({});
                              }}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </Button>
                          )}

                          {rowRotatePwdCap.canInteract && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setPwdTarget(op);
                                setNewPwdValue('');
                              }}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Password</span>
                            </Button>
                          )}

                          {rowDeleteCap.canInteract && !isProtectedRoot && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeleteTarget(op)}
                            >
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

      {/* User Detail & Multi-Role Assignment Modal */}
      {detailOperator && (() => {
        const userAssignments = assignments.filter((a) => a.operator_id === detailOperator.operator_id);
        const isProtectedRoot = Boolean(detailOperator.is_protected || detailOperator.operator_id === 'ADM-001');
        return (
          <Modal
            isOpen={true}
            onClose={() => setDetailOperatorId(null)}
            title={`Detail Operator: ${detailOperator.operator_id}`}
            subtitle={`${detailOperator.name} · Primary Role: ${detailOperator.role} · Line: ${detailOperator.line_id}`}
            footer={
              <div className="flex items-center justify-between w-full">
                {canManageIam.canInteract ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/admin/access-control?tab=inspector&operator=${encodeURIComponent(detailOperator.operator_id)}`)
                    }
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Inspeksi Izin Efektif</span>
                  </Button>
                ) : (
                  <span />
                )}
                <Button variant="ghost" onClick={() => setDetailOperatorId(null)}>
                  Tutup
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Operator ID:</span>{' '}
                  <span className="font-mono font-semibold">{detailOperator.operator_id}</span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <Badge variant={detailOperator.is_active ? 'success' : 'danger'}>
                    {detailOperator.is_active ? 'ACTIVE' : 'SUSPENDED'}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500">Primary Role:</span>{' '}
                  <Badge variant="info">{detailOperator.role}</Badge>
                </div>
                <div>
                  <span className="text-slate-500">Line ID:</span>{' '}
                  <span className="font-mono">{detailOperator.line_id}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Dibuat:</span>{' '}
                  <span>{new Date(detailOperator.created_at).toLocaleString()}</span>
                  {isProtectedRoot && (
                    <span className="ml-2">
                      <Badge variant="warning">Akun Root Dilindungi</Badge>
                    </span>
                  )}
                </div>
              </div>

              {canManageIam.canInteract && (
                <>
                  <div className="space-y-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-sky-600" />
                      <span>Penugasan Role IAM ({userAssignments.length})</span>
                    </div>
                    {userAssignments.length === 0 ? (
                      <p className="text-slate-500 italic">
                        Belum ada penugasan eksplisit; memakai primary role ({detailOperator.role}) pada scope ORGANIZATION.
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
                                onClick={() => setRevokeAssignmentTarget(a)}
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
                              {r.name} (Level {r.privilege_level})
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
                        Assign Role ke {detailOperator.operator_id}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Create Operator Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isCreating && setIsCreateOpen(false)}
        title="Tambah Akun Operator Baru"
        subtitle="Kata sandi awal minimal 8 karakter."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Batal
            </Button>
            <Button onClick={handleCreate} isLoading={isCreating}>
              Buat Akun Operator
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Operator ID"
            value={newOpId}
            onChange={(e) => setNewOpId(e.target.value.toUpperCase())}
            placeholder="OP-042"
            error={createErrors.operatorId}
            required
          />
          <Input
            label="Nama Lengkap"
            value={newOpName}
            onChange={(e) => setNewOpName(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            error={createErrors.operatorName}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-operator-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Peran Awal (Dibatasi Hierarki)
              </label>
              <select
                id="create-operator-role"
                value={newOpRole}
                onChange={(e) => setNewOpRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Line ID"
              value={newOpLineId}
              onChange={(e) => setNewOpLineId(e.target.value.toUpperCase())}
              placeholder="LINE-01"
              error={createErrors.lineId}
            />
          </div>
          <Input
            label="Password Awal (8–128 karakter)"
            type="password"
            value={newOpPassword}
            onChange={(e) => setNewOpPassword(e.target.value)}
            placeholder="Minimal 8 karakter"
            error={createErrors.password}
            required
          />
        </form>
      </Modal>

      {/* Edit Operator Modal (ADMIN only) */}
      <Modal
        isOpen={Boolean(editTarget)}
        onClose={() => !isEditing && setEditTarget(null)}
        title={`Edit Operator ${editTarget?.operator_id ?? ''}`}
        subtitle="Perubahan data akun hanya tersedia untuk Admin dari jaringan lokal pabrik. Custom multi-role dikelola via Detail / Access Control."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={isEditing}>
              Batal
            </Button>
            <Button onClick={handleEdit} isLoading={isEditing}>
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Nama Lengkap"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            error={editErrors.operatorName}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-operator-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Peran Sistem (Primary Role)
              </label>
              <select
                id="edit-operator-role"
                value={editRole}
                disabled={Boolean(editTarget?.is_protected || editTarget?.operator_id === 'ADM-001')}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Line ID"
              value={editLineId}
              onChange={(e) => setEditLineId(e.target.value.toUpperCase())}
              error={editErrors.lineId}
            />
          </div>
        </form>
      </Modal>

      {/* Rotate Password Modal (ADMIN only) */}
      <Modal
        isOpen={Boolean(pwdTarget)}
        onClose={() => !isRotating && setPwdTarget(null)}
        title={`Rotasi Password ${pwdTarget?.operator_id ?? ''}`}
        subtitle="Pengaturan ulang kata sandi hanya tersedia untuk Admin dari jaringan lokal pabrik."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setPwdTarget(null)} disabled={isRotating}>
              Batal
            </Button>
            <Button onClick={handleRotatePassword} isLoading={isRotating}>
              Simpan Password Baru
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRotatePassword} className="space-y-4">
          <Input
            label="Password Baru (8–128 karakter)"
            type="password"
            value={newPwdValue}
            onChange={(e) => setNewPwdValue(e.target.value)}
            placeholder="Masukkan password baru yang kuat"
            required
          />
        </form>
      </Modal>

      {/* Delete Operator Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDeleteOperator}
        title={`Hapus Operator ${deleteTarget?.operator_id ?? ''}?`}
        variant="destructive"
        description={`Penghapusan ditolak jika ${deleteTarget?.name} masih menangani Work Order yang sedang aktif.`}
        impacts={[
          'Relasi master pada Work Order, Downtime, Telemetri, dan Event historis akan berubah menjadi null ([dihapus]); riwayat produksi tidak dihapus.',
          'Seluruh penugasan role IAM milik operator ini akan turut dibersihkan.',
          'Akun ADM-001 dilindungi secara permanen dari penghapusan.',
        ]}
        confirmLabel="Ya, Hapus Operator"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />

      {/* Revoke Role Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(revokeAssignmentTarget)}
        onClose={() => !isRevokingRole && setRevokeAssignmentTarget(null)}
        onConfirm={confirmRevokeRole}
        title={`Cabut Role ${revokeAssignmentTarget?.role_name ?? ''}?`}
        variant="destructive"
        description={`Penugasan role ${revokeAssignmentTarget?.role_name ?? ''} pada ${revokeAssignmentTarget?.operator_id ?? ''} akan dicabut.`}
        impacts={['authz_version dinaikkan secara otomatis dan sesi lama dapat berakhir (401).']}
        confirmLabel="Ya, Cabut Role"
        isLoading={isRevokingRole}
      />
    </div>
  );
};
