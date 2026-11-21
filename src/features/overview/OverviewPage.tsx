import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  Wifi,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { telemetrySocket, WsConnectionStatus } from '../../services/ws/telemetrySocket';
import { useCapability } from '../../context/AuthContext';
import { LiveStateRecord, DowntimeEvent, OperationalEvent } from '../../types/monitoring';
import { SystemHealth } from '../../types/system';
import { WorkOrder } from '../../types/production';
import { MetricCard } from '../../components/industrial/MetricCard';
import { OverviewLiveTable } from './components/OverviewLiveTable';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadErrorBanner } from '../shared/LoadErrorBanner';
import { formatDuration, formatDeletedRelationLabel } from '../../utils/oeeCalculations';
import { formatTimeWithSeconds } from '../../utils/formatDate';

export const OverviewPage: React.FC = () => {
  const [liveStates, setLiveStates] = useState<LiveStateRecord[]>([]);
  const [activeDowntimes, setActiveDowntimes] = useState<DowntimeEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<OperationalEvent[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>(telemetrySocket.getStatus());
  const [isLoading, setIsLoading] = useState(true);
  // E28 Batch A (FAT-215 E2E-01): kegagalan muat JANGAN ditelan diam-diam —
  // tampilkan banner + retry; data lama dipertahankan (stale-while-revalidate).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const canManageIam = useCapability('access_control.manage');
  const canReadBroker = useCapability('mqtt.config.read');

  const loadData = useCallback(async () => {
    try {
      const [states, downtimes, sysHealth, woPage, opEventsPage] = await Promise.all([
        apiClient.getLiveState(),
        apiClient.getActiveDowntimes(),
        apiClient.getSystemHealth(),
        apiClient.getWorkOrdersPage({ limit: 20 }),
        apiClient.getOperationalEventsPage({ limit: 5 }),
      ]);
      setLiveStates(states);
      setActiveDowntimes(downtimes);
      setHealth(sysHealth);
      setWorkOrders(woPage.data);
      setRecentEvents(opEventsPage.data.slice(0, 5));
      setLoadError(null);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      // E28 Batch A (FAT-215 E2E-01): jangan `catch {}` — catat pesan agar
      // banner error + retry bisa tampil; kartu lama tetap tampil.
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data overview.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    apiClient.getTelemetryWebSocketUrl();
    telemetrySocket.connect(loadData);
    setWsStatus(telemetrySocket.getStatus());

    const unsubStatus = telemetrySocket.subscribeStatus((status) => {
      setWsStatus(status);
    });

    const unsubEvents = telemetrySocket.subscribe((event) => {
      if (event.type === 'TELEMETRY_UPDATE') {
        setLiveStates((prev) =>
          prev.map((row) =>
            row.device_id === event.device_id
              ? {
                  ...row,
                  fsm_state: event.fsm_state ?? row.fsm_state,
                  total_count: event.counters?.total ?? row.total_count,
                  good_count: event.counters?.good ?? row.good_count,
                  reject_count: event.counters?.reject ?? row.reject_count,
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
        setLastUpdated(new Date());
      } else {
        loadData();
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, [loadData]);

  // Derived fleet metrics using canonical 6-state FSM + separate device_online presence
  const onlineMachines = liveStates.filter((s) => s.device_online);
  const runningCount = liveStates.filter((s) => s.fsm_state === 'RUNNING').length;
  const downtimeCount = liveStates.filter(
    (s) => s.fsm_state === 'UNPLANNED_DOWNTIME' || s.fsm_state === 'PLANNED_DOWNTIME'
  ).length;
  const avgOee =
    onlineMachines.length > 0
      ? (onlineMachines.reduce((acc, s) => acc + s.oee, 0) / onlineMachines.length).toFixed(1)
      : '0.0';
  const unlabeledDowntimes = activeDowntimes.filter((d) => !d.is_labeled).length;
  const activeWorkOrders = workOrders.filter((w) => w.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Plant Telemetry &amp; OEE Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
            <span>Pemantauan kondisi mesin dan pencapaian OEE pabrik secara langsung</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-tabular">
              <Wifi className={`w-3 h-3 ${wsStatus === 'CONNECTED' ? 'text-emerald-500' : 'text-amber-500'}`} />
              Koneksi Langsung:{' '}
              {wsStatus === 'CONNECTED'
                ? 'Terhubung'
                : wsStatus === 'CONNECTING'
                ? 'Menyambungkan'
                : 'Terputus'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-tabular">
            <Clock className="w-3.5 h-3.5" />
            <span>Diperbarui: {formatTimeWithSeconds(lastUpdated)}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* E28 Batch A (FAT-215 E2E-01): banner error + retry bila muat gagal. */}
      {loadError && !isLoading && (
        <LoadErrorBanner
          title="Gagal memuat data overview"
          message={loadError}
          onRetry={() => void loadData()}
        />
      )}

      {/* Top KPI Grid (Max 4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Plant Average OEE"
          value={avgOee}
          unit="%"
          subtext={`Rata-rata ${onlineMachines.length} mesin online`}
          statusVariant={Number(avgOee) >= 80 ? 'success' : Number(avgOee) >= 65 ? 'warning' : 'danger'}
          icon={<Activity className="w-4 h-4" />}
        />

        <MetricCard
          label="Machines Running"
          value={`${runningCount} / ${liveStates.length}`}
          unit="Units"
          subtext={`${downtimeCount} dalam downtime · ${onlineMachines.length} device online`}
          statusVariant={downtimeCount > 0 ? 'warning' : 'success'}
          icon={<Cpu className="w-4 h-4" />}
        />

        <MetricCard
          label="Active Downtimes"
          value={activeDowntimes.length}
          unit="Events"
          subtext={unlabeledDowntimes > 0 ? `${unlabeledDowntimes} belum dilabeli` : 'Semua terklasifikasi'}
          statusVariant={activeDowntimes.length > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="w-4 h-4" />}
        />

        <MetricCard
          label="System Health"
          value={health?.status || 'UNKNOWN'}
          subtext={
            health
              ? `Layar aktif: ${health.ws_clients} · Basis data: ${health.db_connected ? 'Terhubung' : 'Terputus'} · Antrean gagal: ${health.buffer_dropped}`
              : 'Menunggu data sistem...'
          }
          statusVariant={health?.status === 'ok' ? 'success' : 'warning'}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
      </div>

      {/* Secondary Grid: Active Machine State Matrix & Downtime / Events */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Machine Status Matrix — E31.12 (FAT-275): kartu tabel
            dipindah ke components/OverviewLiveTable.tsx */}
        <OverviewLiveTable liveStates={liveStates} isLoading={isLoading} />

        {/* Right Panel: Quick Actions & Downtime Summary */}
        <div className="space-y-6">
          {/* Active Downtime Quick Queue */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>Active Downtime Queue</span>
              </h2>
              <Link to="/admin/downtime" className="text-xs text-sky-600 dark:text-sky-400 hover:underline">
                Kelola
              </Link>
            </div>
            <div className="p-3 divide-y divide-slate-100 dark:divide-slate-800">
              {activeDowntimes.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  Tidak ada mesin dalam status downtime saat ini.
                </p>
              ) : (
                activeDowntimes.map((dt) => {
                  const machineLbl = formatDeletedRelationLabel(dt.machine_name, dt.machine_id);
                  return (
                    <div key={dt.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {machineLbl.label}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{dt.reason}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={dt.is_labeled ? 'info' : 'danger'}>
                          {dt.is_labeled ? 'Labeled' : 'Unlabeled'}
                        </Badge>
                        <div className="text-[11px] font-tabular text-slate-400 mt-1">
                          {dt.durationFormatted || formatDuration(dt.duration_seconds)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Operational Navigation Shortcuts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Quick Operational Links
            </h2>
            <div className="grid grid-cols-1 gap-2">
              <Link
                to="/admin/work-orders"
                className="flex items-center justify-between p-2.5 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-sky-500" />
                  Daftar &amp; Pemeriksaan Work Order ({activeWorkOrders} Aktif)
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              {canManageIam.canInteract && (
                <Link
                  to="/admin/access-control"
                  className="flex items-center justify-between p-2.5 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-500" />
                    Manajemen Hak Akses Pengguna
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              )}
              {canReadBroker.canInteract && (
                <Link
                  to="/admin/mqtt/configuration"
                  className="flex items-center justify-between p-2.5 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Pengaturan Koneksi Broker
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Latest Operational Events Feed (from GET /api/v1/operational-events) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Operational Events (Global Feed)
          </h2>
          <Link to="/admin/audit" className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline">
            Semua Event →
          </Link>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
          {isLoading && recentEvents.length === 0 ? (
            <div className="px-4 py-2.5" aria-busy="true" aria-label="Memuat event operasional">
              <div className="h-5 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
              <span className="sr-only">Memuat event operasional…</span>
            </div>
          ) : recentEvents.length === 0 ? (
            <p className="px-4 py-4 text-center text-slate-500 dark:text-slate-400">
              Belum ada event operasional terbaru.
            </p>
          ) : (
            recentEvents.map((ev) => {
            const devLbl = formatDeletedRelationLabel(ev.machine_name, ev.device_id);
            return (
              <div key={ev.id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Badge variant="info">{ev.event_type}</Badge>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 mr-2">
                      {devLbl.label}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">{ev.description}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-tabular text-slate-400 shrink-0">
                  <span>{ev.acknowledged ? 'Ack' : 'Pending Ack'}</span>
                  <span>{ev.recorded_at ? formatTimeWithSeconds(ev.recorded_at) : '—'}</span>
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>
    </div>
  );
};
