import React, { useState } from 'react';
import { KeyRound, ShieldOff } from 'lucide-react';
import { apiClient } from '../../../services/api/client';
import { EdgeDevice, DeviceCredential } from '../../../types/assets';
import { Button } from '../../../components/ui/Button';
import { DeviceCredentialModal } from './DeviceCredentialModal';

interface DeviceCredentialActionsProps {
  device: EdgeDevice;
  canManage: { canInteract: boolean; reason?: string };
  onDeviceChange: (device: EdgeDevice) => void;
}

/**
 * Aksi keamanan kredensial device §E.3b/3c (E31.14, FAT-277):
 * revoke + rotasi kredensial + kredensial sekali tampil.
 * Dipisah dari DeviceDetailModal agar modal tetap di bawah batas keras
 * komponen (300 baris) setelah pindah ke components/ (aturan R5).
 * State + handler aksi tinggal di sini; perubahan device dilaporkan
 * ke induk lewat onDeviceChange (dulu reloadDevice di induk).
 */
export const DeviceCredentialActions: React.FC<DeviceCredentialActionsProps> = ({
  device,
  canManage,
  onDeviceChange,
}) => {
  const [revokeReason, setRevokeReason] = useState('');
  const [rotateReason, setRotateReason] = useState('');
  const [rotateForce, setRotateForce] = useState(false);
  const [actionBusy, setActionBusy] = useState<'revoke' | 'rotate' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [oneTimeCredential, setOneTimeCredential] = useState<DeviceCredential | null>(null);

  const handleRevoke = async () => {
    const reason = revokeReason.trim();
    if (reason.length < 1 || reason.length > 200) {
      setActionError('Alasan pencabutan wajib 1..200 karakter.');
      return;
    }
    setActionBusy('revoke');
    setActionError(null);
    setActionMsg(null);
    try {
      await apiClient.revokeDevice(device.device_id, reason);
      onDeviceChange(await apiClient.getDeviceById(device.device_id));
      setRevokeReason('');
      setActionMsg(`Kredensial ${device.device_id} dicabut (REVOKED). Baris registry dan histori dipertahankan.`);
    } catch (err: any) {
      setActionError(err?.message || 'Gagal mencabut kredensial perangkat.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleRotate = async () => {
    const reason = rotateReason.trim();
    if (reason.length < 1 || reason.length > 200) {
      setActionError('Alasan rotasi wajib 1..200 karakter.');
      return;
    }
    setActionBusy('rotate');
    setActionError(null);
    setActionMsg(null);
    try {
      const result = await apiClient.rotateDeviceCredentials(device.device_id, { force: rotateForce, reason });
      onDeviceChange(await apiClient.getDeviceById(device.device_id));
      setRotateReason('');
      setRotateForce(false);
      setActionMsg(
        `Kredensial ${device.device_id} dirotasi${result.forced ? ' (forced — device sedang produksi)' : ''}. Salin kredensial baru sebelum menutup dialog.`,
      );
      setOneTimeCredential(result.credential);
    } catch (err: any) {
      setActionError(err?.message || 'Gagal merotasi kredensial perangkat.');
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <>
      {/* Aksi keamanan §E.3b/3c */}
      {actionError ? (
        <div role="alert" className="p-3 rounded border border-red-300 bg-red-50 text-xs text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200">
          {actionError}
        </div>
      ) : null}
      {actionMsg ? (
        <div role="status" className="p-3 rounded border border-emerald-300 bg-emerald-50 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
          {actionMsg}
        </div>
      ) : null}
      <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 space-y-3">
        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-sky-500" />
          Rotasi Kredensial (§E.3c)
        </span>
        {device.enrollmentState === 'REVOKED' ? (
          <p className="text-slate-500 italic">Perangkat sudah REVOKED — kredensial tidak dapat dirotasi.</p>
        ) : (
          <>
            <textarea
              value={rotateReason}
              onChange={(e) => setRotateReason(e.target.value)}
              placeholder="Alasan rotasi (wajib, 1..200 karakter)"
              maxLength={200}
              rows={2}
              disabled={!canManage.canInteract}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rotateForce}
                onChange={(e) => setRotateForce(e.target.checked)}
                disabled={!canManage.canInteract}
              />
              <span>Force — rotasi meski device online dan WO ACTIVE (409 DEVICE_IN_PRODUCTION tanpa ini)</span>
            </label>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleRotate()}
              disabled={!canManage.canInteract || actionBusy !== null}
              isLoading={actionBusy === 'rotate'}
              title={!canManage.canInteract ? canManage.reason : 'Buat password baru (sekali tampil)'}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Rotasi Kredensial</span>
            </Button>
          </>
        )}
      </div>

      <div className="p-3.5 rounded-md border border-red-200 dark:border-red-800/60 space-y-3">
        <span className="font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5">
          <ShieldOff className="w-3.5 h-3.5" />
          Cabut Kredensial (§E.3b)
        </span>
        {device.enrollmentState === 'REVOKED' ? (
          <p className="text-slate-500 italic">Perangkat sudah REVOKED.</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-500">
              Selalu diizinkan, termasuk saat mesin terikat dan Work Order ACTIVE. Baris registry dan histori
              dipertahankan; identitas broker dihapus.
            </p>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Alasan pencabutan (wajib, 1..200 karakter)"
              maxLength={200}
              rows={2}
              disabled={!canManage.canInteract}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            />
            <Button
              size="sm"
              variant="danger"
              onClick={() => void handleRevoke()}
              disabled={!canManage.canInteract || actionBusy !== null}
              isLoading={actionBusy === 'revoke'}
              title={!canManage.canInteract ? canManage.reason : 'Cabut kredensial perangkat'}
            >
              <ShieldOff className="w-3.5 h-3.5" />
              <span>Cabut Kredensial</span>
            </Button>
          </>
        )}
      </div>
      {/* Kredensial sekali tampil — di-wipe dari state saat dialog ditutup */}
      <DeviceCredentialModal credential={oneTimeCredential} onClose={() => setOneTimeCredential(null)} />
    </>
  );
};
