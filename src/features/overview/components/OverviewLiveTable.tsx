import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { LiveStateRecord } from '../../../types/monitoring';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { TableStateRow } from '../../shared/TableStateRow';

interface OverviewLiveTableProps {
  liveStates: LiveStateRecord[];
  isLoading: boolean;
}

/**
 * Kartu tabel ringkasan live-state di Overview (E31.12, FAT-275 —
 * diekstrak dari OverviewPage). Satu kartu = satu komponen.
 */
export const OverviewLiveTable: React.FC<OverviewLiveTableProps> = ({ liveStates, isLoading }) => {
  return (
    <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Live Machine State Matrix
        </h2>
        <Link
          to="/admin/live-state"
          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
        >
          <span>Buka Monitor Detail</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* E31.10 (FAT-273) BYPASS: tabel ringkasan live-state ini TIDAK
          dimigrasi ke DataTable. Tabel berada di dalam kartu seksi
          dashboard yang sudah punya header sendiri (judul + link "Buka
          Monitor Detail"); DataTable membawa kartu sendiri (border +
          rounded) sehingga migrasi akan menumpuk dua kartu. Loading
          skeleton kustom (3 baris pulse + sr-only) juga terikat pada
          kartu seksi ini. Isi tabel sendiri sebenarnya didukung
          ColumnDef — bila DataTable kelak mendukung mode tanpa-kartu,
          migrasi ini bisa dilakukan. */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-4">Mesin / Device</th>
              <th className="py-2.5 px-4">FSM State &amp; Presence</th>
              <th className="py-2.5 px-4">Active WO</th>
              <th className="py-2.5 px-4 text-right">OEE</th>
              <th className="py-2.5 px-4 text-right">Parts (G/R)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {isLoading && liveStates.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2.5 px-4">
                  <div className="space-y-2" aria-busy="true" aria-label="Memuat status mesin">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-5 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
                    ))}
                    <span className="sr-only">Memuat status mesin…</span>
                  </div>
                </td>
              </tr>
            ) : liveStates.length === 0 ? (
              <TableStateRow
                isLoading={false}
                isError={false}
                colSpan={5}
                emptyTitle="Belum ada data live-state"
                emptyDescription="Tidak ada mesin yang melaporkan status saat ini."
              />
            ) : (
              liveStates.map((st) => (
                <tr key={st.device_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{st.machine_name}</div>
                    <div className="text-[11px] text-slate-500 font-tabular">
                      {st.machine_id || '[unlinked]'} · {st.device_id}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <MachineStateBadge state={st.fsm_state} />
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          st.device_online
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {st.device_online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-tabular text-slate-700 dark:text-slate-300">
                    {st.active_work_order ? (
                      <div>
                        <div className="font-medium text-sky-600 dark:text-sky-400">{st.active_work_order}</div>
                        <div className="text-[11px] text-slate-400">{st.active_product}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Idle / No WO</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular font-semibold text-slate-900 dark:text-slate-100">
                    {st.oee.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-4 text-right font-tabular">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{st.good_count}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-red-500 dark:text-red-400 font-medium">{st.reject_count}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
