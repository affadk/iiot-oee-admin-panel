import React from 'react';
import { MachineFsmState } from '../../types/monitoring';
import { normalizeFsmState } from '../../utils/oeeCalculations';

interface MachineStateBadgeProps {
  state: MachineFsmState | string;
  showDot?: boolean;
}

export const MachineStateBadge: React.FC<MachineStateBadgeProps> = ({ state, showDot = true }) => {
  const normalized = normalizeFsmState(state);

  const styles: Record<MachineFsmState, { text: string; bg: string; dot: string; label: string }> = {
    RUNNING: {
      text: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60',
      dot: 'bg-emerald-500',
      label: 'RUNNING',
    },
    READY: {
      text: 'text-sky-700 dark:text-sky-300',
      bg: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800/60',
      dot: 'bg-sky-500',
      label: 'READY',
    },
    UNCONFIGURED: {
      text: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400',
      label: 'UNCONFIGURED',
    },
    PLANNED_DOWNTIME: {
      text: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60',
      dot: 'bg-amber-500',
      label: 'PLANNED DOWNTIME',
    },
    UNPLANNED_DOWNTIME: {
      text: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800/60',
      dot: 'bg-red-500',
      label: 'UNPLANNED DOWNTIME',
    },
    BATCH_FINISHED: {
      text: 'text-indigo-700 dark:text-indigo-300',
      bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60',
      dot: 'bg-indigo-500',
      label: 'BATCH FINISHED',
    },
    // E20 P20.5 (FAT-157, D-4): OFFLINE nilai item sah — bukan
    // UNCONFIGURED. Abu-abu gelap + label OFFLINE.
    OFFLINE: {
      text: 'text-zinc-700 dark:text-zinc-300',
      bg: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700',
      dot: 'bg-zinc-500',
      label: 'OFFLINE',
    },
  };

  const current = styles[normalized] || styles.UNCONFIGURED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold border rounded whitespace-nowrap shrink-0 font-tabular ${current.bg} ${current.text}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} aria-hidden="true" />}
      <span>{current.label}</span>
    </span>
  );
};
