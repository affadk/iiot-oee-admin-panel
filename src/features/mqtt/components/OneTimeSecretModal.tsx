import { useState } from 'react';
import { AlertTriangle, Check, Copy, Lock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

interface OneTimeSecretModalProps {
  /** Secret hasil generate; null = modal tertutup. */
  secret: { username: string; secret: string } | null;
  /**
   * WAJIB me-wipe secret (bukan sekadar menutup modal) — page mengikatnya ke
   * clearOneTimeSecret dari useMqttClientMutations (R9.5 §5b).
   */
  onClose: () => void;
}

export const OneTimeSecretModal: React.FC<OneTimeSecretModalProps> = ({ secret, onClose }) => {
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Kedua jalur tutup (onClose Modal + tombol footer) menjalankan wipe yang
  // sama: reset copiedSecret di sini, hapus secret via onClose page.
  const handleClose = () => {
    setCopiedSecret(false);
    onClose();
  };

  return (
    <Modal
      isOpen={Boolean(secret)}
      onClose={handleClose}
      title="Kata Sandi Akses Sekali Tampil"
      subtitle={`Kata sandi untuk perangkat "${secret?.username ?? ''}" hanya ditampilkan satu kali dan tidak dapat dilihat kembali setelah ditutup.`}
      footer={<Button onClick={handleClose}>Tutup &amp; Hapus dari Layar</Button>}
    >
      {secret && (
        <div className="space-y-3">
          <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>Salin kata sandi di bawah ini ke pengaturan perangkat sekarang. Setelah dialog ditutup, kata sandi tidak akan ditampilkan kembali.</span>
          </div>
          <div className="p-3 rounded bg-slate-950 text-emerald-400 font-mono text-xs flex items-center justify-between gap-2 border border-slate-800">
            <span className="flex items-center gap-2 break-all">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {secret.secret}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(secret.secret);
                setCopiedSecret(true);
              }}
            >
              {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSecret ? 'Disalin' : 'Salin'}</span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
