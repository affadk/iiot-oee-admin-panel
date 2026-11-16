import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, UserCheck, AlertCircle, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNetworkAccess } from '../../context/NetworkAccessContext';
import { ApiError } from '../../types/auth';
import {
  DEMO_PRESETS,
  DEMO_PRESET_PASSWORD,
  isDemoPresetLoginEnabled,
  resolveDefaultStationId,
  resolveLoginCooldownSec,
  resolveLoginMaxAttempts,
} from '../../services/api/mode';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const LoginPage: React.FC = () => {
  const { login, sessionExpiredReason, clearSessionExpiredReason } = useAuth();
  const { mode, isReadOnly } = useNetworkAccess();
  const navigate = useNavigate();

  // Preset login demo HANYA hidup bila env demo (isDemoPresetLoginEnabled):
  // di env real (VITE_API_MODE=real) tidak ada prefill, tidak ada tombol
  // preset — login wajib isi Operator ID + password sendiri.
  const presetsEnabled = isDemoPresetLoginEnabled();
  const loginCooldownSec = resolveLoginCooldownSec();
  const loginMaxAttempts = resolveLoginMaxAttempts();

  const [operatorId, setOperatorId] = useState(presetsEnabled ? 'ADM-001' : '');
  const [password, setPassword] = useState(presetsEnabled ? DEMO_PRESET_PASSWORD : '');
  const [stationId, setStationId] = useState(resolveDefaultStationId());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSec > 0) return;
    setErrorMsg(null);
    setIsLoading(true);

    try {
      clearSessionExpiredReason();
      await login(operatorId.trim(), password, stationId.trim() || undefined);
      setFailedAttempts(0);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.httpStatus === 403) {
          // Mode observasi / Remote Tunnel — tidak menambah counter lockout 401
          setErrorMsg(
            'Login tidak dapat dilakukan melalui jaringan jarak jauh. Silakan hubungkan ke jaringan lokal pabrik untuk masuk.'
          );
          return;
        }
        if (err.httpStatus === 429) {
          setCooldownSec(loginCooldownSec);
          setErrorMsg(`Terlalu banyak percobaan login. Tunggu ${loginCooldownSec} detik sebelum mencoba kembali.`);
          return;
        }
      }

      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= loginMaxAttempts) {
        setCooldownSec(loginCooldownSec);
        setErrorMsg(`Terlalu banyak percobaan login gagal. Silakan tunggu ${loginCooldownSec} detik.`);
      } else {
        setErrorMsg(err?.message || 'Autentikasi gagal. Periksa Operator ID dan password Anda.');
      }
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

          <Input
            label="Station / Terminal ID (Opsional)"
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            placeholder="ADMIN-CONSOLE-01"
            disabled={isLoading}
          />

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={cooldownSec > 0 || isReadOnly}
            >
              <Lock className="w-4 h-4" />
              <span>
                {cooldownSec > 0
                  ? `Tunggu ${cooldownSec}s...`
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
