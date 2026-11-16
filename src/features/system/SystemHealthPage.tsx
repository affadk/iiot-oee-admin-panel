import React, { useEffect, useState, useCallback } from 'react';
import { Server, Database, Activity, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { SystemHealth } from '../../types/system';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDuration } from '../../utils/oeeCalculations';

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getSystemHealth();
      setHealth(res);
    } catch {
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            System Health &amp; Telemetry Ingestion Diagnostics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pemantauan kondisi layanan utama, koneksi basis data, antrean rekaman produksi, dan koneksi langsung ke layar pantau.
          </p>
        </div>

        <Button size="sm" variant="secondary" onClick={loadHealth} isLoading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {!health ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
          Memuat status kesehatan sistem...
        </div>
      ) : (
        <>
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant={health.status === 'ok' ? 'success' : 'danger'}>{health.status === 'ok' ? 'HEALTHY' : health.status.toUpperCase()}</Badge>
              <span className="text-xs font-tabular text-slate-600 dark:text-slate-300">
                Uptime: <strong>{formatDuration(health.uptime_seconds)}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-tabular text-slate-600 dark:text-slate-300">
              <span>
                Layar Pantau Aktif: <strong>{health.ws_clients}</strong>
              </span>
              <span>
                Basis Data: <strong>{health.db_connected ? 'Terhubung' : 'Terputus'}</strong>
              </span>
              <span>
                Antrean Tunggu: <strong>{health.buffer_pending}</strong>
              </span>
              <span className={health.buffer_dropped > 0 ? 'text-red-600 font-bold' : ''}>
                Antrean Gagal: <strong>{health.buffer_dropped}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Server className="w-4 h-4 text-sky-500" /> Layanan Aplikasi Utama
                </span>
                <Badge variant={health.backend.status === 'UP' ? 'success' : 'danger'}>{health.backend.status}</Badge>
              </div>
              <div className="font-tabular text-slate-500">
                {health.backend.label === 'API v1' ? 'Layanan Utama' : health.backend.label} · {health.backend.environment === 'production' ? 'Produksi' : health.backend.environment} · Waktu Respons: {health.backend.latency_ms} ms
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Database className="w-4 h-4 text-emerald-500" /> Basis Data Produksi
                </span>
                <Badge variant={health.db_connected ? 'success' : 'danger'}>
                  {health.db_connected ? 'CONNECTED' : 'DISCONNECTED'}
                </Badge>
              </div>
              <div className="font-tabular text-slate-500">
                {health.database.engine.toLowerCase().includes('timescale') || health.database.engine.toLowerCase().includes('postgres') ? 'Basis Data Produksi' : health.database.engine} · Waktu Respons: {health.database.latency_ms} ms
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Activity className="w-4 h-4 text-indigo-500" /> Broker Komunikasi Mesin
                </span>
                <Badge variant={health.mqtt.status === 'UP' ? 'success' : 'danger'}>{health.mqtt.status}</Badge>
              </div>
              <div className="font-tabular text-slate-500">
                Perangkat Terhubung: {health.mqtt.connected_clients} · Keamanan Dinamis: {health.mqtt.dynamic_security}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Wifi className="w-4 h-4 text-sky-500" /> Pembaruan Layar Langsung
                </span>
                <Badge variant={health.websocket.status === 'UP' ? 'success' : 'danger'}>
                  {health.websocket.status}
                </Badge>
              </div>
              <div className="font-tabular text-slate-500">
                Saluran Pembaruan Langsung · Pengguna Terhubung: {health.ws_clients}
              </div>
            </div>
          </div>

          {/* Nullable Ingestion Metrics */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Statistik Pemrosesan Data Produksi
            </h2>
            {health.metrics ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-tabular">
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 block">Total Data Diterima</span>
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {health.metrics.totalReceived.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 block">Berhasil Disimpan</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {health.metrics.validIngested.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 block">Data Tidak Valid</span>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {health.metrics.invalidDiscarded}
                  </span>
                </div>
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-400 block">Terakhir Diterima</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {health.metrics.lastIngestedAt
                      ? new Date(health.metrics.lastIngestedAt).toLocaleString()
                      : 'Belum ada'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Statistik pemrosesan data belum tersedia saat ini.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
