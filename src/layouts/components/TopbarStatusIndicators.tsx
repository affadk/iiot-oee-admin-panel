import React from 'react';
import { Database, Radio } from 'lucide-react';

/** Indikator status koneksi mesin & basis data (layar sangat lebar). Dipindah dari Topbar.tsx (E32.6, FAT-287). */
export function TopbarStatusIndicators() {
  return (
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
  );
}
