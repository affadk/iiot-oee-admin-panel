import React from 'react';
import { Calendar } from 'lucide-react';
import { TimeWindowPreset } from '../../types/historical';

const PRESET_OPTIONS: { id: TimeWindowPreset; label: string }[] = [
  { id: '24h', label: '24 Jam' },
  { id: '7d', label: '7 Hari' },
  { id: '30d', label: '30 Hari' },
  { id: '90d', label: '90 Hari (Maks)' },
  { id: 'custom', label: 'Kustom' },
];

interface ExportPresetSelectorProps {
  preset: TimeWindowPreset;
  onPresetChange: (preset: TimeWindowPreset) => void;
}

/** Grup tombol preset jendela waktu. Dipindah dari HistoricalExportToolbar.tsx (E32.6, FAT-287). */
export function ExportPresetSelector({ preset, onPresetChange }: ExportPresetSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span>Jendela Waktu:</span>
      </div>

      <div
        role="group"
        aria-label="Preset jendela waktu historis"
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md"
      >
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPresetChange(opt.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              preset === opt.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
