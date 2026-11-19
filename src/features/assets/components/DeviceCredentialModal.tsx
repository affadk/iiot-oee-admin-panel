import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, Lock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { DeviceCredential } from '../../../types/assets';

interface DeviceCredentialModalProps {
  /** Kredensial hasil provision/rotasi; null = modal tertutup. */
  credential: DeviceCredential | null;
  /** WAJIB me-wipe kredensial (bukan sekadar menutup modal) — parent mengikatnya ke penghapus state. */
  onClose: () => void;
}

export const DeviceCredentialModal: React.FC<DeviceCredentialModalProps> = ({ credential, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  const copyField = (value: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
  };

  return (
    <Modal
      isOpen={Boolean(credential)}
      onClose={handleClose}
      title="Kredensial Perangkat — Sekali Tampil"
      subtitle="Kredensial broker ini hanya ditampilkan satu kali dan tidak dapat dilihat kembali setelah ditutup."
      footer={<Button onClick={handleClose}>Tutup &amp; Hapus dari Layar</Button>}
    >
      {credential && (
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Salin kredensial di bawah ini ke pengaturan perangkat sekarang. Setelah dialog ditutup, password tidak
              akan ditampilkan kembali — rotasi diperlukan bila hilang.
            </span>
          </div>
          <div className="space-y-2">
            {(
              [
                ['Username', credential.username],
                ['Password', credential.password],
                ['Client ID', credential.clientId],
                ['Topic Prefix', credential.topicPrefix],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-2 p-2.5 rounded bg-slate-950 text-emerald-400 font-mono border border-slate-800"
              >
                <span className="flex items-center gap-2 break-all">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-slate-400 not-italic font-sans">{label}:</span> {value}
                </span>
                <Button size="sm" variant="secondary" onClick={() => copyField(value)}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Disalin' : 'Salin'}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};
