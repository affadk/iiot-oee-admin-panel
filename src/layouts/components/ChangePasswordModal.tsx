import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal ganti password sendiri (E31.13, FAT-276 — diekstrak dari
 * Topbar). Form state tinggal di dalam modal (R4); Topbar hanya
 * membuka/menutupnya. Perubahan kata sandi hanya lewat LAN pabrik
 * (digate di sisi client oleh changePassword).
 */
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Perilaku lama (Topbar): pesan error/sukses direset setiap kali modal
  // dibuka — jangan biarkan pesan lama tampil di pembukaan berikutnya.
  useEffect(() => {
    if (isOpen) {
      setPwError(null);
      setPwSuccess(null);
    }
  }, [isOpen]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    setPwSubmitting(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      setPwSuccess(res.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPwError(err?.message || 'Gagal mengganti password.');
    } finally {
      setPwSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ganti Password Akun"
      maxWidth="sm"
    >
      <form onSubmit={handleChangePassword} className="space-y-4">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Perubahan kata sandi hanya dapat dilakukan melalui jaringan lokal pabrik.
        </div>
        <Input
          label="Password Saat Ini"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <Input
          label="Password Baru (min. 8 karakter)"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
        {pwError && (
          <div className="p-2.5 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300">
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="p-2.5 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-emerald-700 dark:text-emerald-300">
            {pwSuccess}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          <Button type="submit" isLoading={pwSubmitting}>
            Simpan Password
          </Button>
        </div>
      </form>
    </Modal>
  );
};
