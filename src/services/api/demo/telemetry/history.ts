/**
 * Method demo — domain history + export.
 *
 * Dipisah dari demo/telemetry.ts pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu domain.
 * Barrel penggabung ada di file induknya (../telemetry.ts).
 *
 * Riwayat telemetry (mentah + paginasi cursor) dan ekspor
 * raw/hourly. exportTelemetryHourlyData memakai getHourlyTrend
 * dari domain OEE (./oee).
 */

import { store } from '../store';
import { checkAbort, assertCapability, generateTelemetrySeries } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { TelemetryHistoryRecord } from '../../../../types/analytics';
import { CursorPageResponse, ExportResult, TelemetryExportQuery, TelemetryHistoryQuery } from '../../../../types/historical';
import { RETENTION_POLICY_DAYS, assertRetentionWindow, buildTelemetryExportEndpoint, buildTelemetryHistoryEndpoint, buildTelemetryHourlyExportEndpoint, formatTelemetryExportRows, formatTelemetryHourlyExportRows, paginateWithCursor, parseExportMetadataHeaders, serializeExportRecords, TELEMETRY_HOURLY_CSV_COLUMNS, TELEMETRY_RAW_CSV_COLUMNS } from '../../../../utils/historicalExport';
import { demoTelemetryOee } from './oee';

export const demoTelemetryHistory = {
  // E12 T12.8 (F-9 / FAT-61): getTelemetryHistory (non-page, tanpa query)
  // DIHAPUS — hanya dipakai contract test, bukan UI; riwayat telemetry
  // dibaca lewat getTelemetryHistoryPage (from/to/limit/cursor).
  async getTelemetryHistoryPage(
    query: TelemetryHistoryQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryHistoryRecord>> {
    checkAbort(signal);
    const endpoint = buildTelemetryHistoryEndpoint(query);
    store.recordEndpoint('TELEMETRY_HISTORY', endpoint);

    let items = generateTelemetrySeries(query.device_id || 'STM32-OEE-01', 60);
    if (query.is_buffered !== undefined) {
      items = items.filter((r) => Boolean(r.is_buffered) === query.is_buffered);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((r) => new Date(r.timestamp).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((r) => new Date(r.timestamp).getTime() <= toMs);
    }

    return paginateWithCursor(items, (r) => r.timestamp, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 200,
    });
  },

  async exportTelemetryData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildTelemetryExportEndpoint(query);
    assertCapability('telemetry.refresh', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit('TELEMETRY_EXPORT');
    store.recordEndpoint('TELEMETRY_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);

    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = generateTelemetrySeries(query.device_id || 'STM32-OEE-01', 60)
      .filter((r) => {
        const ts = new Date(r.timestamp).getTime();
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const rows = formatTelemetryExportRows(filtered);
    // E12 T12.7 (F-8 / FAT-60): `limit` eksplisit dari klien membatasi
    // jumlah baris yang diekspor (sebelumnya diabaikan — semua baris dalam
    // rentang diekspor). Tanpa limit, perilaku lama dipertahankan.
    const limitedRows = query.limit !== undefined ? rows.slice(0, query.limit) : rows;
    // Kolom CSV = kolom layar (TELEMETRY_RAW_CSV_COLUMNS) — bukan seluruh
    // key objek; format json/ndjson mengabaikan daftar kolom ini.
    const { content, mimeType, extension } = serializeExportRecords(limitedRows, query.format, [
      ...TELEMETRY_RAW_CSV_COLUMNS,
    ]);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'timescaledb:oee_telemetry_logs',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': query.device_id,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `telemetry_${query.device_id}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: limitedRows.length,
      metadata,
      endpoint,
    };
  },

  async exportTelemetryHourlyData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildTelemetryHourlyExportEndpoint(query);
    assertCapability('telemetry.refresh', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit('TELEMETRY_HOURLY_EXPORT');
    store.recordEndpoint('TELEMETRY_HOURLY_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);
    const hourly = await demoTelemetryOee.getHourlyTrend(query.device_id, signal);
    // E12 T12.7 (F-8 / FAT-60): kolom CSV hourly = kolom layar + kolom
    // tambahan berawalan `extra_` (bukan seluruh key objek mentah), dan
    // `limit` eksplisit dari klien membatasi jumlah baris yang diekspor.
    const rows = formatTelemetryHourlyExportRows(hourly);
    const limitedRows = query.limit !== undefined ? rows.slice(0, query.limit) : rows;
    const { content, mimeType, extension } = serializeExportRecords(limitedRows, query.format, [
      ...TELEMETRY_HOURLY_CSV_COLUMNS,
    ]);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'timescaledb:telemetry_hourly_cagg',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': query.device_id,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `telemetry_hourly_${query.device_id}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: limitedRows.length,
      metadata,
      endpoint,
    };
  },
};
