import React from 'react';

export interface ModeSwitchOption {
  value: string;
  label: string;
}

interface TopbarModeSwitchProps {
  label: string;
  value: string;
  options: ModeSwitchOption[];
  switchAllowed: boolean;
  onChange: (next: string) => void;
  allowedTitle: string;
  lockedTitle: string;
  /** Kelas warna latar/border per nilai mode (dipakai select maupun badge). */
  classForValue: (value: string) => string;
}

/**
 * Switch mode (API / Akses) di Topbar: select bila switch dibuka di env,
 * badge read-only bila terkunci. Dipindah dari Topbar.tsx (E32.6, FAT-287).
 *
 * E31.6 (FAT-269): BYPASS R2 — select ini memakai warna latar kondisional
 * per mode sebagai indikator visual mode aktif; ui/Select tidak mendukung
 * className kondisional pada elemen select-nya.
 */
export function TopbarModeSwitch({
  label,
  value,
  options,
  switchAllowed,
  onChange,
  allowedTitle,
  lockedTitle,
  classForValue,
}: TopbarModeSwitchProps) {
  return (
    <div className="flex items-center gap-1.5" title={switchAllowed ? allowedTitle : lockedTitle}>
      <span className="text-[11px] text-slate-400 hidden sm:inline">{label}:</span>
      {switchAllowed ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`text-xs border rounded px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 ${classForValue(value)}`}
          aria-label={`${label} Mode`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <span
          className={`text-xs border rounded px-2 py-1 font-semibold ${classForValue(value)}`}
          aria-label={`${label} Mode: ${value} (terkunci di env)`}
        >
          {options.find((opt) => opt.value === value)?.label ?? value}
        </span>
      )}
    </div>
  );
}
