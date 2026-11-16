import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Plus,
  Edit3,
  Trash2,
  Link2,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { telemetrySocket } from '../../services/ws/telemetrySocket';
import { Machine, EdgeDevice } from '../../types/assets';
import { ApiError } from '../../types/auth';
import { useCapability, useAuth } from '../../context/AuthContext';
import { validateMachineInput } from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { CursorPaginationBar } from '../../components/industrial/CursorPaginationBar';
import { MachineDetailModal } from './MachineDetailModal';

interface FeedbackState {
  type: 'success' | 'error';
  msg: string;
  activeWoId?: string;
  conflictMachineForUnbind?: Machine;
}

export const MachinesPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const canManage = useCapability('machine.manage');

  const [machines, setMachines] = useState<Machine[]>([]);
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [bindingFilter, setBindingFilter] = useState<'ALL' | 'BOUND' | 'UNBOUND'>('ALL');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Machine Detail Modal
  const [detailMachineId, setDetailMachineId] = useState<string | null>(null);

  // Create Modal (default modbusSlaveId = 1 per spec)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMachineId, setNewMachineId] = useState('CNC-MILLING-03');
  const [newName, setNewName] = useState('');
  const [newSlaveId, setNewSlaveId] = useState(1);
  const [newBindDeviceId, setNewBindDeviceId] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit Modal (name & modbus_slave_id only; device relation immutable here)
  const [editTarget, setEditTarget] = useState<Machine | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlaveId, setEditSlaveId] = useState(1);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Bind Device Modal + Explicit Confirmation
  const [bindTarget, setBindTarget] = useState<Machine | null>(null);
  const [selectedBindDeviceId, setSelectedBindDeviceId] = useState('');
  const [bindSubmitError, setBindSubmitError] = useState<string | null>(null);
  const [bindConfirmTarget, setBindConfirmTarget] = useState<{ machine: Machine; deviceId: string } | null>(null);
  const [isBinding, setIsBinding] = useState(false);

  // Unbind Confirmation Dialog
  const [unbindTarget, setUnbindTarget] = useState<Machine | null>(null);
  const [isUnbinding, setIsUnbinding] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const loadData = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const [mPage, devList] = await Promise.all([
          apiClient.getMachinesPage({ cursor: cursor ?? undefined, limit: pageLimit }),
          apiClient.getDevices(),
        ]);
        setMachines((prev) => (append ? [...prev, ...mPage.data] : mPage.data));
        setTotalCount((prev) => mPage.pagination.total_count ?? (append ? prev + mPage.data.length : mPage.data.length));
        setHasMore(mPage.pagination.has_more);
        setNextCursor(mPage.pagination.next_cursor);
        setDevices(devList);
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar mesin.' });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pageLimit]
  );

  useEffect(() => {
    loadData(null, false);
    const unsub = telemetrySocket.subscribe((event) => {
      if (
        event.type === 'MACHINE_CREATED' ||
        event.type === 'MACHINE_UPDATED' ||
        event.type === 'MACHINE_DELETED' ||
        event.type === 'MACHINE_BOUND' ||
        event.type === 'MACHINE_UNBOUND' ||
        event.type === 'DEVICE_EVENT'
      ) {
        loadData(null, false);
      }
    });
    return () => unsub();
  }, [loadData]);

  const mapApiIssuesToErrors = (err: unknown): Record<string, string> => {
    if (err instanceof ApiError && Array.isArray(err.issues)) {
      const mapped: Record<string, string> = {};
      for (const issue of err.issues) {
        if (issue.field) mapped[issue.field] = issue.message;
      }
      return mapped;
    }
    return {};
  };

  const unboundDevices = devices.filter((d) => !d.bound_machine_id);
  const boundMachinesCount = machines.filter((m) => Boolean(m.bound_device_id)).length;
  const unboundMachinesCount = machines.length - boundMachinesCount;
  const filteredMachines = machines.filter((m) => {
    if (bindingFilter === 'BOUND') return Boolean(m.bound_device_id);
    if (bindingFilter === 'UNBOUND') return !m.bound_device_id;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateMachineInput({
      machineId: newMachineId,
      machineName: newName,
      modbusSlaveId: Number(newSlaveId),
      boundDeviceId: newBindDeviceId || null,
      isCreate: true,
    });
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    setIsCreating(true);
    setCreateSubmitError(null);
    setFeedback(null);
    try {
      const created = await apiClient.createMachine({
        machine_id: newMachineId.trim(),
        name: newName.trim(),
        modbus_slave_id: Number(newSlaveId),
        bound_device_id: newBindDeviceId || null,
      });
      await loadData(null, false);
      setFeedback({ type: 'success', msg: `Mesin ${created.machine_id} (${created.name}) berhasil dibuat.` });
      setIsCreateOpen(false);
      setNewMachineId('CNC-MILLING-03');
      setNewName('');
      setNewSlaveId(1);
      setNewBindDeviceId('');
      setCreateErrors({});
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', newMachineId, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
      }
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) setCreateErrors(fieldErrs);
      setCreateSubmitError(err?.message || 'Gagal membuat mesin baru.');
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat mesin baru.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const errs = validateMachineInput({
      machineName: editName,
      modbusSlaveId: Number(editSlaveId),
      isCreate: false,
    });
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setIsUpdating(true);
    setEditSubmitError(null);
    setFeedback(null);
    try {
      await apiClient.updateMachine(editTarget.machine_id, {
        name: editName.trim(),
        modbus_slave_id: Number(editSlaveId),
      });
      await loadData(null, false);
      setFeedback({ type: 'success', msg: `Mesin ${editTarget.machine_id} berhasil diperbarui.` });
      setEditTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', editTarget.machine_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
      }
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) setEditErrors(fieldErrs);
      setEditSubmitError(err?.message || 'Gagal memperbarui mesin.');
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memperbarui mesin.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenBindModal = (machine: Machine) => {
    setBindTarget(machine);
    setSelectedBindDeviceId(unboundDevices[0]?.device_id || '');
    setBindSubmitError(null);
  };

  const handleRequestBindConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindTarget || !selectedBindDeviceId) return;
    setBindConfirmTarget({ machine: bindTarget, deviceId: selectedBindDeviceId });
  };

  const handleConfirmBindDevice = async () => {
    if (!bindConfirmTarget) return;
    const { machine, deviceId } = bindConfirmTarget;
    setIsBinding(true);
    setBindSubmitError(null);
    setFeedback(null);
    try {
      await apiClient.bindDevice(machine.machine_id, { device_id: deviceId });
      await loadData(null, false);
      setFeedback({
        type: 'success',
        msg: `Edge device ${deviceId} berhasil diikatkan ke ${machine.machine_id}.`,
      });
      setBindConfirmTarget(null);
      setBindTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', machine.machine_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
      }
      setBindConfirmTarget(null);
      setBindSubmitError(err?.message || 'Gagal melakukan binding device.');
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal melakukan binding device.',
        conflictMachineForUnbind:
          err instanceof ApiError && err.code === 'MACHINE_ALREADY_BOUND' ? machine : undefined,
      });
    } finally {
      setIsBinding(false);
    }
  };

  const handleConfirmUnbindDevice = async () => {
    if (!unbindTarget) return;
    setIsUnbinding(true);
    setFeedback(null);
    try {
      const targetId = unbindTarget.machine_id;
      await apiClient.unbindDevice(targetId);
      await loadData(null, false);
      setFeedback({
        type: 'success',
        msg: `Ikatan edge device dari mesin ${targetId} berhasil dilepas.`,
      });
      setUnbindTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', unbindTarget.machine_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Melepas Device dari ${unbindTarget.machine_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal melepas ikatan device.',
        activeWoId: err?.activeWoId,
      });
      setUnbindTarget(null);
    } finally {
      setIsUnbinding(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      const targetId = deleteTarget.machine_id;
      await apiClient.deleteMachine(targetId);
      if (detailMachineId === targetId) setDetailMachineId(null);
      await loadData(null, false);
      setFeedback({
        type: 'success',
        msg: `Mesin ${targetId} dihapus. Riwayat Work Order, telemetri, downtime, & event tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', deleteTarget.machine_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Mesin ${deleteTarget.machine_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal menghapus mesin.',
        activeWoId: err?.activeWoId,
      });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

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
            onClick={() => {
              setCreateErrors({});
              setCreateSubmitError(null);
              setIsCreateOpen(true);
            }}
            disabled={!canManage.canInteract}
            title={!canManage.canInteract ? canManage.reason : 'Tambah mesin produksi baru'}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Mesin</span>
          </Button>
        </div>
      </div>

      {/* Binding Status Filter Bar + Unbound Device Inventory Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status binding mesin">
          <button
            type="button"
            onClick={() => setBindingFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              bindingFilter === 'ALL'
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Semua Mesin ({machines.length})
          </button>
          <button
            type="button"
            onClick={() => setBindingFilter('BOUND')}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              bindingFilter === 'BOUND'
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Terikat Device ({boundMachinesCount})
          </button>
          <button
            type="button"
            onClick={() => setBindingFilter('UNBOUND')}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              bindingFilter === 'UNBOUND'
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Unbound ({unboundMachinesCount})
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-tabular">
          Device tersedia untuk binding:{' '}
          <strong className="text-slate-800 dark:text-slate-200">{unboundDevices.length}</strong>
        </div>
      </div>

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
                  setBindTarget(null);
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Machine ID &amp; Nama</th>
                <th className="py-3 px-4">Modbus Slave</th>
                <th className="py-3 px-4">Edge Device Terikat</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Memuat data mesin...
                  </td>
                </tr>
              ) : filteredMachines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Tidak ada mesin pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredMachines.map((m) => {
                  const rowManageCap = checkCapability('machine.manage', m.machine_id);
                  return (
                    <tr key={m.machine_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</div>
                        <div className="text-[11px] font-tabular text-slate-500">{m.machine_id}</div>
                      </td>
                      <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                        <Badge variant="neutral">Slave #{m.modbus_slave_id}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {m.bound_device_id ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-tabular text-xs">
                              <Cpu className="w-3.5 h-3.5" />
                              <span>{m.bound_device_id}</span>
                            </div>
                            {m.boundDevice && (
                              <div className="text-[11px] font-tabular text-slate-400">
                                {m.boundDevice.mac_address} · {m.boundDevice.online ? 'ONLINE' : 'OFFLINE'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="neutral">Unbound</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Detail mesin ${m.machine_id}`}
                            onClick={() => setDetailMachineId(m.machine_id)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </Button>
                          {m.bound_device_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!rowManageCap.canInteract}
                              aria-label={`Unbind device dari ${m.machine_id}`}
                              title={!rowManageCap.canInteract ? rowManageCap.reason : 'Lepas ikatan device dari mesin'}
                              onClick={() => setUnbindTarget(m)}
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              <span>Unbind</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!rowManageCap.canInteract || unboundDevices.length === 0}
                              aria-label={`Bind device ke ${m.machine_id}`}
                              title={
                                !rowManageCap.canInteract
                                  ? rowManageCap.reason
                                  : unboundDevices.length === 0
                                  ? 'Semua perangkat sudah terikat'
                                  : 'Ikatkan ke Edge Device STM32'
                              }
                              onClick={() => handleOpenBindModal(m)}
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Bind Device</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!rowManageCap.canInteract}
                            aria-label={`Edit mesin ${m.machine_id}`}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah nama / Modbus Slave ID'}
                            onClick={() => {
                              setEditTarget(m);
                              setEditName(m.name);
                              setEditSlaveId(m.modbus_slave_id);
                              setEditErrors({});
                              setEditSubmitError(null);
                            }}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!rowManageCap.canInteract}
                            aria-label={`Hapus mesin ${m.machine_id}`}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus mesin'}
                            onClick={() => setDeleteTarget(m)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Mesin Produksi Baru"
        subtitle="ID Mesin harus diawali 'CNC-' diikuti huruf besar, angka, atau tanda hubung (contoh: CNC-MILLING-03)."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Batal
            </Button>
            <Button onClick={handleCreate} isLoading={isCreating}>
              Buat Mesin
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createSubmitError && (
            <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
              {createSubmitError}
            </div>
          )}
          <Input
            label="Machine ID"
            value={newMachineId}
            onChange={(e) => setNewMachineId(e.target.value.toUpperCase())}
            placeholder="CNC-MILLING-03"
            error={createErrors.machineId}
            required
          />
          <Input
            label="Nama Mesin"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Contoh: Mazak 5-Axis Milling C"
            error={createErrors.machineName}
            required
          />
          <Input
            label="Modbus Slave ID (1–247)"
            type="number"
            min={1}
            max={247}
            value={newSlaveId}
            onChange={(e) => setNewSlaveId(Number(e.target.value))}
            error={createErrors.modbusSlaveId}
            required
          />
          <div>
            <label
              htmlFor="create-bind-device-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Bind Edge Device Awal (Opsional)
            </label>
            <select
              id="create-bind-device-select"
              value={newBindDeviceId}
              onChange={(e) => setNewBindDeviceId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="">-- Tanpa binding (Unbound) --</option>
              {unboundDevices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id} ({d.ip_address ?? d.mac_address})
                </option>
              ))}
            </select>
            {createErrors.boundDeviceId && (
              <p className="text-xs text-red-600 mt-1">{createErrors.boundDeviceId}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* Edit Machine Modal */}
      <Modal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Edit Mesin ${editTarget?.machine_id ?? ''}`}
        subtitle="Perbarui nama mesin atau Modbus Slave ID. Perubahan relasi device hanya melalui Bind / Unbind."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={isUpdating}>
              Batal
            </Button>
            <Button onClick={handleUpdate} isLoading={isUpdating}>
              Simpan
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {editSubmitError && (
            <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
              {editSubmitError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Machine ID (Immutable)"
              value={editTarget?.machine_id ?? ''}
              disabled
              readOnly
            />
            <Input
              label="Edge Device Terikat (Read-Only)"
              value={editTarget?.bound_device_id ?? 'Unbound'}
              disabled
              readOnly
            />
          </div>
          <Input
            label="Nama Mesin"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            error={editErrors.machineName}
            required
          />
          <Input
            label="Modbus Slave ID (1–247)"
            type="number"
            min={1}
            max={247}
            value={editSlaveId}
            onChange={(e) => setEditSlaveId(Number(e.target.value))}
            error={editErrors.modbusSlaveId}
            required
          />
        </form>
      </Modal>

      {/* Bind Device Selection Modal */}
      <Modal
        isOpen={Boolean(bindTarget)}
        onClose={() => setBindTarget(null)}
        title={`Pasang Perangkat Sensor ke ${bindTarget?.machine_id ?? ''}`}
        subtitle="Pilih perangkat sensor unbound yang akan dihubungkan secara 1:1 ke mesin ini."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setBindTarget(null)} disabled={isBinding}>
              Batal
            </Button>
            <Button
              onClick={handleRequestBindConfirmation}
              isLoading={isBinding}
              disabled={!selectedBindDeviceId}
            >
              Lanjut Konfirmasi Bind
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRequestBindConfirmation} className="space-y-4">
          {bindSubmitError && (
            <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
              {bindSubmitError}
            </div>
          )}
          <div>
            <label
              htmlFor="bind-device-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Pilih STM32 Edge Controller (Unbound)
            </label>
            <select
              id="bind-device-select"
              value={selectedBindDeviceId}
              onChange={(e) => setSelectedBindDeviceId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              {unboundDevices.length === 0 ? (
                <option value="">-- Tidak ada perangkat unbound tersedia --</option>
              ) : (
                unboundDevices.map((d) => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.device_id} ({d.model || 'STM32'} · {d.mac_address})
                  </option>
                ))
              )}
            </select>
          </div>
        </form>
      </Modal>

      {/* Bind Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(bindConfirmTarget)}
        onClose={() => setBindConfirmTarget(null)}
        onConfirm={handleConfirmBindDevice}
        title={`Konfirmasi Binding ${bindConfirmTarget?.deviceId ?? ''} → ${bindConfirmTarget?.machine.machine_id ?? ''}?`}
        variant="standard"
        description={`Perangkat ${bindConfirmTarget?.deviceId ?? ''} akan dihubungkan secara eksklusif (1:1) ke mesin ${bindConfirmTarget?.machine.name ?? ''}.`}
        impacts={[
          'Telemetri langsung dari perangkat akan mulai diarahkan ke mesin ini.',
          'Operasi ini mencatat event MACHINE_BOUND di Audit Trail dan Operational Events.',
        ]}
        confirmLabel="Ya, Ikatkan Perangkat"
        isLoading={isBinding}
      />

      {/* Unbind Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(unbindTarget)}
        onClose={() => setUnbindTarget(null)}
        onConfirm={handleConfirmUnbindDevice}
        title={`Lepas Ikatan ${unbindTarget?.bound_device_id ?? ''} dari ${unbindTarget?.machine_id ?? ''}?`}
        variant="destructive"
        description={`Pemutusan hubungan device-machine ditolak jika mesin masih menjalankan Work Order ACTIVE atau PENDING.`}
        impacts={[
          `Perangkat ${unbindTarget?.bound_device_id ?? ''} akan kembali ke status Unbound dan dapat dipasang ke mesin lain.`,
          'Riwayat telemetri, downtime, dan operational events sebelumnya tetap tersimpan.',
        ]}
        confirmLabel="Ya, Lepas Ikatan (Unbind)"
        isLoading={isUnbinding}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteMachine}
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
        onRequestBind={(machine) => handleOpenBindModal(machine)}
        onRequestUnbind={(machine) => setUnbindTarget(machine)}
      />
    </div>
  );
};

