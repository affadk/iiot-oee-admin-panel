import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '../ui/Button';

// ---------------------------------------------------------------------------
// E31.9 (FAT-272): SATU komponen filter generik (aturan R7).
//
// Sebelumnya ada 4x `*FilterBar` + `OperatorsToolbar` +
// `OperationalEventsFilters` dengan pola yang sama (kartu + grid/flex
// field + reset) tetapi implementasi masing-masing. Komponen ini
// menyediakan cangkangnya saja — logika domain (opsi, handler, validasi)
// TETAP di tiap FilterBar, sebagai children.
//
// Yang TIDAK masuk pola ini (terdokumentasi di file masing-masing):
// - `MachineFilterBar`: toggle tersegmentasi (ALL/BOUND/UNBOUND), bukan
//   field select/search — tetap komponen sendiri.
// - `ShiftFilterBar`: memakai cangkang ini (layout flex) — logika tanggal
//   + shift + tombol cepat tetap di dalamnya.
// ---------------------------------------------------------------------------

const GRID_COLUMNS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

export interface FilterBarProps {
  children: React.ReactNode;
  /**
   * Tata letak field di dalam kartu. 'grid' (default bila `columns`
   * diisi) atau 'flex' (baris, item rata bawah — pola ShiftFilterBar).
   * Bila tidak diisi, children dirender apa adanya di dalam kartu.
   */
  layout?: 'grid' | 'flex';
  /** Jumlah kolom grid pada lg (hanya untuk layout grid). Default 4. */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  layout,
  columns = 4,
  className = '',
}) => {
  const layoutClass =
    layout === 'grid'
      ? `grid grid-cols-1 sm:grid-cols-2 ${GRID_COLUMNS[columns]} gap-3`
      : layout === 'flex'
        ? 'flex flex-col sm:flex-row sm:items-end gap-3'
        : '';
  return (
    <div
      className={`p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg ${layoutClass} ${className}`}
    >
      {children}
    </div>
  );
};

export interface FilterSearchFieldProps {
  label?: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tipe input. Default 'text'. */
  type?: 'search' | 'text';
  /** Tampilkan ikon kaca pembesar (pola WorkOrderFilterBar). Default true. */
  withIcon?: boolean;
  /** Kelas wrapper (mis. 'w-60' untuk lebar tetap di toolbar). */
  className?: string;
}

/** Field pencarian berlabel/berikon (pola WorkOrderFilterBar). */
export const FilterSearchField: React.FC<FilterSearchFieldProps> = ({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
  type = 'text',
  withIcon = true,
  className = '',
}) => (
  <div className={`relative ${className}`}>
    {withIcon && <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />}
    {label && (
      <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
        {label}
      </label>
    )}
    <input
      type={type}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${withIcon ? 'pl-9 pr-3' : 'px-3'} w-full py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500`}
    />
  </div>
);

export interface FilterResetButtonProps {
  onReset: () => void;
  /** Label tombol. Default 'Reset'. */
  label?: string;
}

/** Tombol Reset ghost (pola WorkOrderFilterBar). */
export const FilterResetButton: React.FC<FilterResetButtonProps> = ({
  onReset,
  label = 'Reset',
}) => (
  <Button size="sm" variant="ghost" onClick={onReset}>
    {label}
  </Button>
);
