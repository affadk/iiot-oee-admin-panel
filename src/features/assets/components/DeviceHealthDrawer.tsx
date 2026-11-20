import React, { useEffect, useState } from 'react';
import { X, Cpu, HardDrive, CheckCircle2, AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import { apiClient } from '../../../services/api/client';
import { telemetrySocket } from '../../../services/ws/telemetrySocket';
import { mapWsHealthEventToDeviceHealth } from '../../../services/api/http/mappers/assets';
import { DeviceHealth, EdgeDevice } from '../../../types/assets';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatDateTime } from '../../../utils/formatDate';

interface DeviceHealthDrawerProps {
  device: EdgeDevice | null;
  onClose: () => void;
}

export const DeviceHealthDrawer: React.FC<DeviceHealthDrawerProps> = ({ device, onClose }) => {
  const [health, setHealth] = useState<DeviceHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // FAT-261: dari mana health terakhir berasal — 'http' (snapshot awal /
  // Refresh manual) atau 'ws' (HEALTH_UPDATE live tiap ~5 dtk).
  const [source, setSource] = useState<'http' | 'ws'>('http');

  const fetchHealth = async (deviceId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.getDeviceHealth(deviceId);
      setHealth(res);
      setSource('http');
    } catch {
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (device) {
      setSource('http');
      fetchHealth(device.device_id);
    } else {
      setHealth(null);
    }
  }, [device]);

  // FAT-261: selagi drawer terbuka, HEALTH_UPDATE untuk device ini
  // memperbarui health secara live — HTTP tetap jadi snapshot awal dan
  // Refresh manual. Frame device lain diabaikan.
  useEffect(() => {
    if (!device) return;
    const deviceId = device.device_id;
    const unsub = telemetrySocket.subscribe((event) => {
      if (event.type === 'HEALTH_UPDATE' && event.device_id === deviceId) {
        setHealth(mapWsHealthEventToDeviceHealth(event));
        setSource('ws');
      }
    });
    return () => unsub();
  }, [device]);

  if (!device) return null;

  const isCacheMissOrOffline = !health || health.ageSec >= 999999;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Health Diagnostics ${device.device_id}`}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-tabular">
                  {device.device_id}
                </h2>
                {source === 'ws' && health && <Badge variant="success">Live WS</Badge>}
              </div>
              <p className="text-[11px] text-slate-500">
                Diagnostik Kesehatan Perangkat Lapangan
                {source === 'ws' && health && ' — diperbarui otomatis tiap ~5 detik'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel diagnostik"
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          <div className="flex items-center justify-between p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-slate-400 text-[11px]">Status Konektivitas</div>
              <div className="mt-1">
                <Badge variant={device.online ? 'success' : 'danger'}>
                  {device.online ? 'MQTT CONNECTED' : 'OFFLINE (LWT)'}
                </Badge>
              </div>
            </div>
            <div className="text-right font-tabular">
              <div className="text-slate-400 text-[11px]">Last Seen</div>
              <div className="font-medium text-slate-800 dark:text-slate-200 mt-1">
                {device.last_seen ? formatDateTime(device.last_seen) : 'Belum pernah terlihat'}
              </div>
            </div>
          </div>

          {isCacheMissOrOffline ? (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Data Kesehatan Perangkat Belum Tersedia / Offline</span>
              </div>
              <p className="leading-relaxed">
                Laporan kesehatan terbaru dari perangkat {device.device_id} belum diterima. Pastikan perangkat dalam kondisi menyala dan terhubung ke jaringan pabrik.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" /> Sisa Memori Perangkat
                  </div>
                  <div className="text-lg font-bold font-tabular text-slate-900 dark:text-slate-100 mt-1">
                    {(health.heapFree / 1024).toFixed(1)} KB
                  </div>
                  <div className="text-[11px] text-slate-400 font-tabular">{health.heapFree} bytes</div>
                </div>

                <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Proses Sistem Aktif
                  </div>
                  <div
                    className={`text-lg font-bold font-tabular mt-1 ${
                      health.staleCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {health.tasksHealthy} / {health.tasksTotal}
                  </div>
                  <div className="text-[11px] text-slate-400 font-tabular">
                    Pembaruan {health.ageSec} detik lalu
                  </div>
                </div>
              </div>

              {health.staleCount > 0 && (
                <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>{health.staleCount} Proses Tidak Merespons</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                    {health.staleTasks.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-800"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200">Indikator Kondisi Perangkat</div>
                <div className="flex flex-wrap gap-1.5">
                  {health.eventFlags.length === 0 ? (
                    <span className="text-slate-400">Tidak ada flag dilaporkan.</span>
                  ) : (
                    health.eventFlags.map((flag) => (
                      <Badge
                        key={flag}
                        variant={flag.includes('TIMEOUT') || flag.includes('LOW') ? 'warning' : 'success'}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {flag}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchHealth(device.device_id)}
            isLoading={isLoading}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Snapshot</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </aside>
    </div>
  );
};
