import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../types/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

/**
 * Gerbang ganti-password-wajib — spec 043 (§L, E20 P20.3).
 *
 * Ditampilkan bila `mustChangePassword` aktif (flag dari respons login 200
 * / GET /auth/me, atau 403 PASSWORD_ROTATION_REQUIRED dari rute terproteksi).
 * TANPA jalur kedua: selama gerbang aktif tidak ada navigasi lain — halaman
 * ini satu-satunya jalan keluar, dan keluar hanya lewat ganti password yang
 * sukses (atau logout).
 */
export const ForceChangePasswordPage: React.FC = () => {
  const { changePassword, logout, currentUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (newPassword.length < 8) {
      setErrorMsg('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg('Password baru harus berbeda dari password saat ini.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      setSuccessMsg(result.message || 'Password berhasil diperbarui. Silakan lanjut ke panel.');
      // Gerbang tertutup oleh AuthContext (changePassword sukses) — lanjut.
      navigate('/admin', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 429 && err.retryAfterSec !== undefined) {
        setErrorMsg(`Terlalu banyak percobaan. Tunggu ${err.retryAfterSec} detik sebelum mencoba kembali.`);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal mengganti password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout('Anda keluar. Silakan login kembali.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden">
        <div className="px-6 py-5 bg-amber-600 text-white flex items-center gap-3 border-b border-amber-700">
          <div className="w-10 h-10 rounded bg-amber-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Ganti Password Wajib</h1>
            <p className="text-xs text-amber-100">Password sementara harus diganti sebelum melanjutkan</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              Akun <strong>{currentUser.name || currentUser.operator_id}</strong> memakai password sementara.
              Ganti password Anda sekarang — tidak ada akses lain sampai password diganti.
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <Input
            label="Password Saat Ini"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Masukkan password sementara Anda"
            required
            disabled={isLoading}
          />

          <Input
            label="Password Baru (min. 8 karakter)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Password baru minimal 8 karakter"
            required
            disabled={isLoading}
          />

          <Input
            label="Konfirmasi Password Baru"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password baru"
            required
            disabled={isLoading}
          />

          <div className="pt-2 space-y-2">
            <Button type="submit" className="w-full" isLoading={isLoading}>
              <Lock className="w-4 h-4" />
              <span>Ganti Password &amp; Lanjutkan</span>
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={handleLogout} disabled={isLoading}>
              Keluar (Logout)
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
