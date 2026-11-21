import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { LoadErrorBanner } from '../../shared/LoadErrorBanner';
import { UnknownStation } from '../hooks/useUnknownStations';
import { formatDateTime } from '../../../utils/formatDate';

export interface UnknownStationsPanelProps {
  unknownStations: UnknownStation[];
  isLoading: boolean;
  error: string | null;
  /** Total event SECURITY_REJECTION di server (null bila tak diketahui). */
  totalEvents: number | null;
  onRegister: (label: string) => void;
}

/**
 * E27 Spec 043 (FAT-234, T3): diagnostik terminal tak dikenal — stasiun yang
 * pernah mencoba mengirim data tanpa terdaftar (event SECURITY_REJECTION,
 * device_id null). E30 (FAT-256, P30.3): bingkai baru — yang diaudit BUKAN
 * lagi "percobaan login" (HMI tidak lagi memakai login), melainkan terminal
 * tak dikenal yang mencoba KIRIM DATA. Logika derivasi tidak berubah:
 * event SECURITY_REJECTION + device_id null + station_label mentah.
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
      aria-label="Diagnostik terminal tak dikenal"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Diagnostik Terminal — Stasiun Tak Terdaftar
        </h2>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Terminal HMI yang mencoba mengirim data tanpa terdaftar di registry
        (event SECURITY_REJECTION, device_id null, station_label mentah).
        Daftarkan stasiunnya agar terminal tersebut bisa mengirim data.
      </p>

      {isLoading ? (
        <p className="text-xs text-slate-400 py-2">Memuat diagnostik...</p>
      ) : error ? (
        <LoadErrorBanner title="Gagal memuat diagnostik stasiun" message={error} />
      ) : unknownStations.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">
          Tidak ada terminal tak dikenal yang mencoba mengirim data.
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
                  {st.count} percobaan kirim data
                  {st.lastSeenAt ? ` · terakhir ${formatDateTime(st.lastSeenAt)}` : ''}
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
