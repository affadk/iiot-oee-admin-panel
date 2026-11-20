import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Tag, RefreshCw, Activity } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { DowntimeCategory, DowntimeEvent } from '../../types/monitoring';
import { ExportFormat, TimeWindowPreset } from '../../types/historical';
import { ApiError } from '../../types/auth';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/industrial/DataTable';
import { DowntimeReasonModal } from './DowntimeReasonModal';
import { HistoricalExportToolbar } from '../../components/industrial/HistoricalExportToolbar';
import {
  DEFAULT_HISTORY_PAGE_LIMIT,
  mapDowntimeToSixBigLoss,
  resolveTimeWindowPreset,
  triggerBrowserDownload,
  withExportAbortTimeout,
} from '../../utils/historicalExport';
import { formatDuration, formatDeletedRelationLabel } from '../../utils/oeeCalculations';
import { useHistoryFilters } from '../shared/historyFilters';
import {
  HISTORY_DATA_STALE_TIME_MS,
  useDowntimeHistoryQuery,
  useMasterAssetsQuery,
} from '../shared/useHistoricalQueries';
import { resolveDefaultDeviceId } from '../shared/defaultDevice';

const DOWNTIME_CATEGORY_OPTIONS: Array<{ value: 'ALL' | DowntimeCategory; label: string }> = [
  { value: 'ALL', label: 'Semua Kategori' },
  { value: 'EQUIPMENT_FAILURE', label: 'EQUIPMENT_FAILURE (Breakdown)' },
  { value: 'SETUP_AND_ADJUSTMENT', label: 'SETUP_AND_ADJUSTMENT' },
  { value: 'IDLING_AND_MINOR_STOPPAGE', label: 'IDLING_AND_MINOR_STOPPAGE' },
  { value: 'REDUCED_SPEED', label: 'REDUCED_SPEED' },
  { value: 'PROCESS_DEFECT', label: 'PROCESS_DEFECT' },
  { value: 'MATERIAL_SHORTAGE', label: 'MATERIAL_SHORTAGE' },
  { value: 'PLANNED_MAINTENANCE', label: 'PLANNED_MAINTENANCE' },
  { value: 'REST_BREAK', label: 'REST_BREAK' },
  { value: 'CLEANING_5S', label: 'CLEANING_5S' },
  { value: 'OTHER', label: 'OTHER' },
  // E23 Batch 3 (FAT-194, N-25): 'UNKNOWN' = server tidak mengirim
  // kategori (bukan nilai POST /reason) — filter sisi klien.
  { value: 'UNKNOWN', label: 'Belum dikategorikan' },
];

export const DowntimeEventsPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const { filters, isValid, validationErrors, updateFilters, resetFilters } = useHistoryFilters({
    // E28 Batch B (FAT-170, N-2): TANPA default device hardcode — device
    // dipilih dari daftar live di bawah (online dulu); bila URL membawa
    // device_id, nilai itu yang menang.
    limit: DEFAULT_HISTORY_PAGE_LIMIT,
  });

  // Tab awal 'history' hanya bila URL secara eksplisit meminta device
  // (tautan silang); tanpa itu tab 'active' — dulu memakai perbandingan
  // dengan hardcode 'STM32-OEE-01' sebagai penanda default.
  const [activeTab, setActiveTab] = useState<'active' | 'history'>(() =>
    searchParams.get('device_id') ? 'history' : 'active'
  );
  const [customDeviceInput, setCustomDeviceInput] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const activeCursor = cursorStack[cursorStack.length - 1];

  // E28 Batch B (FAT-170, N-2): default dari daftar live (online dulu,
  // lalu pertama); daftar kosong → tanpa default + empty state di bawah.
  const { data: masterData, isLoading: devicesLoading } = useMasterAssetsQuery();
  const devices = masterData?.devices ?? [];
  const derivedDefaultDevice = resolveDefaultDeviceId(devices);
  const selectedDeviceId = filters.deviceId ?? derivedDefaultDevice ?? '';

  const [preset, setPreset] = useState<TimeWindowPreset>('7d');
  const [isExporting, setIsExporting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [exportError, setExportError] = useState<{
    code?: string;
    status?: number;
    message: string;
  } | null>(null);
  const [lastExport, setLastExport] = useState<Awaited<
    ReturnType<typeof apiClient.exportDowntimeData>
  > | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DowntimeEvent | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const handleFilterChange = (patch: Parameters<typeof updateFilters>[0]) => {
    setCursorStack([undefined]);
    updateFilters(patch);
  };

  const activeQueueQuery = useQuery({
    queryKey: ['active-downtimes'],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) => apiClient.getActiveDowntimes(signal),
  });

  const historyQuery = useDowntimeHistoryQuery(
    selectedDeviceId,
    filters,
    activeCursor,
    isValid && activeTab === 'history'
  );

  const activeDowntimes = activeQueueQuery.data ?? [];
  const historyEvents = historyQuery.data?.data ?? [];
  const historyPagination = historyQuery.data?.pagination;

  const handlePresetChange = (nextPreset: TimeWindowPreset) => {
    setPreset(nextPreset);
    setExportError(null);
    if (nextPreset !== 'custom') {
      const range = resolveTimeWindowPreset(nextPreset);
      handleFilterChange({ from: range.from, to: range.to });
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!selectedDeviceId || isExporting || cooldownSeconds > 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await withExportAbortTimeout(undefined, (signal) =>
        apiClient.exportDowntimeData(
          {
            device_id: selectedDeviceId,
            category: filters.category,
            from: filters.from,
            to: filters.to,
            unlabeled_only: filters.unlabeledOnly || undefined,
            active_only: filters.activeOnly || undefined,
            format,
          },
          signal
        )
      );
      setLastExport(result);
      triggerBrowserDownload(result.filename, result.content, result.mimeType);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('telemetry.refresh', selectedDeviceId, err.message);
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
        message: err instanceof Error ? err.message : 'Gagal mengekspor data historis downtime.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClassificationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['active-downtimes'] });
    queryClient.invalidateQueries({ queryKey: ['downtime'] });
  };

  const columns = useMemo<ColumnDef<DowntimeEvent, unknown>[]>(
    () => [
      {
        id: 'machine',
        header: 'Mesin & Perangkat',
        cell: ({ row }) => {
          const ev = row.original;
          const machLbl = formatDeletedRelationLabel(ev.machine_name, ev.machine_id);
          const devLbl = formatDeletedRelationLabel(ev.device_id, null);
          return (
            <div className="text-xs">
              <div
                className={
                  machLbl.isDeleted
                    ? 'italic text-slate-400'
                    : 'font-semibold text-slate-900 dark:text-slate-100'
                }
              >
                {machLbl.label}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">
                {devLbl.isDeleted ? '[dihapus]' : ev.device_id}
              </div>
            </div>
          );
        },
      },
      {
        id: 'category',
        header: 'Six Big Losses & Kategori',
        cell: ({ row }) => {
          const ev = row.original;
          const sbl = mapDowntimeToSixBigLoss(ev.category);
          return (
            <div className="text-xs">
              {/* E23 Batch 3 (FAT-194, N-25): 'UNKNOWN' = server tidak
                  mengirim kategori — tampilkan label jujur. */}
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {ev.category === 'UNKNOWN' ? 'Belum dikategorikan' : ev.category}
              </div>
              <div className="text-[11px] text-sky-600 dark:text-sky-400">{sbl.label}</div>
            </div>
          );
        },
      },
      {
        id: 'reason',
        header: 'Alasan / Catatan',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className="text-xs max-w-xs">
              <div className="text-slate-800 dark:text-slate-200">{ev.reason}</div>
              {ev.notes && (
                <div className="text-[11px] text-slate-500 mt-0.5 italic">Note: {ev.notes}</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'duration',
        header: 'Durasi & Waktu',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className="text-xs font-tabular">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {ev.durationFormatted || formatDuration(ev.duration_seconds)}
              </div>
              <div className="text-[11px] text-slate-400">
                {new Date(ev.started_at).toLocaleString()}
                {ev.ended_at === null && ' (Ongoing)'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status Label',
        cell: ({ row }) => {
          const ev = row.original;
          return ev.is_labeled ? (
            <div className="space-y-1">
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Labeled
              </Badge>
              {ev.is_overwrite && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Overwritten
                </div>
              )}
            </div>
          ) : (
            <Badge variant="danger">Unlabeled</Badge>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Klasifikasi</div>,
        cell: ({ row }) => {
          const ev = row.original;
          const rowLabelCap = checkCapability('downtime_event.label', ev.id);
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={ev.is_labeled ? 'outline' : 'primary'}
                disabled={!rowLabelCap.canInteract}
                title={!rowLabelCap.canInteract ? rowLabelCap.reason : 'Labeli / overwrite alasan downtime'}
                onClick={() => setSelectedEvent(ev)}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{ev.is_labeled ? 'Overwrite' : 'Label'}</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [checkCapability]
  );

  const displayedEvents = activeTab === 'active' ? activeDowntimes : historyEvents;
  const unlabeledCount = displayedEvents.filter((e) => !e.is_labeled).length;

  const deviceOptions = useMemo(() => {
    const ids = new Set(devices.map((d) => d.device_id));
    if (selectedDeviceId && !ids.has(selectedDeviceId) && selectedDeviceId !== 'STM32-OEE-90-DEL') {
      return [
        ...devices,
        {
          device_id: selectedDeviceId,
          bound_machine_name: '[dihapus / historis]',
        },
      ];
    }
    return devices;
  }, [devices, selectedDeviceId]);

  const currentQuery = activeTab === 'active' ? activeQueueQuery : historyQuery;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Downtime Events &amp; Six Big Losses Classification
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar insiden henti mesin aktif dan riwayat per perangkat (mendukung filter kategori Six Big Losses &amp; unduh 90 hari).
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            activeTab === 'active' ? activeQueueQuery.refetch() : historyQuery.refetch()
          }
          isLoading={currentQuery.isFetching}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'active'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Active Downtimes Queue ({activeDowntimes.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Per-Device Historical Log &amp; Export
        </button>
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

      {/* History Device Selector + Filters + Export Toolbar */}
      {activeTab === 'history' && (
        <>
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label
                  htmlFor="downtime-device-select"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
                >
                  Target Edge Device (Per-Device)
                </label>
                <select
                  id="downtime-device-select"
                  value={selectedDeviceId}
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
                <label
                  htmlFor="downtime-custom-device"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
                >
                  Query ID Device Kustom / Terhapus
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="downtime-custom-device"
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
                <label
                  htmlFor="downtime-category-select"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
                >
                  Kategori Downtime
                </label>
                <select
                  id="downtime-category-select"
                  value={filters.category ?? 'ALL'}
                  onChange={(e) =>
                    handleFilterChange({
                      category: e.target.value === 'ALL' ? undefined : e.target.value,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                >
                  {DOWNTIME_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end gap-1.5 pb-0.5">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(filters.unlabeledOnly)}
                    onChange={(e) =>
                      handleFilterChange({
                        unlabeledOnly: e.target.checked ? true : undefined,
                      })
                    }
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span>Belum dilabeli (unlabeled_only)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(filters.activeOnly)}
                    onChange={(e) =>
                      handleFilterChange({
                        activeOnly: e.target.checked ? true : undefined,
                      })
                    }
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span>Hanya ongoing (active_only)</span>
                </label>
              </div>
            </div>
          </div>

          <HistoricalExportToolbar
            preset={preset}
            onPresetChange={handlePresetChange}
            fromIso={filters.from}
            toIso={filters.to}
            onCustomRangeChange={(from, to) => handleFilterChange({ from, to })}
            onExport={handleExport}
            isExporting={isExporting}
            exportError={exportError}
            onDismissError={() => setExportError(null)}
            lastExport={lastExport}
            onDismissExport={() => setLastExport(null)}
            resourceId={selectedDeviceId}
            scopeLabel={`Perangkat: ${selectedDeviceId}`}
            cooldownSeconds={cooldownSeconds}
          />

          {/* E28 Batch B (FAT-170): daftar device sudah dimuat tapi kosong
              — tidak ada default yang bisa dipilih; sampaikan eksplisit. */}
          {!devicesLoading && !selectedDeviceId && (
            <div
              role="status"
              className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200"
            >
              Belum ada perangkat edge yang terdaftar — daftarkan perangkat dulu di halaman Devices
              sebelum melihat riwayat downtime per perangkat.
            </div>
          )}
        </>
      )}

      {unlabeledCount > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Terdapat <strong>{unlabeledCount} insiden</strong> yang belum diberi klasifikasi Six Big Losses.
          </span>
        </div>
      )}

      <DataTable
        data={displayedEvents}
        columns={columns}
        getRowId={(r) => r.id}
        isLoading={currentQuery.isLoading}
        isFetching={currentQuery.isFetching}
        error={currentQuery.error}
        onRetry={() => currentQuery.refetch()}
        dataUpdatedAt={currentQuery.dataUpdatedAt}
        emptyTitle="Tidak ada insiden downtime"
        emptyDescription={
          activeTab === 'active'
            ? 'Semua mesin saat ini tidak memiliki insiden henti aktif.'
            : selectedDeviceId
              ? `Tidak ada riwayat downtime untuk ${selectedDeviceId} sesuai filter aktif.`
              : 'Belum ada perangkat yang dipilih — daftar device kosong.'
        }
        emptyActionLabel={activeTab === 'history' ? 'Reset Filter' : undefined}
        onEmptyAction={activeTab === 'history' ? resetFilters : undefined}
        cursorPagination={
          activeTab === 'history'
            ? {
                hasMore: Boolean(historyPagination?.has_more),
                hasPrev: cursorStack.length > 1,
                totalCount: historyPagination?.total_count,
                pageIndex: cursorStack.length - 1,
                onNextPage: () => {
                  if (historyPagination?.next_cursor) {
                    setCursorStack((prev) => [...prev, historyPagination.next_cursor ?? undefined]);
                  }
                },
                onPrevPage: () =>
                  setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
                onResetPage: () => setCursorStack([undefined]),
              }
            : undefined
        }
      />

      <DowntimeReasonModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSuccess={handleClassificationSuccess}
      />
    </div>
  );
};
