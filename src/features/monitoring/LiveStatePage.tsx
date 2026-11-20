import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Wifi } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { telemetrySocket, WsConnectionStatus } from '../../services/ws/telemetrySocket';
import { LiveStateRecord, MachineFsmState } from '../../types/monitoring';
import { Button } from '../../components/ui/Button';
import { LiveStateCard } from './components/LiveStateCard';
import { LoadErrorBanner } from '../shared/LoadErrorBanner';
import { EmptyStateBlock } from '../shared/TableStateRow';

const FSM_FILTER_STATES: Array<'ALL' | MachineFsmState> = [
  'ALL',
  'RUNNING',
  'READY',
  'UNCONFIGURED',
  'PLANNED_DOWNTIME',
  'UNPLANNED_DOWNTIME',
  'BATCH_FINISHED',
];

export const LiveStatePage: React.FC = () => {
  const [records, setRecords] = useState<LiveStateRecord[]>([]);
  const [filterState, setFilterState] = useState<'ALL' | MachineFsmState>('ALL');
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>(telemetrySocket.getStatus());
  const [isLoading, setIsLoading] = useState(true);
  // E28 Batch A (FAT-215 E2E-01): kegagalan muat JANGAN ditelan diam-diam.
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLiveState = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getLiveState();
      setRecords(data);
      setLoadError(null);
    } catch (err: unknown) {
      // E28 Batch A (FAT-215 E2E-01): jangan `catch {}` — catat pesan agar
      // banner error + retry bisa tampil; kartu lama tetap tampil.
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat status mesin.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveState();
    apiClient.getTelemetryWebSocketUrl();
    telemetrySocket.connect(loadLiveState);
    setWsStatus(telemetrySocket.getStatus());

    const unsubStatus = telemetrySocket.subscribeStatus((status) => {
      setWsStatus(status);
    });

    const unsubEvents = telemetrySocket.subscribe((event) => {
      if (event.type === 'TELEMETRY_UPDATE') {
        setRecords((prev) =>
          prev.map((row) =>
            row.device_id === event.device_id
              ? {
                  ...row,
                  fsm_state: event.fsm_state ?? row.fsm_state,
                  total_count: event.counters?.total ?? row.total_count,
                  good_count: event.counters?.good ?? row.good_count,
                  reject_count: event.counters?.reject ?? row.reject_count,
                  last_cycle_time_sec: event.counters?.last_cycle_sec ?? row.last_cycle_time_sec,
                  oee: event.oee?.total_oee ?? row.oee,
                  availability: event.oee?.availability ?? row.availability,
                  performance: event.oee?.performance ?? row.performance,
                  quality: event.oee?.quality ?? row.quality,
                  spindle_rpm: event.plc_modbus?.spindle_rpm ?? row.spindle_rpm,
                  machine_temp_c: event.plc_modbus?.temp_c ?? row.machine_temp_c,
                  plc_alarm_code: event.plc_modbus?.alarm_code ?? row.plc_alarm_code,
                  last_telemetry_at: event.timestampIso,
                }
              : row
          )
        );
      } else {
        loadLiveState();
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, [loadLiveState]);

  const filteredRecords = records.filter((r) => {
    if (filterState === 'ALL') return true;
    return r.fsm_state === filterState;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Live Machine State Monitor (Read-Only Telemetry)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
            <span>Pemantauan langsung 6 status operasional seluruh mesin di lantai produksi</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-tabular">
              <Wifi className={`w-3 h-3 ${wsStatus === 'CONNECTED' ? 'text-emerald-500' : 'text-amber-500'}`} />
              {wsStatus === 'CONNECTED'
                ? 'Terhubung'
                : wsStatus === 'CONNECTING'
                ? 'Menyambungkan'
                : 'Terputus'}
            </span>
          </p>
        </div>

        <Button size="sm" variant="secondary" onClick={loadLiveState} isLoading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Live Feed</span>
        </Button>
      </div>

      {/* E28 Batch A (FAT-215 E2E-01): banner error + retry bila muat gagal. */}
      {loadError && !isLoading && (
        <LoadErrorBanner
          title="Gagal memuat status mesin"
          message={loadError}
          onRetry={() => void loadLiveState()}
        />
      )}

      {/* 6 Canonical FSM State Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {FSM_FILTER_STATES.map((st) => {
          const count = st === 'ALL' ? records.length : records.filter((r) => r.fsm_state === st).length;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setFilterState(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
                filterState === st
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {st} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid of Machine Telemetry Cards (Strict Read-Only — ZERO Actuation Commands per ADR-003) */}
      {isLoading && records.length === 0 ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          aria-busy="true"
          aria-label="Memuat status mesin"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-3"
            >
              <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
          <span className="sr-only">Memuat status mesin…</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-center space-y-2">
          <EmptyStateBlock
            emptyTitle={records.length === 0 ? 'Belum ada data live-state' : 'Tidak ada mesin pada filter ini'}
            emptyDescription={
              records.length === 0
                ? 'Tidak ada mesin yang melaporkan status saat ini.'
                : 'Coba pilih filter status FSM lain.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRecords.map((rec) => (
            <LiveStateCard key={rec.device_id} rec={rec} />
          ))}
        </div>
      )}
    </div>
  );
};
