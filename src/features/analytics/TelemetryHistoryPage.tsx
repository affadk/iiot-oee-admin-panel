import React, { useEffect, useMemo, useState } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { useQuery } from '@tanstack/react-query';
import { Database, Download, RefreshCw, Info, Layers, Clock, BarChart3 } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import {
  HourlyOeePoint,
  TelemetryHistoryRecord,
  TelemetryRollupGroupBy,
  TelemetryRollupItem,
} from '../../types/analytics';
import { ExportFormat, TimeWindowPreset } from '../../types/historical';
import { ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import { MachineStateBadge } from '../../components/industrial/MachineStateBadge';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/industrial/DataTable';
import { HistoricalExportToolbar } from '../../components/industrial/HistoricalExportToolbar';
import {
  DEFAULT_HISTORY_PAGE_LIMIT,
  resolveTimeWindowPreset,
  triggerBrowserDownload,
  withExportAbortTimeout,
} from '../../utils/historicalExport';
import { formatDuration, parseServerMetric } from '../../utils/oeeCalculations';
import { formatRollupPerformance, useHistoryFilters } from '../shared/historyFilters';
import {
  useMasterAssetsQuery,
  useTelemetryHistoryQuery,
  useTelemetryRollupQuery,
} from '../shared/useHistoricalQueries';

type AggBucket = '1m' | '5m' | '15m' | '1h' | '1d';
type TelemetryTab = 'raw' | 'hourly' | 'aggregate' | 'rollup';

export const TelemetryHistoryPage: React.FC = () => {
  const { reportForbidden } = useAuth();
  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    deviceId: 'STM32-OEE-01',
    groupBy: 'machine',
    bucket: '1h',
    limit: DEFAULT_HISTORY_PAGE_LIMIT,
  });

  const [activeTab, setActiveTab] = useState<TelemetryTab>('raw');
  const [customDeviceInput, setCustomDeviceInput] = useState<string>('');
  const [rollupDeviceFilter, setRollupDeviceFilter] = useState<string>('ALL');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];

  const selectedDevice = filters.deviceId || 'STM32-OEE-01';
  const aggBucket: AggBucket = filters.bucket ?? '1h';
  const groupBy: TelemetryRollupGroupBy = filters.groupBy ?? 'machine';
  const canExport = useCapability('export.telemetry', selectedDevice);

  const [preset, setPreset] = useState<TimeWindowPreset>('7d');
  const [isExporting, setIsExporting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [exportError, setExportError] = useState<{
    code?: string;
    status?: number;
    message: string;
  } | null>(null);
  const [lastExport, setLastExport] = useState<Awaited<
    ReturnType<typeof apiClient.exportTelemetryData>
  > | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const handleFilterChange = (patch: Parameters<typeof updateFilters>[0]) => {
    setCursorStack([undefined]);
    updateFilters(patch);
  };

  const { data: masterData } = useMasterAssetsQuery();
  const devices = masterData?.devices ?? [];
  const machines = masterData?.machines ?? [];

  const telemetryQuery = useTelemetryHistoryQuery(
    selectedDevice,
    filters,
    activeCursor,
    isValid && activeTab === 'raw'
  );

  const hourlyQuery = useQuery({
    queryKey: ['telemetry-hourly', selectedDevice, filters.from, filters.to],
    enabled: isValid && Boolean(selectedDevice) && (activeTab === 'hourly' || activeTab === 'raw'),
    staleTime: 5_000,
    queryFn: ({ signal }) => apiClient.getHourlyTrend(selectedDevice, signal),
  });

  const aggregateQuery = useQuery({
    queryKey: ['telemetry-aggregate', selectedDevice, aggBucket],
    enabled: isValid && Boolean(selectedDevice) && (activeTab === 'aggregate' || activeTab === 'raw'),
    staleTime: 5_000,
    queryFn: ({ signal }) => apiClient.getTelemetryAggregate(selectedDevice, aggBucket, signal),
  });

  const rollupFilters = useMemo(
    () => ({
      ...filters,
      deviceId: rollupDeviceFilter === 'ALL' ? undefined : rollupDeviceFilter,
    }),
    [filters, rollupDeviceFilter]
  );

  const rollupQuery = useTelemetryRollupQuery(
    rollupFilters,
    activeCursor,
    isValid && activeTab === 'rollup'
  );

  const handlePresetChange = (nextPreset: TimeWindowPreset) => {
    setPreset(nextPreset);
    setExportError(null);
    if (nextPreset !== 'custom') {
      const range = resolveTimeWindowPreset(nextPreset);
      handleFilterChange({ from: range.from, to: range.to });
    }
  };

  const handleExport = async (format: ExportFormat, hourlyOnly = false) => {
    if (isExporting || cooldownSeconds > 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await withExportAbortTimeout(undefined, (signal) => {
        const payload = {
          device_id: selectedDevice,
          from: filters.from,
          to: filters.to,
          format,
        };
        return hourlyOnly
          ? apiClient.exportTelemetryHourlyData(payload, signal)
          : apiClient.exportTelemetryData(payload, signal);
      });
      setLastExport(result);
      triggerBrowserDownload(result.filename, result.content, result.mimeType);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('export.telemetry', selectedDevice, err.message);
      }
      const status =
        err instanceof ApiError
          ? err.httpStatus
          : (err as { status?: number })?.status;
      if (status === 429) {
        setCooldownSeconds(30);
      }
      setExportError({
        code: (err as { code?: string })?.code,
        status,
        message: err instanceof Error ? err.message : 'Gagal mengekspor telemetri historis.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const rawColumns = useMemo<ColumnDef<TelemetryHistoryRecord, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {new Date(row.original.timestamp).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'fsm_state',
        header: 'FSM State',
        cell: ({ row }) => <MachineStateBadge state={row.original.fsm_state} />,
      },
      {
        id: 'mode',
        header: 'Packet Mode',
        cell: ({ row }) =>
          row.original.is_buffered ? (
            <Badge variant="warning">BUFFERED</Badge>
          ) : (
            <Badge variant="success">REALTIME</Badge>
          ),
      },
      {
        id: 'oee',
        header: 'OEE / A / P / Q',
        cell: ({ row }) => {
          const rec = row.original;
          return (
            <div className="font-tabular text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {rec.oee.toFixed(1)}%
              </span>
              <span className="text-[11px] text-slate-400 ml-1.5">
                ({rec.availability.toFixed(0)}/{rec.performance.toFixed(0)}/{rec.quality.toFixed(0)})
              </span>
            </div>
          );
        },
      },
      {
        id: 'counters',
        header: 'Counters (T / G / R)',
        cell: ({ row }) => {
          const rec = row.original;
          const total = rec.totalCount ?? rec.total_count;
          const good = rec.goodCount ?? rec.good_count;
          const reject = rec.rejectCount ?? rec.reject_count;
          return (
            <span className="font-tabular text-xs">
              {total} / <span className="text-emerald-600 dark:text-emerald-400">{good}</span> /{' '}
              <span className="text-red-500">{reject}</span>
            </span>
          );
        },
      },
      {
        id: 'durations',
        header: 'Op / Run / Down',
        cell: ({ row }) => {
          const rec = row.original;
          return (
            <span className="font-tabular text-xs text-slate-500 dark:text-slate-400">
              {formatDuration(rec.operatingTimeSec ?? 0)} / {formatDuration(rec.runTimeSec ?? 0)} /{' '}
              {formatDuration(rec.downtimeSec ?? 0)}
            </span>
          );
        },
      },
      {
        id: 'cycle',
        header: 'Cycle / Temp',
        cell: ({ row }) => {
          const rec = row.original;
          const cycleSec =
            rec.lastCycleTimeSec !== undefined && rec.lastCycleTimeSec !== null
              ? rec.lastCycleTimeSec.toFixed(1)
              : (rec.cycle_time_ms / 1000).toFixed(1);
          return (
            <span className="font-tabular text-xs text-slate-500">
              {cycleSec}s · {rec.temperature_c ?? '-'}°C
            </span>
          );
        },
      },
    ],
    []
  );

  const hourlyColumns = useMemo<ColumnDef<HourlyOeePoint, unknown>[]>(
    () => [
      {
        id: 'hour',
        header: 'Bucket Jam',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-tabular text-xs font-semibold text-slate-900 dark:text-slate-100">
            <span>{row.original.hour}</span>
            {row.original.provisional && (
              <span className="text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400">
                (Provisional)
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'state',
        header: 'State Dominan',
        cell: ({ row }) =>
          row.original.state ? <MachineStateBadge state={row.original.state} /> : <span>—</span>,
      },
      {
        id: 'oee',
        header: 'OEE %',
        cell: ({ row }) => (
          <span className="font-tabular text-xs font-bold text-slate-900 dark:text-slate-100">
            {parseServerMetric(row.original.oee).toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'apq',
        header: 'A / P / Q',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-600 dark:text-slate-300">
            {row.original.availability.toFixed(1)}% / {row.original.performance.toFixed(1)}% /{' '}
            {row.original.quality.toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'delta',
        header: 'Delta Output / Reject',
        cell: ({ row }) => (
          <span className="font-tabular text-xs">
            {row.original.parts_produced} pcs ·{' '}
            <span className="text-red-500">{row.original.defect_count} reject</span>
          </span>
        ),
      },
      {
        id: 'samples',
        header: 'Sampel',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500">
            {row.original.sampleCount ?? 0} sampel
          </span>
        ),
      },
    ],
    []
  );

  const rollupColumns = useMemo<ColumnDef<TelemetryRollupItem, unknown>[]>(
    () => [
      {
        id: 'groupKey',
        header:
          groupBy === 'machine' ? 'Mesin / Perangkat' : groupBy === 'day' ? 'Tanggal' : 'Bulan',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {item.machine_name ?? item.groupKey}
                {item.provisional && (
                  <span className="ml-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    (Provisional)
                  </span>
                )}
              </div>
              <div className="font-tabular text-[11px] text-slate-400">
                {item.groupKey}
                {item.device_id ? ` · ${item.device_id}` : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'oeePct',
        header: 'OEE',
        cell: ({ row }) => (
          <span className="font-tabular text-xs font-bold text-slate-900 dark:text-slate-100">
            {parseServerMetric(row.original.oeePct).toFixed(2)}%
          </span>
        ),
      },
      {
        id: 'availPct',
        header: 'Availability',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {parseServerMetric(row.original.availabilityPct).toFixed(2)}%
          </span>
        ),
      },
      {
        id: 'perfPct',
        header: 'Performance',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {formatRollupPerformance(row.original.performancePct)}
          </span>
        ),
      },
      {
        id: 'qualPct',
        header: 'Quality',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-700 dark:text-slate-300">
            {parseServerMetric(row.original.qualityPct).toFixed(2)}%
          </span>
        ),
      },
      {
        id: 'counts',
        header: 'Total / Good / Reject',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="font-tabular text-xs">
              {r.totalCount} / <span className="text-emerald-600 dark:text-emerald-400">{r.goodCount}</span> /{' '}
              <span className="text-red-500">{r.rejectCount}</span>
            </span>
          );
        },
      },
      {
        id: 'time',
        header: 'Op / Run · Sampel',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500">
            {formatDuration(row.original.operatingSec)} / {formatDuration(row.original.runSec)} ·{' '}
            {row.original.sampleCount}
          </span>
        ),
      },
    ],
    [groupBy]
  );

  const rawRecords = telemetryQuery.data?.data ?? [];
  const rawPagination = telemetryQuery.data?.pagination;
  const rollupRecords = rollupQuery.data?.data ?? [];
  const rollupPagination = rollupQuery.data?.pagination;
  const hourlyData = hourlyQuery.data ?? [];
  const aggData = aggregateQuery.data;

  const deviceOptions = useMemo(() => {
    const ids = new Set(devices.map((d) => d.device_id));
    if (selectedDevice && !ids.has(selectedDevice)) {
      return [
        ...devices,
        {
          device_id: selectedDevice,
          bound_machine_name: '[dihapus / historis]',
        },
      ];
    }
    return devices;
  }, [devices, selectedDevice]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Telemetry History, Rollup &amp; Raw Export
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Data mentah perangkat, agregat interval, delta per jam (dengan penanda provisional), dan rollup multi-mesin/hari/bulan.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            telemetryQuery.refetch();
            hourlyQuery.refetch();
            aggregateQuery.refetch();
            rollupQuery.refetch();
          }}
          isLoading={telemetryQuery.isFetching || rollupQuery.isFetching}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {!isValid && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
        >
          <span>Filter tidak valid: {Object.values(validationErrors).join(' · ')}</span>
          <Button size="sm" variant="secondary" onClick={resetFilters}>
            Reset Filter
          </Button>
        </div>
      )}

      {/* Selectors */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="tel-device-select" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
            Edge Device (Aktif / Historis)
          </label>
          <select
            id="tel-device-select"
            value={selectedDevice}
            onChange={(e) => handleFilterChange({ deviceId: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            {deviceOptions.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.device_id} {d.bound_machine_name ? `— ${d.bound_machine_name}` : ''}
              </option>
            ))}
            <option value="STM32-OEE-90-DEL">STM32-OEE-90-DEL — [dihapus] (Histori)</option>
          </select>
        </div>

        <div>
          <label htmlFor="tel-custom-device" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
            Query ID Perangkat Kustom / Terhapus
          </label>
          <div className="flex gap-1.5">
            <input
              id="tel-custom-device"
              type="text"
              value={customDeviceInput}
              onChange={(e) => setCustomDeviceInput(e.target.value)}
              placeholder="mis. STM32-OEE-90-DEL"
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (customDeviceInput.trim()) {
                  handleFilterChange({ deviceId: customDeviceInput.trim() });
                }
              }}
            >
              Cari
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor="tel-buffered-select" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
            Sumber Data Rekaman
          </label>
          <select
            id="tel-buffered-select"
            value={
              filters.isBuffered === undefined ? 'ALL' : filters.isBuffered ? 'true' : 'false'
            }
            onChange={(e) =>
              handleFilterChange({
                isBuffered:
                  e.target.value === 'ALL' ? undefined : e.target.value === 'true',
              })
            }
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Semua (Langsung &amp; Buffer SD)</option>
            <option value="false">Hanya Pengiriman Langsung</option>
            <option value="true">Hanya Data Susulan (Buffered)</option>
          </select>
        </div>

        <div>
          <label htmlFor="tel-bucket-select" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
            Interval Downsampling
          </label>
          <select
            id="tel-bucket-select"
            value={aggBucket}
            onChange={(e) => handleFilterChange({ bucket: e.target.value as AggBucket })}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="1m">1 Menit (1m)</option>
            <option value="5m">5 Menit (5m)</option>
            <option value="15m">15 Menit (15m)</option>
            <option value="1h">1 Jam (1h)</option>
            <option value="1d">1 Hari (1d)</option>
          </select>
        </div>
      </div>

      {/* Aggregate & Hourly Quick Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-500" />
              <span>Ringkasan Agregat (Interval {aggBucket})</span>
            </h2>
            <span className="text-xs font-tabular text-slate-500">
              {aggData?.sample_count ?? 0} sampel
            </span>
          </div>
          {aggData && (
            <div className="grid grid-cols-4 gap-2 text-center font-tabular">
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-400 block">AVG OEE</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {aggData.avg_oee}%
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-400 block">AVAIL</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {aggData.avg_availability}%
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-400 block">PERF</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {aggData.avg_performance}%
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-400 block">PARTS</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {aggData.total_parts}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ringkasan Delta Per Jam ({hourlyData.filter((h) => h.provisional).length} provisional)
            </h2>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canExport.canInteract || isExporting || cooldownSeconds > 0}
              onClick={() => handleExport('csv', true)}
              title="Unduh laporan per jam dalam format CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Hourly CSV</span>
            </Button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
            <span>
              <strong>Per Jam vs Live-State:</strong> Bucket per jam adalah delta di dalam jam produksi tersebut dan bukan nilai kumulatif lifetime <code className="font-mono">live-state</code>.
            </span>
          </p>
        </div>
      </div>

      {/* Raw Export Toolbar */}
      <HistoricalExportToolbar
        preset={preset}
        onPresetChange={handlePresetChange}
        fromIso={filters.from}
        toIso={filters.to}
        onCustomRangeChange={(from, to) => handleFilterChange({ from, to })}
        onExport={(fmt) => handleExport(fmt, false)}
        isExporting={isExporting}
        exportError={exportError}
        onDismissError={() => setExportError(null)}
        lastExport={lastExport}
        onDismissExport={() => setLastExport(null)}
        resourceId={selectedDevice}
        scopeLabel={`Perangkat: ${selectedDevice}`}
        cooldownSeconds={cooldownSeconds}
      />

      {/* View Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div role="tablist" aria-label="Mode Tampilan Telemetri" className="flex flex-wrap gap-1.5">
          {[
            { id: 'raw', label: 'Data Mentah', icon: Database },
            { id: 'hourly', label: 'Delta Per Jam (Provisional)', icon: Clock },
            { id: 'aggregate', label: 'Downsampling Agregat', icon: Layers },
            { id: 'rollup', label: 'Rollup Multi-Mesin / Periode', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  setCursorStack([undefined]);
                  setActiveTab(tab.id as TelemetryTab);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'rollup' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Rollup Grouping"
              value={groupBy}
              onChange={(e) =>
                handleFilterChange({ groupBy: e.target.value as TelemetryRollupGroupBy })
              }
              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="machine">Group by: Mesin</option>
              <option value="day">Group by: Harian</option>
              <option value="month">Group by: Bulanan</option>
            </select>
            <select
              aria-label="Filter Mesin Rollup"
              value={filters.machineId ?? 'ALL'}
              onChange={(e) =>
                handleFilterChange({
                  machineId: e.target.value === 'ALL' ? undefined : e.target.value,
                })
              }
              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Semua Mesin</option>
              {machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id}>
                  {m.machine_id}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter Device Rollup"
              value={rollupDeviceFilter}
              onChange={(e) => {
                setCursorStack([undefined]);
                setRollupDeviceFilter(e.target.value);
              }}
              className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Semua Perangkat</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'raw' && (
        <DataTable
          data={rawRecords}
          columns={rawColumns}
          getRowId={(r) => r.id}
          isLoading={telemetryQuery.isLoading}
          isFetching={telemetryQuery.isFetching}
          error={telemetryQuery.error}
          onRetry={() => telemetryQuery.refetch()}
          dataUpdatedAt={telemetryQuery.dataUpdatedAt}
          emptyTitle="Tidak ada rekaman telemetri"
          emptyDescription={`Belum ada paket telemetri untuk ${selectedDevice} pada rentang waktu yang dipilih.`}
          emptyActionLabel="Reset ke 7 Hari"
          onEmptyAction={() => handlePresetChange('7d')}
          cursorPagination={{
            hasMore: Boolean(rawPagination?.has_more),
            hasPrev: cursorStack.length > 1,
            totalCount: rawPagination?.total_count,
            pageIndex: cursorStack.length - 1,
            onNextPage: () => {
              if (rawPagination?.next_cursor) {
                setCursorStack((prev) => [...prev, rawPagination.next_cursor ?? undefined]);
              }
            },
            onPrevPage: () =>
              setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
            onResetPage: () => setCursorStack([undefined]),
          }}
        />
      )}

      {activeTab === 'hourly' && (
        <DataTable
          data={hourlyData}
          columns={hourlyColumns}
          getRowId={(r) => r.hour}
          isLoading={hourlyQuery.isLoading}
          isFetching={hourlyQuery.isFetching}
          error={hourlyQuery.error}
          onRetry={() => hourlyQuery.refetch()}
          dataUpdatedAt={hourlyQuery.dataUpdatedAt}
          emptyTitle="Data per jam tidak tersedia"
          emptyDescription="Tidak ada bucket produksi per jam untuk perangkat ini."
        />
      )}

      {activeTab === 'aggregate' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Hasil Downsampling Interval {aggBucket} · {selectedDevice}
              </h3>
              <p className="text-xs text-slate-500">
                Menyaring resolusi data telemetri berdasarkan bucket waktu untuk analisis tren cepat.
              </p>
            </div>
            <Badge variant="info">{aggData?.sample_count ?? 0} sampel</Badge>
          </div>
          {aggregateQuery.isLoading ? (
            <div className="h-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : aggData ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-tabular">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[11px] text-slate-400">OEE Rata-rata</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {aggData.avg_oee}%
                </div>
              </div>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[11px] text-slate-400">Availability</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {aggData.avg_availability}%
                </div>
              </div>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[11px] text-slate-400">Performance</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {aggData.avg_performance}%
                </div>
              </div>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[11px] text-slate-400">Quality</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {aggData.avg_quality}%
                </div>
              </div>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[11px] text-slate-400">Total Parts</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {aggData.total_parts} pcs
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {activeTab === 'rollup' && (
        <DataTable
          data={rollupRecords}
          columns={rollupColumns}
          getRowId={(r) => r.groupKey}
          isLoading={rollupQuery.isLoading}
          isFetching={rollupQuery.isFetching}
          error={rollupQuery.error}
          onRetry={() => rollupQuery.refetch()}
          dataUpdatedAt={rollupQuery.dataUpdatedAt}
          emptyTitle="Tidak ada data rollup"
          emptyDescription="Tidak ada hasil agregasi rollup untuk kombinasi filter yang dipilih."
          cursorPagination={{
            hasMore: Boolean(rollupPagination?.has_more),
            hasPrev: cursorStack.length > 1,
            totalCount: rollupPagination?.total_count,
            pageIndex: cursorStack.length - 1,
            onNextPage: () => {
              if (rollupPagination?.next_cursor) {
                setCursorStack((prev) => [...prev, rollupPagination.next_cursor ?? undefined]);
              }
            },
            onPrevPage: () =>
              setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
            onResetPage: () => setCursorStack([undefined]),
          }}
        />
      )}
    </div>
  );
};
