/**
 * Method demo — domain reconciliation.
 *
 * Dipisah dari demo/telemetry.ts pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu domain.
 * Barrel penggabung ada di file induknya (../telemetry.ts).
 *
 * Job rekonsiliasi CAgg + trigger refresh manual.
 */

import { store } from '../store';
import { checkAbort, assertCapability, throwValidationIssues } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { ReconciliationJob, ReconciliationRefreshRequest } from '../../../../types/analytics';
import { ApiError } from '../../../../types/auth';

export const demoTelemetryReconciliation = {
  async getReconciliationJobs(signal?: AbortSignal): Promise<ReconciliationJob[]> {
    checkAbort(signal);
    store.recordEndpoint('RECONCILIATION_JOBS', ADMIN_ENDPOINTS.RECONCILIATION_JOBS.buildPath());
    return [
      {
        job_id: 'job-cagg-hourly',
        name: 'Ringkasan OEE Shift Per Jam',
        view_name: 'telemetry_hourly_cagg',
        schedule_interval: 'Every 15 minutes',
        last_run: '2026-11-11T08:30:00Z',
        last_status: 'SUCCESS',
        refresh_window_hours: 24,
        records_processed: 1420,
      },
      {
        job_id: 'job-cagg-daily',
        name: 'Ringkasan Produksi Harian Pabrik',
        view_name: 'production_daily_summary',
        schedule_interval: 'Every 1 hour',
        last_run: '2026-11-11T08:00:00Z',
        last_status: 'SUCCESS',
        refresh_window_hours: 168,
        records_processed: 8940,
      },
    ];
  },

  async triggerReconciliationRefresh(
    request: ReconciliationRefreshRequest = {}
  ): Promise<{ success: boolean; message: string }> {
    assertCapability('telemetry.reconciliation.refresh', ['ADMIN', 'SUPERVISOR']);
    // E20 P20.5 (FAT-157): body kanonis `{from, to}` (§K.6) — bukan
    // `{startWindow, endWindow}`.
    const fromVal = request.from;
    const toVal = request.to;
    if (fromVal && toVal) {
      const fromMs = Date.parse(fromVal);
      const toMs = Date.parse(toVal);
      if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
        throwValidationIssues('Rentang rekonsiliasi from/to tidak valid.', {
          from: 'Pastikan format ISO 8601 valid dan from <= to.',
        });
      }
    }

    const now = Date.now();
    store.reconciliationCallTimestamps = store.reconciliationCallTimestamps.filter((t) => now - t < 60_000);
    if (store.reconciliationCallTimestamps.length >= 10) {
      throw new ApiError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Batas pembaruan tercapai (maksimal 10 kali per menit). Silakan tunggu sebentar sebelum mencoba lagi.',
        httpStatus: 429,
      });
    }
    store.reconciliationCallTimestamps.push(now);

    store.recordEndpoint('RECONCILIATION_REFRESH', ADMIN_ENDPOINTS.RECONCILIATION_REFRESH.buildPath());
    const rangeDesc = `${fromVal ?? '24 jam terakhir'} .. ${toVal ?? 'sekarang'}`;
    store.addAudit(
      'RECONCILIATION_REFRESH',
      'SYSTEM',
      'telemetry_hourly_cagg',
      `Memperbarui ringkasan data per jam (${rangeDesc})`
    );
    return {
      success: true,
      message: `Pembaruan ringkasan data selesai untuk rentang ${rangeDesc}.`,
    };
  }
};
