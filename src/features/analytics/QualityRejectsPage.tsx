import React, { useEffect, useState, useCallback } from 'react';
import { BarChart2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { RejectParetoItem } from '../../types/analytics';
import { displayRejectReason } from './rejectReasonLabel';
import { EdgeDevice } from '../../types/assets';
import { Button } from '../../components/ui/Button';
import { LoadErrorBanner } from '../shared/LoadErrorBanner';

export const QualityRejectsPage: React.FC = () => {
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('ALL');
  const [items, setItems] = useState<RejectParetoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // E28 Batch A (FAT-216 E2E-02): bedakan error vs kosong — error JANGAN
  // disamarkan sebagai empty state.
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getDevices()
      .then((list) => setDevices(list))
      .catch(() => {});
  }, []);

  const loadPareto = useCallback(async () => {
    setIsLoading(true);
    try {
      const data =
        selectedDeviceId === 'ALL'
          ? await apiClient.getRejectParetoGlobal()
          : await apiClient.getRejectPareto(selectedDeviceId);
      setItems(data);
      setLoadError(null);
    } catch (err: unknown) {
      // E28 Batch A (FAT-216 E2E-02): jangan `setItems([])` — itu menyamarkan
      // error sebagai "tidak ada data reject". Pertahankan items lama dan
      // tampilkan banner error + retry.
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data reject.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    loadPareto();
  }, [loadPareto]);

  const totalRejects = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Quality Reject Pareto Analysis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {selectedDeviceId === 'ALL'
              ? 'Rekapitulasi jumlah reject tanpa klasifikasi alasan dari seluruh pabrik.'
              : `Jumlah reject tanpa klasifikasi alasan untuk perangkat ${selectedDeviceId}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Pilih Perangkat Pareto"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">Global Pareto (Semua Perangkat)</option>
            {devices.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.device_id} {d.bound_machine_name ? `— ${d.bound_machine_name}` : ''}
              </option>
            ))}
          </select>
          <Button size="sm" variant="secondary" onClick={loadPareto} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {loadError && !isLoading && (
        <LoadErrorBanner
          title="Gagal memuat data reject"
          message={loadError}
          onRetry={() => void loadPareto()}
        />
      )}

      {items.length === 0 && !isLoading ? (
        loadError ? (
          <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-center space-y-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Data reject tidak dapat dimuat
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Periksa koneksi lalu coba lagi — ini bukan berarti tidak ada reject.
            </p>
            <div className="pt-1">
              <Button size="sm" variant="secondary" onClick={() => void loadPareto()}>
                Coba lagi
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tidak ada data reject dalam rentang waktu ini
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Perangkat {selectedDeviceId} melaporkan 0 produk cacat (atau belum memiliki rekaman defect).
            </p>
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-red-500" />
              <span>Jumlah Reject — tanpa klasifikasi alasan ({totalRejects} pcs total)</span>
            </h2>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.reason} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{displayRejectReason(item.reason)}</span>
                  <span className="font-tabular text-slate-600 dark:text-slate-300">
                    <strong>{item.count} pcs</strong> ({item.percentage}% · Cum. {item.cumulative_percentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded transition-all"
                    style={{ width: `${Math.max(2, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
