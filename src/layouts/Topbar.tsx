import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sun, Moon, Menu } from 'lucide-react';
import { useAuth, useCapability } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNetworkAccess } from '../context/NetworkAccessContext';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { TopbarModeSwitch } from './components/TopbarModeSwitch';
import { TopbarNav } from './components/TopbarNav';
import { TopbarSessionBadge } from './components/TopbarSessionBadge';
import { TopbarStatusIndicators } from './components/TopbarStatusIndicators';
import { TopbarUserMenu } from './components/TopbarUserMenu';
import { resolveApiMode, setApiMode, isApiModeSwitchAllowed, resolvePlantLabel, ApiMode } from '../services/api/mode';
import {
  resolveAccessMode,
  setAccessMode,
  isAccessModeSwitchAllowed,
  AccessMode,
} from '../services/api/mode';

interface TopbarProps {
  onOpenMobileSidebar?: () => void;
}

function apiModeClassForValue(mode: string): string {
  return mode === 'real'
    ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
    : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300';
}

function accessModeClassForValue(mode: string): string {
  return mode === 'public'
    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
    : 'bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300';
}

/**
 * E32.6 (FAT-287): sub-bagian dipecah per tanggung jawab ke
 * layouts/components/ (TopbarNav, TopbarModeSwitch, TopbarSessionBadge,
 * TopbarStatusIndicators, TopbarUserMenu). Topbar tinggal orkestrasi:
 * state mode + theme + modal ganti password. Perilaku/UI tidak berubah.
 */
export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileSidebar }) => {
  const navigate = useNavigate();
  const { currentUser, logout, sessionTtlRemaining } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isReadOnly } = useNetworkAccess();
  const canReadBrokerConfig = useCapability('mqtt.config.read').canInteract;

  const [showPasswordModal, setShowPasswordModal] = useState(false);
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

  // Switch mode akses dari UI hanya hidup bila dibuka di env
  // (VITE_ALLOW_ACCESS_MODE_SWITCH=true, dev lokal). Bila terkunci, Topbar
  // hanya menampilkan badge read-only — mode berasal dari VITE_ACCESS_MODE.
  // Private = akses penuh hanya dari LAN; Public = akses penuh juga via internet.
  const [accessMode, setAccessModeState] = useState<AccessMode>(() => resolveAccessMode());
  const accessModeSwitchAllowed = isAccessModeSwitchAllowed();

  const handleAccessModeChange = (next: AccessMode) => {
    if (!accessModeSwitchAllowed || next === accessMode) return;
    setAccessMode(next);
    setAccessModeState(next);
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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

        <TopbarNav canReadBrokerConfig={canReadBrokerConfig} />

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <TopbarStatusIndicators />

          <TopbarSessionBadge sessionTtlRemaining={sessionTtlRemaining} />

          <TopbarModeSwitch
            label="API"
            value={apiMode}
            options={[
              { value: 'demo', label: 'Demo' },
              { value: 'real', label: 'Real' },
            ]}
            switchAllowed={apiModeSwitchAllowed}
            onChange={(next) => handleApiModeChange(next as ApiMode)}
            allowedTitle="Mode API: Demo memakai data lokal di memori; Real memakai HTTP ke backend (VITE_API_URL). Pilihan tersimpan dan halaman dimuat ulang."
            lockedTitle="Mode API terkunci di env (VITE_API_MODE). Untuk mengubahnya, ubah env lalu build/deploy ulang."
            classForValue={apiModeClassForValue}
          />

          {/* Switch mode akses Private/Public — mirroring pola badge API di atas.
              Private (biru) = akses penuh hanya dari LAN pabrik, via internet
              read-only. Public (amber) = akses penuh juga via internet. */}
          <TopbarModeSwitch
            label="Akses"
            value={accessMode}
            options={[
              { value: 'private', label: 'Private' },
              { value: 'public', label: 'Public' },
            ]}
            switchAllowed={accessModeSwitchAllowed}
            onChange={(next) => handleAccessModeChange(next as AccessMode)}
            allowedTitle="Mode Akses: Private = akses penuh hanya dari LAN pabrik (via internet read-only); Public = akses penuh juga via internet publik. Pilihan tersimpan dan halaman dimuat ulang."
            lockedTitle="Mode Akses terkunci di env (VITE_ACCESS_MODE). Untuk mengubahnya, ubah env lalu build/deploy ulang."
            classForValue={accessModeClassForValue}
          />

          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle visual theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <TopbarUserMenu
            userName={currentUser.name}
            operatorId={currentUser.operator_id}
            isReadOnly={isReadOnly}
            onChangePassword={() => setShowPasswordModal(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* E31.13 (FAT-276): form ganti password dipindah ke
          layouts/components/ChangePasswordModal.tsx */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
};
