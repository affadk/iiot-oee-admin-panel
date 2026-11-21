/**
 * Method demo — domain monitoring: downtime: histori, ekspor, klasifikasi alasan.
 *
 * Dipisah dari demo/monitoring.ts (445 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya
 * (../monitoring.ts).
 */
import { store } from '../store';
import { checkAbort, assertCapability, throwValidationIssues } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { DowntimeEvent, DowntimeReasonResult, DowntimeCategory } from '../../../../types/monitoring';
import { ApiError } from '../../../../types/auth';
import { CursorPageResponse, DowntimeExportQuery, DowntimeHistoryQuery, ExportResult } from '../../../../types/historical';
import { RETENTION_POLICY_DAYS, assertRetentionWindow, buildDowntimeExportEndpoint, buildDowntimeHistoryEndpoint, formatDowntimeExportRows, paginateWithCursor, parseExportMetadataHeaders, serializeExportRecords } from '../../../../utils/historicalExport';

export const demoMonitoringDowntime = {
  async getDowntimeHistory(deviceId: string, signal?: AbortSignal): Promise<DowntimeEvent[]> {
    checkAbort(signal);
    if (!deviceId) {
      throwValidationIssues('device_id wajib dipilih untuk histori downtime.', { device_id: 'Wajib dipilih.' });
    }
    store.recordEndpoint('DOWNTIME_BY_DEVICE', ADMIN_ENDPOINTS.DOWNTIME_BY_DEVICE.buildPath(deviceId));
    return store.downtimes.filter((d) => d.device_id === deviceId).map((d) => ({ ...d }));
  },

  async getDowntimeHistoryPage(
    query: DowntimeHistoryQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<DowntimeEvent>> {
    checkAbort(signal);
    if (!query.device_id) {
      throwValidationIssues('device_id wajib dipilih untuk histori downtime.', { device_id: 'Wajib dipilih.' });
    }
    const endpoint = buildDowntimeHistoryEndpoint(query);
    store.recordEndpoint('DOWNTIME_BY_DEVICE', endpoint);

    let items = store.downtimes.filter((d) => d.device_id === query.device_id);
    if (query.category && query.category !== 'ALL') {
      items = items.filter((d) => d.category === query.category);
    }
    if (query.active_only) {
      items = items.filter((d) => d.ended_at === null);
    }
    if (query.unlabeled_only) {
      // E20 P20.5 (FAT-157): `unlabeled_only` = operatorReason IS NULL
      // (§J.2) — BUKAN heuristik string 'unclassified'/'unplanned'.
      // Di demo, `reason` adalah operatorReason.
      items = items.filter((d) => !d.reason);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((d) => new Date(d.started_at).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((d) => new Date(d.started_at).getTime() <= toMs);
    }

    return paginateWithCursor(items, (d) => d.started_at, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
  },

  async exportDowntimeData(query: DowntimeExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildDowntimeExportEndpoint(query);
    assertCapability('telemetry.refresh', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit('DOWNTIME_DEVICE_EXPORT');
    store.recordEndpoint('DOWNTIME_DEVICE_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);

    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = store.downtimes
      .filter((d) => {
        if (d.device_id !== query.device_id) return false;
        if (query.category && query.category !== 'ALL' && d.category !== query.category) return false;
        if (query.unlabeled_only && d.is_labeled) return false;
        if (query.active_only && d.ended_at !== null) return false;
        const ts = new Date(d.started_at).getTime();
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    const rows = formatDowntimeExportRows(filtered);
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'timescaledb:downtime_events',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': query.device_id,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `downtime_${query.device_id}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  },

  async classifyDowntimeReason(
    id: string,
    category: DowntimeCategory,
    reason: string,
    notes?: string
  ): Promise<DowntimeReasonResult> {
    assertCapability('downtime_event.label', ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'], {
      resourceId: id,
    });
    const cleanReason = reason.trim();
    if (cleanReason.length < 3 || cleanReason.length > 255) {
      throwValidationIssues('Alasan downtime wajib 3–255 karakter.', {
        reason: 'Alasan wajib 3–255 karakter.',
      });
    }
    if (notes && notes.length > 500) {
      throwValidationIssues('Catatan tambahan maksimal 500 karakter.', {
        notes: 'Catatan maksimal 500 karakter.',
      });
    }

    store.recordEndpoint('DOWNTIME_REASON', ADMIN_ENDPOINTS.DOWNTIME_REASON.buildPath(id));
    const dt = store.downtimes.find((d) => d.id === id);
    if (!dt) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Insiden downtime tidak ditemukan.', httpStatus: 404 });
    }

    dt.is_overwrite = dt.is_labeled;
    dt.category = category;
    dt.reason = cleanReason;
    dt.notes = notes?.trim() || undefined;
    dt.is_labeled = true;
    dt.acknowledged_by = store.currentUserName;
    store.addAudit('CLASSIFY_DOWNTIME', 'DEVICE', dt.device_id ?? id, `Classified downtime ${id} as ${category}`, {
      device_id: dt.device_id,
      machine_id: dt.machine_id,
      machine_name: dt.machine_name,
    });
    // E20 P20.5 (FAT-157): respons kanonis §J.3 —
    // `{success, eventId, deviceId, operatorReason, isOverwrite, operator}`
    // — BUKAN `DowntimeEvent` penuh.
    // E23 Batch 3 (FAT-194, N-25): `operator` berupa objek {id, username}.
    return {
      success: true,
      eventId: id,
      deviceId: dt.device_id ?? null,
      operatorReason: cleanReason,
      isOverwrite: dt.is_overwrite,
      operator: store.currentUserName
        ? { id: store.currentUserId, username: store.currentUserName }
        : null,
    };
  }
};
