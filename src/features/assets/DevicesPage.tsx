import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCapability, useAuth } from '../../context/AuthContext';
import { EdgeDevice, DeviceCredential } from '../../types/assets';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog } from '../../components/ui/ConflictDialog';
import { DeviceHealthDrawer } from './components/DeviceHealthDrawer';
import { DeviceDetailModal } from './components/DeviceDetailModal';
import { useDevices } from './hooks/useDevices';
import { DeviceTable } from './components/DeviceTable';
import { DeviceRegisterModal } from './components/DeviceRegisterModal';
import { DeviceProvisionModal } from './components/DeviceProvisionModal';
import { DeviceCredentialModal } from './components/DeviceCredentialModal';
import { DeviceEditModal } from './components/DeviceEditModal';

export const DevicesPage: React.FC = () => {
  const { checkCapability } = useAuth();
  const canManage = useCapability('device.manage');

  const [bindingFilter, setBindingFilter] = useState<'ALL' | 'BOUND' | 'UNBOUND'>('ALL');
  const [selectedHealthDevice, setSelectedHealthDevice] = useState<EdgeDevice | null>(null);
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null);

  // Register Modal (legacy — D-5: dipertahankan berlabel legacy)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Provision Modal (kanonis §E.3a) + kredensial sekali tampil (di-wipe saat tutup)
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [oneTimeCredential, setOneTimeCredential] = useState<DeviceCredential | null>(null);

  // Edit Modal (only ip_address & firmware_version editable; device_id & mac_address immutable)
  const [editTarget, setEditTarget] = useState<EdgeDevice | null>(null);

  const handleDeviceDeleted = useCallback(
    (deviceId: string) => {
      if (selectedHealthDevice?.device_id === deviceId) setSelectedHealthDevice(null);
      if (detailDeviceId === deviceId) setDetailDeviceId(null);
    },
    [selectedHealthDevice, detailDeviceId],
  );

  const {
    devices,
    isLoading,
    feedback,
    setFeedback,
    loadDevices,
    registerDevice,
    provisionDevice,
    updateDevice,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  } = useDevices({ onDeviceDeleted: handleDeviceDeleted });

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
            onClick={() => setIsProvisionOpen(true)}
            disabled={!canManage.canInteract}
            title={!canManage.canInteract ? canManage.reason : 'Provision perangkat baru (broker identity + registry)'}
          >
            <Plus className="w-4 h-4" />
            <span>Provision Device</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsRegisterOpen(true)}
            disabled={!canManage.canInteract}
            title={!canManage.canInteract ? canManage.reason : 'Registrasi manual legacy (tanpa kredensial broker) — gunakan Provision untuk alur lengkap'}
          >
            <Plus className="w-4 h-4" />
            <span>Registrasi Edge Device (Legacy)</span>
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

      <DeviceTable
        devices={filteredDevices}
        isLoading={isLoading}
        checkCapability={checkCapability}
        onDetail={(id) => setDetailDeviceId(id)}
        onHealth={setSelectedHealthDevice}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
      />

      {/* Provision Modal (kanonis) */}
      <DeviceProvisionModal
        isOpen={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        onSubmit={async (input) => {
          const result = await provisionDevice(input);
          setOneTimeCredential(result.credential);
        }}
      />

      {/* Kredensial sekali tampil — di-wipe dari state saat dialog ditutup */}
      <DeviceCredentialModal credential={oneTimeCredential} onClose={() => setOneTimeCredential(null)} />

      {/* Register Modal (Legacy) */}
      <DeviceRegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSubmit={registerDevice}
      />

      {/* Edit Modal */}
      <DeviceEditModal
        key={editTarget?.device_id ?? 'none'}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={updateDevice}
      />

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
