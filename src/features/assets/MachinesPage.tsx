import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, AlertTriangle, Unlink, RefreshCw } from 'lucide-react';
import { Machine } from '../../types/assets';
import { useCapability, useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { CursorPaginationBar } from '../../components/industrial/CursorPaginationBar';
import { useMachines } from './hooks/useMachines';
import { useMachineCrud } from './hooks/useMachineCrud';
import { useMachineBinding } from './hooks/useMachineBinding';
import { MachinesTable } from './components/MachinesTable';
import { MachineCreateModal } from './components/MachineCreateModal';
import { MachineEditModal } from './components/MachineEditModal';
import { MachineBindModal } from './components/MachineBindModal';
import { MachineFilterBar } from './components/MachineFilterBar';
import { MachineDetailModal } from './components/MachineDetailModal';

export const MachinesPage: React.FC = () => {
  const { checkCapability } = useAuth();
  const canManage = useCapability('machine.manage');

  const {
    machines,
    bindingFilter,
    setBindingFilter,
    totalCount,
    hasMore,
    nextCursor,
    pageLimit,
    setPageLimit,
    isLoading,
    isLoadingMore,
    feedback,
    setFeedback,
    loadData,
    unboundDevices,
    boundMachinesCount,
    unboundMachinesCount,
    filteredMachines,
  } = useMachines();

  // Machine Detail Modal
  const [detailMachineId, setDetailMachineId] = useState<string | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Edit Modal (name & modbus_slave_id only; device relation immutable here)
  const [editTarget, setEditTarget] = useState<Machine | null>(null);

  // Unbind Confirmation Dialog
  const [unbindTarget, setUnbindTarget] = useState<Machine | null>(null);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const { createMachine, updateMachine, deleteMachine, isDeleting } = useMachineCrud({
    loadData,
    setFeedback,
    setConflictState,
    onMachineDeleted: (machineId) => {
      if (detailMachineId === machineId) setDetailMachineId(null);
    },
  });

  const binding = useMachineBinding({
    loadData,
    setFeedback,
    setConflictState,
    unboundDevices,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Physical Machines &amp; Device Binding
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar unit mesin produksi, nomor identifikasi Modbus (1–247), serta relasi 1:1 dengan perangkat sensor lini.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => loadData(null, false)} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            disabled={!canManage.canInteract}
            title={!canManage.canInteract ? canManage.reason : 'Tambah mesin produksi baru'}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Mesin</span>
          </Button>
        </div>
      </div>

      {/* Binding Status Filter Bar + Unbound Device Inventory Summary */}
      <MachineFilterBar
        bindingFilter={bindingFilter}
        onBindingFilterChange={setBindingFilter}
        totalMachines={machines.length}
        boundMachinesCount={boundMachinesCount}
        unboundMachinesCount={unboundMachinesCount}
        unboundDevicesCount={unboundDevices.length}
      />

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
            {feedback.activeWoId && (
              <Link
                to={`/admin/work-orders?wo_id=${encodeURIComponent(feedback.activeWoId)}`}
                className="font-semibold underline text-red-700 dark:text-red-300 ml-1"
              >
                Lihat Work Order {feedback.activeWoId} →
              </Link>
            )}
            {feedback.conflictMachineForUnbind && canManage.canInteract && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  binding.setBindTarget(null);
                  setUnbindTarget(feedback.conflictMachineForUnbind ?? null);
                }}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Unbind Dulu</span>
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup notifikasi"
            className="font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <MachinesTable
        machines={filteredMachines}
        isLoading={isLoading}
        unboundDevices={unboundDevices}
        checkCapability={checkCapability}
        onDetail={setDetailMachineId}
        onBind={binding.handleOpenBindModal}
        onUnbind={setUnbindTarget}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
      />

      <CursorPaginationBar
        loadedCount={machines.length}
        totalCount={totalCount}
        hasMore={hasMore}
        nextCursor={nextCursor}
        pageLimit={pageLimit}
        onPageLimitChange={(l) => setPageLimit(l)}
        onLoadMore={() => loadData(nextCursor, true)}
        onReset={() => loadData(null, false)}
        isLoading={isLoadingMore}
        hasActiveCursor={machines.length > pageLimit}
      />

      {/* Create Machine Modal */}
      <MachineCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        unboundDevices={unboundDevices}
        onSubmit={createMachine}
      />

      {/* Edit Machine Modal */}
      <MachineEditModal
        machine={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={updateMachine}
      />

      {/* Bind Device Selection Modal + Bind Confirmation Dialog */}
      <MachineBindModal
        machine={binding.bindTarget}
        unboundDevices={unboundDevices}
        selectedDeviceId={binding.selectedBindDeviceId}
        onSelectDevice={binding.setSelectedBindDeviceId}
        bindSubmitError={binding.bindSubmitError}
        bindConfirmTarget={binding.bindConfirmTarget}
        isBinding={binding.isBinding}
        onClose={binding.handleCloseBindModal}
        onRequestConfirm={binding.handleRequestBindConfirmation}
        onCloseConfirm={() => binding.setBindConfirmTarget(null)}
        onConfirm={binding.handleConfirmBindDevice}
      />

      {/* Unbind Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(unbindTarget)}
        onClose={() => setUnbindTarget(null)}
        onConfirm={async () => {
          if (!unbindTarget) return;
          await binding.handleConfirmUnbindDevice(unbindTarget);
          setUnbindTarget(null);
        }}
        title={`Lepas Ikatan ${unbindTarget?.bound_device_id ?? ''} dari ${unbindTarget?.machine_id ?? ''}?`}
        variant="destructive"
        description={`Pemutusan hubungan device-machine ditolak jika mesin masih menjalankan Work Order ACTIVE atau PENDING.`}
        impacts={[
          `Perangkat ${unbindTarget?.bound_device_id ?? ''} akan kembali ke status Unbound dan dapat dipasang ke mesin lain.`,
          'Riwayat telemetri, downtime, dan operational events sebelumnya tetap tersimpan.',
        ]}
        confirmLabel="Ya, Lepas Ikatan (Unbind)"
        isLoading={binding.isUnbinding}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMachine(deleteTarget);
          setDeleteTarget(null);
        }}
        title={`Hapus Mesin ${deleteTarget?.machine_id ?? ''}?`}
        variant="destructive"
        description={`Penghapusan ditolak jika mesin masih memiliki Work Order aktif, antrean menunggu, atau kejadian henti mesin yang sedang berlangsung.`}
        impacts={[
          'Relasi master pada Work Order, Downtime, Telemetri, dan Event historis akan berubah menjadi null ([dihapus]); riwayat produksi tidak dihapus.',
          'Membutuhkan peran ADMIN melalui jaringan lokal pabrik.',
        ]}
        confirmLabel="Ya, Hapus Mesin"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />

      {/* Machine Detail Modal */}
      <MachineDetailModal
        machineId={detailMachineId}
        onClose={() => setDetailMachineId(null)}
        canManage={canManage.canInteract}
        manageDisabledReason={canManage.reason}
        hasUnboundDevices={unboundDevices.length > 0}
        onRequestBind={(machine) => binding.handleOpenBindModal(machine)}
        onRequestUnbind={(machine) => setUnbindTarget(machine)}
      />
    </div>
  );
};
