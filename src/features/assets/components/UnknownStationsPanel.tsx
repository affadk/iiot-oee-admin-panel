import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { UnknownStation } from '../hooks/useUnknownStations';

export interface UnknownStationsPanelProps {
  unknownStations: UnknownStation[];
  isLoading: boolean;
  error: string | null;
  /** Total event SECURITY_REJECTION di server (null bila tak diketahui). */
  totalEvents: number | null;
  onRegister: (label: string) => void;
}

/**
 * E27 Spec 043 (FAT-234, T3): diagnostik login kiosk — stasiun yang pernah
 * gagal STATION_NOT_FOUND (event SECURITY_REJECTION, device_id null).
 * `label` adalah data mentah UNTRUSTED dari klien: dirender sebagai teks
 * (React meng-escape), TIDAK dipakai sebagai key React, dan TIDAK dipakai
 * sebagai kunci lookup tanpa normalisasi.
 */
export const UnknownStationsPanel: React.FC<UnknownStationsPanelProps> = ({
  unknownStations,
  isLoading,
  error,
  totalEvents,
  onRegister,
}) => {
  return (
    <section
      aria-label="Diagnostik login kiosk"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Diagnostik Login Kiosk — Stasiun Tak Terdaftar
        </h2>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Percobaan login dari station yang tidak ada di registry (event SECURITY_REJECTION, STATION_NOT_FOUND).
        Daftarkan stasiunnya agar kiosk tersebut bisa login.
      </p>

      {isLoading ? (
        <p className="text-xs text-slate-400 py-2">Memuat diagnostik...</p>
      ) : error ? (
        <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
          {error}
        </div>
      ) : unknownStations.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">
          Tidak ada percobaan login dari stasiun tak terdaftar.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {unknownStations.map((st, idx) => (
            <li key={idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 font-tabular truncate" title={st.label}>
                  {st.label}
                </div>
                <div className="text-[11px] text-slate-500">
                  {st.count} percobaan gagal
                  {st.lastSeenAt ? ` · terakhir ${new Date(st.lastSeenAt).toLocaleString()}` : ''}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onRegister(st.label)}>
                <Plus className="w-3.5 h-3.5" />
                <span>Daftarkan</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {totalEvents !== null && unknownStations.length > 0 && totalEvents > 50 && (
        <p className="text-[11px] text-slate-400">
          Menampilkan 50 event SECURITY_REJECTION terbaru dari {totalEvents} event.
        </p>
      )}
    </section>
  );
};
