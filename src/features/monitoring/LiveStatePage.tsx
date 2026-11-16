import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Thermometer, Cpu, AlertCircle, Wifi } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { telemetrySocket, WsConnectionStatus } from '../../services/ws/telemetrySocket';
import { LiveStateRecord, MachineFsmState } from '../../types/monitoring';
import { MachineStateBadge } from '../../components/industrial/MachineStateBadge';
import { Button } from '../../components/ui/Button';
import { formatDuration } from '../../utils/oeeCalculations';

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

  const loadLiveState = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getLiveState();
      setRecords(data);
    } catch {
      // Handle silently
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRecords.map((rec) => (
          <div
            key={rec.device_id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{rec.machine_name}</div>
                  <div className="text-[11px] font-tabular text-slate-500">
                    {rec.machine_id || '[unbound]'} · {rec.device_id}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <MachineStateBadge state={rec.fsm_state} />
                  <span
                    className={`text-[10px] font-semibold font-tabular px-1.5 py-0.5 rounded border ${
                      rec.device_online
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {rec.device_online ? 'DEVICE ONLINE' : 'DEVICE OFFLINE'}
                  </span>
                </div>
              </div>

              <div className="mt-3 p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-[11px] block">Active Work Order</span>
                  <span className="font-semibold font-tabular text-sky-600 dark:text-sky-400">
                    {rec.active_work_order || 'Idle / No WO'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">Product</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px] block">
                    {rec.active_product || '-'}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center font-tabular">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-[10px] text-slate-400 block uppercase">OEE</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{rec.oee.toFixed(1)}%</span>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-[10px] text-slate-400 block uppercase">Avail</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{rec.availability.toFixed(1)}%</span>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-[10px] text-slate-400 block uppercase">Perf</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{rec.performance.toFixed(1)}%</span>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-[10px] text-slate-400 block uppercase">Qual</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{rec.quality.toFixed(1)}%</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-tabular">
                <div className="p-2 border border-slate-100 dark:border-slate-800 rounded flex items-center justify-between">
                  <span className="text-slate-400">Good / Rej</span>
                  <span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{rec.good_count}</strong>
                    <span className="text-slate-400 mx-1">/</span>
                    <strong className="text-red-500">{rec.reject_count}</strong>
                  </span>
                </div>
                <div className="p-2 border border-slate-100 dark:border-slate-800 rounded flex items-center justify-between">
                  <span className="text-slate-400">Last Cycle</span>
                  <strong className="text-slate-800 dark:text-slate-200">{rec.last_cycle_time_sec || '-'}s</strong>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-tabular gap-2">
                <div className="flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>RPM: {rec.spindle_rpm ?? '-'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Temp: {rec.machine_temp_c ?? '-'}°C</span>
                </div>
                {rec.plc_alarm_code !== undefined && rec.plc_alarm_code > 0 && (
                  <div className="flex items-center gap-1 text-red-500 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>PLC E-{rec.plc_alarm_code}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-tabular text-slate-400">
              <span>Run: {formatDuration(rec.run_time_seconds)}</span>
              <span>DT: {formatDuration(rec.downtime_seconds)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
