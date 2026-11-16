import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { IamAssignment } from '../../types/iam';
import { Operator } from '../../types/production';
import { useOperators } from './hooks/useOperators';
import { useOperatorCrud } from './hooks/useOperatorCrud';
import { useOperatorRoleAssignment } from './hooks/useOperatorRoleAssignment';
import { OperatorsTable } from './components/OperatorsTable';
import { OperatorsToolbar } from './components/OperatorsToolbar';
import { OperatorDetailModal } from './components/OperatorDetailModal';
import { OperatorCreateModal } from './components/OperatorCreateModal';
import { OperatorEditModal } from './components/OperatorEditModal';
import { OperatorRotatePasswordModal } from './components/OperatorRotatePasswordModal';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog } from '../../components/ui/ConflictDialog';

/**
 * Page Operator Accounts & Hierarki Peran (R9.5).
 * Hanya orkestrasi: gate kapabilitas, flag open/target, header, banner
 * feedback, komposisi + 2 confirm dialog + ConflictDialog. Daftar + filter
 * di useOperators, mutasi CRUD di useOperatorCrud, assign/revoke role di
 * useOperatorRoleAssignment; tabel/toolbar/modal di components/.
 */
export const OperatorsPage: React.FC = () => {
  const navigate = useNavigate();

  // Open/target flags saja — form state tinggal di dalam modal masing-masing.
  const [detailOperatorId, setDetailOperatorId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Operator | null>(null);
  const [pwdTarget, setPwdTarget] = useState<Operator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);
  const [revokeAssignmentTarget, setRevokeAssignmentTarget] = useState<IamAssignment | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const ops = useOperators({ detailOperatorId });
  const crud = useOperatorCrud({
    loadOperators: ops.loadOperators,
    reportForbidden: ops.reportForbidden,
    refreshCapabilities: ops.refreshCapabilities,
    setFeedback: ops.setFeedback,
    togglingId,
    setTogglingId,
    onOperatorDeleted: (id) => {
      if (detailOperatorId === id) setDetailOperatorId(null);
    },
  });
  const roleAssignment = useOperatorRoleAssignment({
    loadOperators: ops.loadOperators,
    reportForbidden: ops.reportForbidden,
    refreshCapabilities: ops.refreshCapabilities,
    setFeedback: ops.setFeedback,
  });

  const { feedback } = ops;
  const detailOperator = ops.detailOperator;

  if (!ops.canRead.canInteract) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses Daftar Operator Dibatasi</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {ops.canRead.reason || 'Daftar akun operator hanya dapat dilihat oleh Admin atau Supervisor dari jaringan lokal pabrik.'}
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
          onClick={() => setIsCreateOpen(true)}
          disabled={!ops.canCreate.canInteract || ops.assignableRoles.length === 0}
          title={!ops.canCreate.canInteract ? ops.canCreate.reason : 'Buat akun operator baru via LAN'}
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Operator</span>
        </Button>
      </div>

      {feedback?.type === 'error' && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{feedback.msg}</span>
          </div>
          <button type="button" onClick={() => ops.setFeedback(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {feedback?.type === 'success' && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.msg}</span>
          </div>
          <button type="button" onClick={() => ops.setFeedback(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      <OperatorsToolbar
        searchQuery={ops.searchQuery}
        onSearchQueryChange={ops.setSearchQuery}
        roleFilter={ops.roleFilter}
        onRoleFilterChange={ops.setRoleFilter}
        statusFilter={ops.statusFilter}
        onStatusFilterChange={ops.setStatusFilter}
        iamRoles={ops.iamRoles}
        shownCount={ops.filteredOperators.length}
        totalCount={ops.operators.length}
      />

      <OperatorsTable
        operators={ops.filteredOperators}
        assignments={ops.assignments}
        isLoading={ops.isLoading}
        currentUserRole={ops.currentUser.role}
        togglingId={togglingId}
        checkCapability={ops.checkCapability}
        onDetail={setDetailOperatorId}
        onToggle={(op) => void crud.toggleOperatorStatus(op)}
        onEdit={setEditTarget}
        onRotatePwd={setPwdTarget}
        onDelete={setDeleteTarget}
      />

      {detailOperator && (
        <OperatorDetailModal
          key={detailOperator.operator_id}
          operator={detailOperator}
          assignments={ops.assignments}
          iamRoles={ops.iamRoles}
          canManageIam={ops.canManageIam.canInteract}
          isRevokingRole={roleAssignment.isRevokingRole}
          onClose={() => setDetailOperatorId(null)}
          onRevokeRequest={setRevokeAssignmentTarget}
          onAssignRole={(input) => roleAssignment.assignRole(detailOperator.operator_id, input)}
          onInspectPermissions={() =>
            navigate(`/admin/access-control?tab=inspector&operator=${encodeURIComponent(detailOperator.operator_id)}`)
          }
        />
      )}

      <OperatorCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        assignableRoles={ops.assignableRoles}
        onSubmit={crud.createOperator}
      />

      <OperatorEditModal
        operator={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={crud.updateOperator}
      />

      <OperatorRotatePasswordModal
        operator={pwdTarget}
        onClose={() => setPwdTarget(null)}
        onSubmit={crud.rotateOperatorPassword}
      />

      {/* Delete Operator Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !crud.isDeleting && setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void crud.deleteOperator(deleteTarget).finally(() => setDeleteTarget(null));
        }}
        title={`Hapus Operator ${deleteTarget?.operator_id ?? ''}?`}
        variant="destructive"
        description={`Penghapusan ditolak jika ${deleteTarget?.name} masih menangani Work Order yang sedang aktif.`}
        impacts={[
          'Relasi master pada Work Order, Downtime, Telemetri, dan Event historis akan berubah menjadi null ([dihapus]); riwayat produksi tidak dihapus.',
          'Seluruh penugasan role IAM milik operator ini akan turut dibersihkan.',
          'Akun ADM-001 dilindungi secara permanen dari penghapusan.',
        ]}
        confirmLabel="Ya, Hapus Operator"
        isLoading={crud.isDeleting}
      />

      <ConflictDialog conflict={crud.conflictState} onClose={() => crud.setConflictState(null)} />

      {/* Revoke Role Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(revokeAssignmentTarget)}
        onClose={() => !roleAssignment.isRevokingRole && setRevokeAssignmentTarget(null)}
        onConfirm={() => {
          if (!revokeAssignmentTarget) return;
          void roleAssignment.revokeRole(revokeAssignmentTarget).finally(() => setRevokeAssignmentTarget(null));
        }}
        title={`Cabut Role ${revokeAssignmentTarget?.role_name ?? ''}?`}
        variant="destructive"
        description={`Penugasan role ${revokeAssignmentTarget?.role_name ?? ''} pada ${revokeAssignmentTarget?.operator_id ?? ''} akan dicabut.`}
        impacts={['authz_version dinaikkan secara otomatis dan sesi lama dapat berakhir (401).']}
        confirmLabel="Ya, Cabut Role"
        isLoading={roleAssignment.isRevokingRole}
      />
    </div>
  );
};
