import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sun, Moon, User, Radio, Database, Menu, LogOut, Clock, KeyRound } from 'lucide-react';
import { useAuth, useCapability } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNetworkAccess } from '../context/NetworkAccessContext';
import { resolveApiMode, setApiMode, isApiModeSwitchAllowed, resolvePlantLabel, ApiMode } from '../services/api/mode';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface TopbarProps {
  onOpenMobileSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileSidebar }) => {
  const navigate = useNavigate();
  const { currentUser, logout, sessionTtlRemaining, changePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isReadOnly } = useNetworkAccess();
  const canReadBrokerConfig = useCapability('mqtt.config.read').canInteract;

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [apiMode, setApiModeState] = useState<ApiMode>(() => resolveApiMode());
  // Switch mode dari UI hanya hidup bila dibuka di env
  // (VITE_ALLOW_API_MODE_SWITCH=true, dev lokal). Bila terkunci, Topbar hanya
  // menampilkan badge read-only — mode berasal dari VITE_API_MODE.
  const apiModeSwitchAllowed = isApiModeSwitchAllowed();

  const handleApiModeChange = (next: ApiMode) => {
    if (!apiModeSwitchAllowed || next === apiMode) return;
    // Mode dipilih saat module load (selector apiClient) — perlu reload penuh.
    setApiMode(next);
    setApiModeState(next);
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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

  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isLowSession = sessionTtlRemaining < 180;

  return (
    <>
      <header className="h-14 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <NavLink
            to="/admin"
            className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 hover:text-sky-600 transition-colors"
          >
            OEE IIoT Admin
          </NavLink>
          <span className="hidden lg:inline text-xs text-slate-400 font-mono whitespace-nowrap shrink-0">| {resolvePlantLabel()}</span>
        </div>

        <nav className="hidden md:flex items-center gap-4 xl:gap-5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <NavLink
            to="/admin/live-state"
            className={({ isActive }) =>
              `hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
              }`
            }
          >
            Live State
          </NavLink>
          <NavLink
            to="/admin/work-orders"
            className={({ isActive }) =>
              `hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
              }`
            }
          >
            Work Orders
          </NavLink>
          <NavLink
            to="/admin/downtime"
            className={({ isActive }) =>
              `hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
              }`
            }
          >
            Downtime
          </NavLink>
          <NavLink
            to="/admin/telemetry"
            className={({ isActive }) =>
              `hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                isActive ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
              }`
            }
          >
            Telemetry
          </NavLink>
          {canReadBrokerConfig && (
            <NavLink
              to="/admin/mqtt/configuration"
              className={({ isActive }) =>
                `hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
                }`
              }
            >
              Broker Config
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="hidden 2xl:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-tabular border-r border-slate-200 dark:border-slate-800 pr-3">
            <div className="flex items-center gap-1.5" title="Status Koneksi Perangkat Pabrik">
              <Radio className="w-3.5 h-3.5 text-emerald-500" />
              <span>Koneksi Mesin Aktif</span>
            </div>
            <span aria-hidden="true">·</span>
            <div className="flex items-center gap-1.5" title="Penyimpanan Data Produksi">
              <Database className="w-3.5 h-3.5 text-sky-500" />
              <span>Basis Data Aktif</span>
            </div>
          </div>

          <div
            className={`hidden sm:flex items-center gap-1 text-[11px] font-tabular px-2 py-0.5 rounded border ${
              isLowSession
                ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="Sisa waktu aktif sesi login Anda"
          >
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatSessionTime(sessionTtlRemaining)}</span>
          </div>

          <div
            className="flex items-center gap-1.5"
            title={
              apiModeSwitchAllowed
                ? 'Mode API: Demo memakai data lokal di memori; Real memakai HTTP ke backend (VITE_API_URL). Pilihan tersimpan dan halaman dimuat ulang.'
                : 'Mode API terkunci di env (VITE_API_MODE). Untuk mengubahnya, ubah env lalu build/deploy ulang.'
            }
          >
            <span className="text-[11px] text-slate-400 hidden sm:inline">API:</span>
            {apiModeSwitchAllowed ? (
              <select
                value={apiMode}
                onChange={(e) => handleApiModeChange(e.target.value as ApiMode)}
                className={`text-xs border rounded px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                  apiMode === 'real'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                }`}
                aria-label="API Mode"
              >
                <option value="demo">Demo</option>
                <option value="real">Real</option>
              </select>
            ) : (
              <span
                className={`text-xs border rounded px-2 py-1 font-semibold ${
                  apiMode === 'real'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                }`}
                aria-label={`API Mode: ${apiMode} (terkunci di env)`}
              >
                {apiMode === 'real' ? 'Real' : 'Demo'}
              </span>
            )}
          </div>

          {/* Ganti peran TIDAK ada di sini: peran berasal dari login.
              Untuk ganti peran: logout, lalu login sebagai operator lain. */}

          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle visual theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs">
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden lg:block text-left mr-1">
              <span className="block font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono leading-tight">{currentUser.operator_id}</span>
            </div>
            <button
              onClick={() => {
                setPwError(null);
                setPwSuccess(null);
                setShowPasswordModal(true);
              }}
              disabled={isReadOnly}
              className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded transition-colors disabled:opacity-40"
              title={isReadOnly ? 'Ganti password dinonaktifkan dari remote tunnel' : 'Ganti Password Sendiri'}
              aria-label="Ganti Password"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
              title="Keluar dari sesi (Logout)"
              aria-label="Keluar dari sesi"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
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
            <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>
              Tutup
            </Button>
            <Button type="submit" isLoading={pwSubmitting}>
              Simpan Password
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
