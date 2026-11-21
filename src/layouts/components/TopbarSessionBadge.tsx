import React from 'react';
import { Clock } from 'lucide-react';

interface TopbarSessionBadgeProps {
  sessionTtlRemaining: number;
}

function formatSessionTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Badge sisa waktu sesi login. Dipindah dari Topbar.tsx (E32.6, FAT-287). */
export function TopbarSessionBadge({ sessionTtlRemaining }: TopbarSessionBadgeProps) {
  const isLowSession = sessionTtlRemaining < 180;
  return (
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
  );
}
