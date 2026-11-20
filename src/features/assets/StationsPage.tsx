import React, { useState } from 'react';
import { Plus, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCapability, useAuth } from '../../context/AuthContext';
import { Station } from '../../types/assets';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog } from '../../components/ui/ConflictDialog';
import { useStations } from './hooks/useStations';
import { useUnknownStations } from './hooks/useUnknownStations';
import { StationTable } from './components/StationTable';
import { StationRegisterModal } from './components/StationRegisterModal';
import { StationEditModal } from './components/StationEditModal';
import { StationRevokeDialog } from './components/StationRevokeDialog';
import { UnknownStationsPanel } from './components/UnknownStationsPanel';

/**
 * E27 Spec 043 (FAT-232, T1): registry stasiun / terminal login
 * (kiosk). Stasiun = baris tabel `devices` yang sama dengan edge device —
 * daftar di sini memakai mapStation() (bukan mapDevice) karena ID stasiun
 * secara DESAIN bebas pola STM32. NAMUN server saat ini menolak ID non-STM32
 * (400 "Device ID must start with 'STM32-'...", FAT-237) — sampai backend
 * diperbaiki, yang bisa didaftarkan hanyalah ID berpola STM32- (lihat hint
 * di StationRegisterModal). TIDAK ADA kolom hostname: API tidak punya field itu.
 */
export const StationsPage: React.FC = () => {
  const { checkCapability } = useAuth();
  const canManage = useCapability('device.manage');

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerPrefill, setRegisterPrefill] = useState('');
  const [editTarget, setEditTarget] = useState<Station | null>(null);

  const {
    stations,
    isLoading,
    feedback,
    setFeedback,
    loadStations,
    registerStation,
    updateStation,
    revokeTarget,
    setRevokeTarget,
    isRevoking,
    handleRevoke,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  } = useStations();

  const {
    unknownStations,
    isLoading: isDiagnosticsLoading,
    error: diagnosticsError,
    totalEvents,
    loadUnknownStations,
  } = useUnknownStations(stations.map((s) => s.device_id));

  const openRegister = (prefill = '') => {
    setRegisterPrefill(prefill);
    setIsRegisterOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Stations (Stasiun / Terminal Login)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar stasiun kiosk (login perangkat). Login admin panel tidak
            memakai station_id (Spec 044) — stasiun di sini hanya untuk
            perangkat kiosk, bukan untuk login admin.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Catatan: API belum mendukung hostname — identitas stasiun adalah Station / Device ID-nya.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void loadStations();
              void loadUnknownStations();
            }}
            isLoading={isLoading}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => openRegister()}
            disabled={!canManage.canInteract}
            title={!canManage.canInteract ? canManage.reason : 'Daftarkan stasiun baru'}
          >
            <Plus className="w-4 h-4" />
            <span>Daftarkan Stasiun</span>
          </Button>
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

      <UnknownStationsPanel
        unknownStations={unknownStations}
        isLoading={isDiagnosticsLoading}
        error={diagnosticsError}
        totalEvents={totalEvents}
        onRegister={(label) => openRegister(label)}
      />

      <StationTable
        stations={stations}
        isLoading={isLoading}
        checkCapability={checkCapability}
        onEdit={setEditTarget}
        onRevoke={setRevokeTarget}
        onDelete={setDeleteTarget}
      />

      <StationRegisterModal
        key={registerPrefill || 'new'}
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSubmit={async (input) => {
          await registerStation(input);
          await loadUnknownStations();
        }}
        initialDeviceId={registerPrefill}
      />

      <StationEditModal
        key={editTarget?.device_id ?? 'none'}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={updateStation}
      />

      <StationRevokeDialog
        target={revokeTarget}
        isRevoking={isRevoking}
        onClose={() => setRevokeTarget(null)}
        onConfirm={async (reason) => {
          await handleRevoke(reason);
          await loadUnknownStations();
        }}
      />

      {/* Delete Confirmation — hapus hanya untuk stasiun tanpa histori;
          bila server menolak (device berhitori), pesan server ditampilkan
          apa adanya via ConflictDialog. Nonaktifkan (revoke) adalah jalur
          yang disarankan untuk stasiun yang sudah punya audit/telemetri. */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Hapus Stasiun ${deleteTarget?.device_id ?? ''}?`}
        variant="destructive"
        description="Penghapusan permanen. Untuk stasiun yang sudah punya riwayat audit/telemetri, gunakan Nonaktifkan (revoke) — bukan hapus."
        impacts={[
          'Stasiun yang dihapus tidak bisa dipakai login kiosk lagi.',
          'Bila stasiun punya histori, server dapat menolak penghapusan (409) — gunakan Nonaktifkan sebagai gantinya.',
          'Membutuhkan peran ADMIN melalui jaringan lokal pabrik.',
        ]}
        confirmLabel="Ya, Hapus Stasiun"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />
    </div>
  );
};
