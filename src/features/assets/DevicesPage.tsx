import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Plus,
  Activity,
  Edit3,
  Trash2,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { telemetrySocket } from '../../services/ws/telemetrySocket';
import { EdgeDevice } from '../../types/assets';
import { ApiError } from '../../types/auth';
import { useCapability, useAuth } from '../../context/AuthContext';
import { validateDeviceInput } from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { DeviceHealthDrawer } from './DeviceHealthDrawer';
import { DeviceDetailModal } from './DeviceDetailModal';

interface FeedbackState {
  type: 'success' | 'error';
  msg: string;
  activeWoId?: string;
}

export const DevicesPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const canManage = useCapability('device.manage');

  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [bindingFilter, setBindingFilter] = useState<'ALL' | 'BOUND' | 'UNBOUND'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHealthDevice, setSelectedHealthDevice] = useState<EdgeDevice | null>(null);
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null);

  // Register Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('STM32-OEE-06');
  const [newModel, setNewModel] = useState('STM32H743-Edge-Pro');
  const [newSerial, setNewSerial] = useState('');
  const [newMac, setNewMac] = useState('');
  const [newIp, setNewIp] = useState('');
  const [newFirmware, setNewFirmware] = useState('v2.4.1-rtos');
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [registerSubmitError, setRegisterSubmitError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Edit Modal (only ip_address & firmware_version editable; device_id & mac_address immutable)
  const [editTarget, setEditTarget] = useState<EdgeDevice | null>(null);
  const [editIp, setEditIp] = useState('');
  const [editFirmware, setEditFirmware] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<EdgeDevice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiClient.getDevices();
      setDevices(list);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar perangkat edge.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const unsub = telemetrySocket.subscribe((event) => {
      if (
        event.type === 'MACHINE_BOUND' ||
        event.type === 'MACHINE_UNBOUND' ||
        event.type === 'MACHINE_UPDATED' ||
        event.type === 'MACHINE_DELETED' ||
        event.type === 'DEVICE_EVENT' ||
        event.type === 'DEVICE_STATUS_UPDATE'
      ) {
        loadDevices();
      }
    });
    return () => unsub();
  }, [loadDevices]);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateDeviceInput({
      deviceId: newDeviceId,
      macAddress: newMac,
      ipAddress: newIp || undefined,
      firmwareVersion: newFirmware || undefined,
      isCreate: true,
    });
    if (Object.keys(errs).length > 0) {
      setRegisterErrors(errs);
      return;
    }

    setIsRegistering(true);
    setRegisterSubmitError(null);
    setFeedback(null);
    try {
      const created = await apiClient.registerDevice({
        device_id: newDeviceId.trim(),
        model: newModel.trim() || 'STM32H743-Edge-Pro',
        serial_number: newSerial.trim() || newDeviceId.trim(),
        mac_address: newMac.trim(),
        ip_address: newIp.trim() || null,
        firmware_version: newFirmware.trim() || null,
      });
      await loadDevices();
      setFeedback({ type: 'success', msg: `Perangkat edge ${created.device_id} berhasil diregistrasi.` });
      setIsRegisterOpen(false);
      setNewDeviceId('STM32-OEE-06');
      setNewSerial('');
      setNewMac('');
      setNewIp('');
      setRegisterErrors({});
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('device.manage', newDeviceId, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadDevices();
      }
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setRegisterErrors(fieldErrs);
      }
      setRegisterSubmitError(err?.message || 'Gagal mendaftarkan perangkat.');
      setFeedback({ type: 'error', msg: err?.message || 'Gagal mendaftarkan perangkat.' });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const errs = validateDeviceInput({
      ipAddress: editIp || undefined,
      firmwareVersion: editFirmware || undefined,
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
      const updated = await apiClient.updateDevice(editTarget.device_id, {
        ip_address: editIp.trim() || null,
        firmware_version: editFirmware.trim() || null,
      });
      await loadDevices();
      setFeedback({ type: 'success', msg: `Konfigurasi perangkat ${updated.device_id} diperbarui.` });
      setEditTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('device.manage', editTarget.device_id, err.message);
      }
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setEditErrors(fieldErrs);
      }
      setEditSubmitError(err?.message || 'Gagal memperbarui perangkat.');
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memperbarui perangkat.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      const targetId = deleteTarget.device_id;
      await apiClient.deleteDevice(targetId);
      if (selectedHealthDevice?.device_id === targetId) setSelectedHealthDevice(null);
      if (detailDeviceId === targetId) setDetailDeviceId(null);
      await loadDevices();
      setFeedback({
        type: 'success',
        msg: `Perangkat ${targetId} dihapus. Riwayat pemantauan & henti mesin tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('device.manage', deleteTarget.device_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadDevices();
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Perangkat ${deleteTarget.device_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal menghapus perangkat.',
        activeWoId: err?.activeWoId,
      });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const boundCount = devices.filter((d) => Boolean(d.bound_machine_id)).length;
  const unboundCount = devices.length - boundCount;
  const filteredDevices = devices.filter((d) => {
    if (bindingFilter === 'BOUND') return Boolean(d.bound_machine_id);
    if (bindingFilter === 'UNBOUND') return !d.bound_machine_id;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Edge Devices (STM32 Controllers)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar perangkat sensor lini produksi, status koneksi jaringan, ikatan mesin (1:1), dan diagnostik kesehatan perangkat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={loadDevices} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setRegisterErrors({});
              setRegisterSubmitError(null);
              setIsRegisterOpen(true);
            }}
            disabled={!canManage.canInteract}
            title={!canManage.canInteract ? canManage.reason : 'Registrasi perangkat STM32 baru'}
          >
            <Plus className="w-4 h-4" />
            <span>Registrasi Edge Device</span>
          </Button>
        </div>
      </div>

      {/* Binding Status Filter Bar */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status binding device">
        <button
          type="button"
          onClick={() => setBindingFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
            bindingFilter === 'ALL'
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          Semua Device ({devices.length})
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
          Terikat Mesin ({boundCount})
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
          Unbound / Tersedia ({unboundCount})
        </button>
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
                <th className="py-3 px-4">Device ID &amp; Hardware</th>
                <th className="py-3 px-4">MAC / IP Address</th>
                <th className="py-3 px-4">Firmware</th>
                <th className="py-3 px-4">Konektivitas</th>
                <th className="py-3 px-4">Bound Machine</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat perangkat edge...
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada perangkat edge pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((dev) => {
                  const rowManageCap = checkCapability('device.manage', dev.device_id);
                  return (
                    <tr key={dev.device_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 font-tabular">
                          <Cpu className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>{dev.device_id}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-6">
                          {dev.model || 'STM32H743'} · SN: {dev.serial_number}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                        <div>{dev.mac_address}</div>
                        <div className="text-[11px] text-slate-500">{dev.ip_address ?? '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                        {dev.firmware_version ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={dev.online ? 'success' : 'danger'}>
                            {dev.online ? (
                              <span className="inline-flex items-center gap-1">
                                <Wifi className="w-3 h-3" /> ONLINE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <WifiOff className="w-3 h-3" /> OFFLINE
                              </span>
                            )}
                          </Badge>
                        </div>
                        <div className="text-[11px] font-tabular text-slate-400 mt-1">
                          {dev.last_seen ? new Date(dev.last_seen).toLocaleString() : 'Belum ada data'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {dev.bound_machine_id ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {dev.boundMachine?.name || dev.bound_machine_name || dev.bound_machine_id}
                            </div>
                            <div className="text-[11px] font-tabular text-slate-400">{dev.bound_machine_id}</div>
                          </div>
                        ) : (
                          <Badge variant="neutral">Unbound</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Detail perangkat ${dev.device_id}`}
                            onClick={() => setDetailDeviceId(dev.device_id)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Health perangkat ${dev.device_id}`}
                            onClick={() => setSelectedHealthDevice(dev)}
                          >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Health</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!rowManageCap.canInteract}
                            aria-label={`Edit perangkat ${dev.device_id}`}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah IP / Firmware'}
                            onClick={() => {
                              setEditTarget(dev);
                              setEditIp(dev.ip_address ?? '');
                              setEditFirmware(dev.firmware_version ?? '');
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
                            aria-label={`Hapus perangkat ${dev.device_id}`}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus perangkat'}
                            onClick={() => setDeleteTarget(dev)}
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

      {/* Register Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Registrasi Edge Controller STM32 Baru"
        subtitle="ID Perangkat harus diawali 'STM32-' (contoh: STM32-OEE-06) dengan alamat MAC EUI-48 yang unik."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setIsRegisterOpen(false)} disabled={isRegistering}>
              Batal
            </Button>
            <Button onClick={handleRegister} isLoading={isRegistering}>
              Daftarkan Perangkat
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRegister} className="space-y-4">
          {registerSubmitError && (
            <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
              {registerSubmitError}
            </div>
          )}
          <Input
            label="Device ID"
            value={newDeviceId}
            onChange={(e) => setNewDeviceId(e.target.value)}
            placeholder="STM32-OEE-06"
            error={registerErrors.deviceId}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Model Hardware"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="STM32H743-Edge-Pro"
            />
            <Input
              label="Serial Number"
              value={newSerial}
              onChange={(e) => setNewSerial(e.target.value)}
              placeholder="SN-STM32H7-2026-06"
            />
          </div>
          <Input
            label="MAC Address (EUI-48)"
            value={newMac}
            onChange={(e) => setNewMac(e.target.value.toUpperCase())}
            placeholder="00:08:DC:55:01:0A"
            error={registerErrors.macAddress}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="IP Address (Opsional)"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="192.168.10.26"
              error={registerErrors.ipAddress}
            />
            <Input
              label="Firmware Version (Opsional)"
              value={newFirmware}
              onChange={(e) => setNewFirmware(e.target.value)}
              placeholder="v2.4.1-rtos"
              error={registerErrors.firmwareVersion}
            />
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Edit Perangkat ${editTarget?.device_id ?? ''}`}
        subtitle="Hanya IP Address dan Firmware Version yang dapat diperbarui; Device ID & MAC Address bersifat immutable."
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
              label="Device ID (Immutable)"
              value={editTarget?.device_id ?? ''}
              disabled
              readOnly
            />
            <Input
              label="MAC Address (Immutable)"
              value={editTarget?.mac_address ?? ''}
              disabled
              readOnly
            />
          </div>
          <Input
            label="IP Address"
            value={editIp}
            onChange={(e) => setEditIp(e.target.value)}
            placeholder="192.168.10.26"
            error={editErrors.ipAddress}
          />
          <Input
            label="Firmware Version"
            value={editFirmware}
            onChange={(e) => setEditFirmware(e.target.value)}
            placeholder="v2.4.2-rtos"
            error={editErrors.firmwareVersion}
          />
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Hapus Perangkat ${deleteTarget?.device_id ?? ''}?`}
        variant="destructive"
        description={`Penghapusan perangkat tidak dapat dilakukan jika mesin yang terhubung masih menjalankan Work Order aktif atau menunggu.`}
        impacts={[
          'Relasi master pada Work Order, Downtime, Telemetri, dan Event historis akan berubah menjadi null ([dihapus]); riwayat produksi tidak dihapus.',
          'Membutuhkan peran ADMIN melalui jaringan lokal pabrik.',
        ]}
        confirmLabel="Ya, Hapus Perangkat"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />

      {/* Device Detail Modal */}
      <DeviceDetailModal
        deviceId={detailDeviceId}
        onClose={() => setDetailDeviceId(null)}
        onOpenHealth={(dev) => setSelectedHealthDevice(dev)}
      />

      {/* FreeRTOS Health Drawer */}
      <DeviceHealthDrawer
        device={selectedHealthDevice}
        onClose={() => setSelectedHealthDevice(null)}
      />
    </div>
  );
};

