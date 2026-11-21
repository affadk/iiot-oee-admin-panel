import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, Clock, Database, AlertTriangle, ExternalLink } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { ReconciliationRefreshSchema } from '../../services/api/schemas';
import { ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatIsoWithOffset, formatJakartaDateTime } from '../../utils/historicalExport';
import { HISTORY_DATA_STALE_TIME_MS } from '../shared/useHistoricalQueries';
import { EmptyStateBlock } from '../shared/TableStateRow';
import { LoadErrorBanner } from '../shared/LoadErrorBanner';

export const DataReconciliationPage: React.FC = () => {
  const { reportForbidden } = useAuth();
  const queryClient = useQueryClient();
  const canRefresh = useCapability('telemetry.reconciliation.refresh');

  const [isTriggering, setIsTriggering] = useState(false);
  const [startWindow, setStartWindow] = useState('');
  const [endWindow, setEndWindow] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => setCooldownSec((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const jobsQuery = useQuery({
    queryKey: ['reconciliation-jobs'],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    queryFn: ({ signal }) => apiClient.getReconciliationJobs(signal),
  });

  const jobs = jobsQuery.data ?? [];

  const handleManualRefresh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRefresh.canInteract || cooldownSec > 0 || isTriggering) return;

    const payload = {
      // E23 Batch 1 (FAT-177, N-8): body kanonis spec live
      // `{startWindow, endWindow}` (membalikkan keputusan E20 `{from, to}`).
      startWindow: startWindow ? formatIsoWithOffset(new Date(startWindow)) : undefined,
      endWindow: endWindow ? formatIsoWithOffset(new Date(endWindow)) : undefined,
    };

    const parsed = ReconciliationRefreshSchema.safeParse(payload);
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? 'Rentang waktu rekonsiliasi tidak valid.');
      return;
    }

    setIsTriggering(true);
    setResultMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiClient.triggerReconciliationRefresh(parsed.data);
      setResultMsg(res.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reconciliation-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['telemetry-hourly'] }),
        queryClient.invalidateQueries({ queryKey: ['oee-rollup'] }),
        queryClient.invalidateQueries({ queryKey: ['oee-hourly'] }),
      ]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('telemetry.reconciliation.refresh', 'cagg', err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 429) {
        setCooldownSec(60);
      }
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menjalankan pembaruan ulang data produksi.'
      );
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Sinkronisasi &amp; Pembaruan Ulang Data Produksi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pemantauan jadwal rekonsiliasi bucket per jam/harian dan pembaruan ulang manual untuk paket telemetri susulan (buffered).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/telemetry"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <span>Lihat Telemetri &amp; Rollup</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => jobsQuery.refetch()}
            isLoading={jobsQuery.isFetching}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Jobs</span>
          </Button>
        </div>
      </div>

      {/* Manual Refresh Form */}
      <form
        onSubmit={handleManualRefresh}
        className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Pembaruan Ulang Data Manual
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Opsional: pilih rentang waktu awal dan akhir (diformat ISO 8601 + offset) untuk merekonsiliasi bucket provisional.
            </p>
          </div>
          <Button
            type="submit"
            size="sm"
            isLoading={isTriggering}
            disabled={!canRefresh.canInteract || cooldownSec > 0}
            title={!canRefresh.canInteract ? canRefresh.reason : 'Jalankan pembaruan ulang data'}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {cooldownSec > 0 ? `Tunggu ${cooldownSec} detik` : 'Perbarui Data Sekarang'}
            </span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="recon-from" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Waktu Mulai (Opsional)
            </label>
            <input
              id="recon-from"
              type="datetime-local"
              value={startWindow}
              onChange={(e) => setStartWindow(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="recon-to" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Waktu Selesai (Opsional)
            </label>
            <input
              id="recon-to"
              type="datetime-local"
              value={endWindow}
              onChange={(e) => setEndWindow(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </form>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {resultMsg && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{resultMsg}</span>
        </div>
      )}

      {/* Scheduled CAGG Jobs */}
      {/* E28 Batch B (FAT-219, E2E-05): empty state pola bersama
          (EmptyStateBlock — varian non-tabel TableStateRow); gagal muat
          dibedakan dari kosong lewat LoadErrorBanner + retry. */}
      {jobsQuery.isError && jobs.length === 0 && (
        <LoadErrorBanner
          title="Gagal memuat job rekonsiliasi"
          message={
            jobsQuery.error instanceof Error
              ? jobsQuery.error.message
              : 'Terjadi kesalahan saat memuat daftar job.'
          }
          onRetry={() => jobsQuery.refetch()}
        />
      )}
      {jobsQuery.isLoading && jobs.length === 0 && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-center text-xs text-slate-400">
          Memuat job rekonsiliasi…
        </div>
      )}
      {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
          <EmptyStateBlock
            emptyTitle="Belum ada job rekonsiliasi"
            emptyDescription="Tidak ada job sinkronisasi bucket per jam/harian yang terdaftar. Job dibuat oleh backend; jalankan 'Perbarui Data Sekarang' di atas untuk memicu pembaruan ulang manual."
          />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <div
            key={job.job_id}
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {job.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {job.view_name.includes('hourly')
                      ? 'Ringkasan Data Per Jam'
                      : job.view_name.includes('daily')
                      ? 'Ringkasan Data Harian'
                      : 'Ringkasan Data Produksi'}
                  </div>
                </div>
              </div>
              <Badge variant={job.last_status === 'SUCCESS' ? 'success' : 'warning'}>
                {job.last_status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-tabular">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Interval</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {job.schedule_interval}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Window</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {job.refresh_window_hours}h
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Processed</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {job.records_processed}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-tabular">
              <Clock className="w-3.5 h-3.5" />
              {/* E23 Batch 2 (FAT-191, N-22): `lastRunStartedAt` spec boleh
                  null (job belum pernah jalan) → mapper memberi ''; tampil
                  '—', bukan tanggal kosong. */}
              <span>Last Run: {job.last_run ? formatJakartaDateTime(job.last_run) : '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
