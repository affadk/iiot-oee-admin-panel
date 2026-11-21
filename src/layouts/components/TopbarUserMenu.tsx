import React from 'react';
import { KeyRound, LogOut, User } from 'lucide-react';

interface TopbarUserMenuProps {
  userName: string;
  operatorId: string;
  isReadOnly: boolean;
  onChangePassword: () => void;
  onLogout: () => void;
}

/**
 * Identitas pengguna + tombol ganti password & logout.
 * Dipindah dari Topbar.tsx (E32.6, FAT-287).
 *
 * Ganti peran TIDAK ada di sini: peran berasal dari login. Untuk ganti
 * peran: logout, lalu login sebagai operator lain.
 */
export function TopbarUserMenu({
  userName,
  operatorId,
  isReadOnly,
  onChangePassword,
  onLogout,
}: TopbarUserMenuProps) {
  return (
    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs">
      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
        <User className="w-4 h-4" />
      </div>
      <div className="hidden lg:block text-left mr-1">
        <span className="block font-semibold text-slate-900 dark:text-slate-100 leading-tight">
          {userName}
        </span>
        <span className="text-[10px] text-slate-400 font-mono leading-tight">{operatorId}</span>
      </div>
      <button
        onClick={onChangePassword}
        disabled={isReadOnly}
        className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded transition-colors disabled:opacity-40"
        title={isReadOnly ? 'Ganti password dinonaktifkan (mode observasi)' : 'Ganti Password Sendiri'}
        aria-label="Ganti Password"
      >
        <KeyRound className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onLogout}
        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
        title="Keluar dari sesi (Logout)"
        aria-label="Keluar dari sesi"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
