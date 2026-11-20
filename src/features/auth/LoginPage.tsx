import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Shield, Lock, UserCheck, AlertCircle, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNetworkAccess } from '../../context/NetworkAccessContext';
import { ApiError } from '../../types/auth';
import {
  DEMO_PRESETS,
  DEMO_PRESET_PASSWORD,
  LAN_GATE_DENY_REASON,
  isDemoPresetLoginEnabled,
  resolveAccessMode,
  resolveApiMode,
} from '../../services/api/mode';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BackendHealthIndicator } from './components/BackendHealthIndicator';

/**
 * E29 (FAT-244, T5): pemetaan error login 403 — bedakan DUA sumber 403
 * yang sebelumnya disamaratakan menjadi satu pesan "jaringan jarak jauh":
 *
 * - 403 GATE LOKAL (client): assertLanForMutation (HTTP) / assertLanAccess
 *   (demo) melempar ApiError 403 DENGAN message persis LAN_GATE_DENY_REASON
 *   ("Mode observasi — …"), SEBELUM fetch — server tidak pernah dihubungi.
 *   Pembeda ini andal: kedua guard memakai string yang sama dari satu
 *   sumber (mode.ts), dan server tidak pernah mengirim string Indonesia
 *   itu (pesan server berbahasa Inggris, diteruskan verbatim oleh
 *   mapHttpErrorToApiError). → pesan observasi (tidak berubah).
 * - 403 SERVER: role-gate POST /auth/admin/login (Spec 044 — mis. operator
 *   non-admin) atau penolakan server lain. → tampilkan pesan server APA
 *   ADANYA (verbatim), generik, TANPA tambahan alasan role — jangan bocorkan
 *   dan jangan tertukar dengan pesan tunnel.
 *
 * Mengembalikan null bila error ini bukan 403 (401/429/dll. ditangani cabang
 * lain / fallback generik di handleSubmit).
 */
export function mapLoginForbiddenMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.httpStatus !== 403) return null;
  if (err.message === LAN_GATE_DENY_REASON) {
    return 'Login tidak dapat dilakukan melalui jaringan jarak jauh. Silakan hubungkan ke jaringan lokal pabrik untuk masuk.';
  }
  // 403 server — passthrough verbatim, tanpa alasan role tambahan.
  return err.message;
}

export const LoginPage: React.FC = () => {
  const { login, sessionExpiredReason, clearSessionExpiredReason, isAuthenticated, mustChangePassword, isRestoringSession } = useAuth();
  const { mode, isReadOnly } = useNetworkAccess();
  const navigate = useNavigate();

  // Preset login demo HANYA hidup bila env demo (isDemoPresetLoginEnabled):
  // di env real (VITE_API_MODE=real) tidak ada prefill, tidak ada tombol
  // preset — login wajib isi Operator ID + password sendiri.
  const presetsEnabled = isDemoPresetLoginEnabled();

  const [operatorId, setOperatorId] = useState(presetsEnabled ? 'ADM-001' : '');
  const [password, setPassword] = useState(presetsEnabled ? DEMO_PRESET_PASSWORD : '');
  // E29 (FAT-242, T3): field Station/Terminal ID DIHAPUS — login admin
  // (POST /auth/admin/login, Spec 044) tidak lagi memakai station_id;
  // body strict menolak field itu 400. Registry stasiun /admin/stations
  // tetap ada, khusus identitas terminal HMI — bukan login admin panel.
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Hitung mundur throttle SERVER (header Retry-After respons 429, §L).
  // BUKAN lockout lokal — server 5/60s satu-satunya throttle (E20 P20.3).
  const [retryAfterSec, setRetryAfterSec] = useState(0);

  useEffect(() => {
    if (retryAfterSec <= 0) return;
    const timer = setInterval(() => {
      setRetryAfterSec((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfterSec]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryAfterSec > 0) return;
    setErrorMsg(null);
    setIsLoading(true);

    try {
      clearSessionExpiredReason();
      const res = await login(operatorId.trim(), password);
      // Spec 043 (§L): flag gerbang dari respons login → layar wajib ganti password.
      if (res.operator.must_change_password === true) {
        navigate('/force-change-password', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.httpStatus === 403) {
          // E29 (FAT-244, T5): bedakan 403 gate LAN lokal (pesan observasi)
          // dari 403 role-gate server (pesan server verbatim, tanpa alasan
          // role tambahan). Jangan samaratakan keduanya.
          const forbiddenMsg = mapLoginForbiddenMessage(err);
          if (forbiddenMsg) {
            setErrorMsg(forbiddenMsg);
            return;
          }
        }
        if (err.httpStatus === 429) {
          // Sisa waktu dari server (Retry-After); tanpa nilai server, jangan
          // tebak — tampilkan pesan umum tanpa hitung mundur.
          const seconds = err.retryAfterSec ?? 0;
          setRetryAfterSec(seconds);
          setErrorMsg(
            seconds > 0
              ? `Terlalu banyak percobaan login. Tunggu ${seconds} detik sebelum mencoba kembali.`
              : 'Terlalu banyak percobaan login. Silakan coba lagi sebentar lagi.'
          );
          return;
        }
      }

      setErrorMsg(err instanceof Error ? err.message : 'Autentikasi gagal. Periksa Operator ID dan password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  // Hanya dipanggil dari tombol preset — blok preset tidak dirender bila
  // presetsEnabled false, jadi fungsi ini tidak pernah terjangkau di env real.
  const quickDemoLogin = (id: string) => {
    if (!presetsEnabled) return;
    setOperatorId(id);
    setPassword(DEMO_PRESET_PASSWORD);
    setErrorMsg(null);
  };

  // E23 Batch 4 (FAT-207, N-38): /login berada di luar AdminLayout,
  // jadi badge mode API + label mode akses Topbar tidak terlihat di sini.
  // Badge ini dibaca langsung dari env via mode.ts (tanpa layout/context)
  // dengan teks + warna yang SAMA seperti Topbar: Real hijau / Demo amber,
  // Private biru / Public amber. Read-only, tanpa gate login baru.
  const apiMode = resolveApiMode();
  const accessMode = resolveAccessMode();

  // FAT-280 Opsi B (perbaikan race, verifikasi live 2026-11-20 gagal):
  // selama silent restore berjalan, JANGAN tampilkan form login —
  // tampilkan placeholder yang sama seperti AdminLayout.
  if (isRestoringSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500">Memulihkan sesi…</p>
      </div>
    );
  }

  // Sudah terautentikasi (mis. restore berhasil saat reload di /login,
  // atau membuka /login manual saat masih login) → keluar dari halaman
  // login. Tujuan sama seperti handleSubmit: gerbang ganti-password
  // wajib didahulukan bila flag aktif, selain itu /admin.
  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? '/force-change-password' : '/admin'} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header Band */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded bg-sky-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">OEE Enterprise IIoT Console</h1>
            <p className="text-xs text-slate-400">Otentikasi &amp; Kontrol Akses Terpadu (LAN)</p>
          </div>
        </div>

        {/* Badge mode API + mode akses — cerminan badge Topbar (N-38). */}
        <div className="px-6 pt-4 flex items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-400">API:</span>
          <span
            className={`border rounded px-2 py-1 font-semibold ${
              apiMode === 'real'
                ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
            }`}
            aria-label={`API Mode: ${apiMode}`}
          >
            {apiMode === 'real' ? 'Real' : 'Demo'}
          </span>
          <span className="text-[11px] text-slate-400">Akses:</span>
          <span
            className={`border rounded px-2 py-1 font-semibold ${
              accessMode === 'public'
                ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                : 'bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300'
            }`}
            aria-label={`Mode Akses: ${accessMode}`}
          >
            {accessMode === 'public' ? 'Public' : 'Private'}
          </span>
        </div>

        {/* E28 Batch B (FAT-207, N-38): indikator koneksi backend (GET
            /health) — hanya di mode Real, informatif saja (lihat
            BackendHealthIndicator); tidak memblokir submit login. */}
        <BackendHealthIndicator />

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isReadOnly && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Akses Jarak Jauh Aktif ({mode === 'REMOTE_TUNNEL' ? 'Baca-Saja' : mode})</div>
                <p>Masuk untuk mengubah data hanya dapat dilakukan melalui jaringan lokal pabrik. Halaman pemantauan tetap dapat dilihat.</p>
              </div>
            </div>
          )}

          {sessionExpiredReason && !errorMsg && (
            <div
              role="status"
              className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>{sessionExpiredReason}</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Operator ID"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            placeholder="Contoh: ADM-001"
            required
            disabled={isLoading}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan password operator (min. 8 karakter)"
            required
            disabled={isLoading}
          />

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={retryAfterSec > 0 || isReadOnly}
            >
              <Lock className="w-4 h-4" />
              <span>
                {retryAfterSec > 0
                  ? `Tunggu ${retryAfterSec}s...`
                  : isReadOnly
                  ? 'Login Mutasi Nonaktif (Remote Tunnel)'
                  : 'Masuk ke Admin Panel'}
              </span>
            </Button>
          </div>

          {/* Demo Profiles Quick Selector — HANYA di env demo.
              Di env real (VITE_API_MODE=real) blok ini tidak dirender sama
              sekali: tidak ada preset, tidak ada prefill (lihat atas). */}
          {presetsEnabled && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Profil Operator Simulasi:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {DEMO_PRESETS.map((preset, i) => (
                  <button
                    key={preset.operatorId}
                    type="button"
                    onClick={() => quickDemoLogin(preset.operatorId)}
                    className="p-2 border border-slate-200 dark:border-slate-800 rounded text-left hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      {i === 0 && <UserCheck className="w-3 h-3 text-sky-500" />} {preset.role}
                    </div>
                    <div className="text-[11px] text-slate-500 font-tabular">
                      {preset.operatorId} · {preset.lineId}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
