/**
 * Method demo — domain monitoring: system audit: daftar + ekspor.
 *
 * Dipisah dari demo/monitoring.ts (445 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya
 * (../monitoring.ts).
 */
import { store } from '../store';
import { checkAbort, assertCapability } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { AuditLogItem } from '../../../../types/system';
import { CursorPageResponse, SystemAuditExportQuery, ExportResult } from '../../../../types/historical';
import { RETENTION_POLICY_DAYS, assertRetentionWindow, buildSystemAuditExportEndpoint, formatSystemAuditExportRows, paginateWithCursor, parseExportMetadataHeaders, serializeExportRecords } from '../../../../utils/historicalExport';

export const demoMonitoringAudit = {
  async getSystemAuditPage(
    query: { from?: string; to?: string; event_type?: string; machine_id?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<AuditLogItem>> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.from) qs.set('from', query.from);
    if (query.to) qs.set('to', query.to);
    if (query.event_type) qs.set('event_type', query.event_type);
    if (query.machine_id) qs.set('machine_id', query.machine_id);
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('SYSTEM_AUDIT', `${ADMIN_ENDPOINTS.SYSTEM_AUDIT.buildPath()}?${qs.toString()}`);

    let items = [...store.auditLogs];
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((a) => new Date(a.recorded_at).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((a) => new Date(a.recorded_at).getTime() <= toMs);
    }
    if (query.event_type && query.event_type !== 'ALL') {
      items = items.filter((a) => a.event_type === query.event_type);
    }
    if (query.machine_id && query.machine_id !== 'ALL') {
      items = items.filter((a) => a.machine_id === query.machine_id);
    }
    return paginateWithCursor(items, (a) => a.recorded_at, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 200,
    });
  },

  async getAuditLogs(signal?: AbortSignal): Promise<AuditLogItem[]> {
    const page = await demoMonitoringAudit.getSystemAuditPage({ limit: 200 }, signal);
    return page.data;
  },

  /**
   * E20 P20.4 (FAT-156, O9): GET /system/audit/export (API doc §I) —
   * csv/ndjson/json (default csv), limit 1..100000 default 10000, retensi
   * 90 hari → 400 RETENTION_EXCEEDED, rate limit 5/min, guard
   * `access_control.read` (D-13). Filter sama dengan daftar.
   */
  async exportSystemAuditData(
    query: SystemAuditExportQuery,
    signal?: AbortSignal
  ): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildSystemAuditExportEndpoint(query);
    assertCapability('access_control.read', ['ADMIN']);
    store.assertExportRateLimit('SYSTEM_AUDIT_EXPORT');
    store.recordEndpoint('SYSTEM_AUDIT_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);

    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = store.auditLogs
      .filter((a) => {
        if (query.event_type && query.event_type !== 'ALL' && a.event_type !== query.event_type) return false;
        if (query.machine_id && query.machine_id !== 'ALL' && a.machine_id !== query.machine_id) return false;
        const ts = new Date(a.recorded_at).getTime();
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

    const rows = formatSystemAuditExportRows(filtered);
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'system_audit',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `system_audit_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  }
};
