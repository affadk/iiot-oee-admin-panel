import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useNetworkAccess } from '../../context/NetworkAccessContext';
import { isNetworkModeSimulationAllowed } from '../../services/api/mode';

export const NetworkModeBanner: React.FC = () => {
  const { mode, setMode } = useNetworkAccess();
  // Tombol simulasi mode jaringan hanya hidup bila dibuka di env
  // (VITE_ALLOW_NETWORK_MODE_SIMULATION=true, dev lokal). Bila terkunci,
  // banner hanya indikator status — mode berasal dari env/deployment.
  const simulationAllowed = isNetworkModeSimulationAllowed();

  if (mode === 'LAN') {
    return (
      <div className="bg-slate-900 border-b border-slate-800 text-slate-300 px-3 sm:px-6 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-400 truncate">Jaringan Lokal Pabrik (Akses Penuh)</span>
          <span className="text-slate-400 hidden md:inline">· Pengaturan, Data Master &amp; Hak Akses Aktif</span>
        </div>
        {simulationAllowed && (
          <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
            <span className="text-slate-400 hidden sm:inline text-[11px]">Simulasi Akses:</span>
            <button
              onClick={() => setMode('REMOTE_TUNNEL')}
              className="text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded transition-colors whitespace-nowrap"
            >
              Mode Remote Tunnel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="bg-[#FEF3C7] dark:bg-amber-950/90 border-b border-amber-400/50 dark:border-amber-600/40 text-[#78350F] dark:text-amber-200 px-3 sm:px-6 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0"
    >
      <div className="flex items-center gap-2 truncate">
        <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
        <span className="font-bold tracking-wide truncate">
          Mode observasi — perubahan dinonaktifkan. Akses penuh tersedia dari LAN pabrik.
        </span>
      </div>
      {simulationAllowed && (
        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
          <button
            onClick={() => setMode('LAN')}
            className="text-[11px] px-2.5 py-0.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded transition-colors shadow-xs whitespace-nowrap"
          >
            Kembali ke LAN Pabrik
          </button>
        </div>
      )}
    </div>
  );
};
