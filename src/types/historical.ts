import { DowntimeCategory } from './monitoring';

export type ExportFormat = 'csv' | 'ndjson' | 'json';

export type TimeWindowPreset = '24h' | '7d' | '30d' | '90d' | 'custom';

export interface ExportMetadata {
  source: string;
  generatedAt: string;
  deviceId: string;
  timeWindow: string;
  contentDisposition?: string;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  format: ExportFormat;
  content: string;
  rowCount: number;
  metadata: ExportMetadata;
  endpoint: string;
}

export interface CursorPaginationMeta {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
  truncated?: boolean;
  total_count?: number;
}

export interface CursorPageResponse<T> {
  data: T[];
  pagination: CursorPaginationMeta;
}

export interface HistoricalTimeFilter {
  from?: string;
  to?: string;
  cursor?: string | null;
  limit?: number;
  envelope?: boolean;
}

export interface HistoryFilters {
  machineId?: string;
  deviceId?: string;
  woId?: string;
  status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';
  eventType?: string;
  category?: string;
  activeOnly?: boolean;
  unlabeledOnly?: boolean;
  isBuffered?: boolean;
  groupBy?: 'machine' | 'day' | 'month';
  bucket?: '1m' | '5m' | '15m' | '1h' | '1d';
  from: string; // ISO8601 dengan offset
  to: string;
  limit: number;
  cursor?: string;
  envelope: true;
}

export interface DowntimeHistoryQuery extends HistoricalTimeFilter {
  device_id: string;
  category?: DowntimeCategory | string;
  unlabeled_only?: boolean;
  active_only?: boolean;
}

export interface DowntimeExportQuery {
  device_id: string;
  from: string;
  to: string;
  category?: DowntimeCategory | string;
  unlabeled_only?: boolean;
  active_only?: boolean;
  format: ExportFormat;
  limit?: number;
}

export interface OperationalEventsQuery extends HistoricalTimeFilter {
  device_id?: string; // undefined or 'ALL' => global /api/v1/operational-events
  machine_id?: string;
  event_type?: string;
  severity?: string;
  acknowledged?: boolean;
}

export interface OperationalEventsExportQuery {
  device_id?: string; // undefined or 'ALL' => global /api/v1/operational-events/export
  machine_id?: string;
  from: string;
  to: string;
  event_type?: string;
  format: ExportFormat;
  limit?: number;
}

export interface TelemetryHistoryQuery extends HistoricalTimeFilter {
  device_id: string;
  is_buffered?: boolean;
}

export interface TelemetryExportQuery {
  device_id: string;
  from: string;
  to: string;
  format: ExportFormat;
  limit?: number;
}

export interface WorkOrdersQuery extends HistoricalTimeFilter {
  wo_id?: string;
  status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';
  machine_id?: string;
  product_id?: string;
  operator_id?: string;
}

export type SixBigLossGroup =
  | 'BREAKDOWNS'
  | 'SETUP_AND_ADJUSTMENTS'
  | 'SMALL_STOPS'
  | 'REDUCED_SPEED'
  | 'PROCESS_DEFECTS'
  | 'STARTUP_AND_PLANNED_LOSSES';

export interface SixBigLossInfo {
  group: SixBigLossGroup;
  label: string;
  oee_pillar: 'AVAILABILITY' | 'PERFORMANCE' | 'QUALITY' | 'PLANNED_EXCLUSION';
}

export type HistoricalApiErrorCode =
  | 'RETENTION_EXCEEDED'
  | 'INVALID_TIME_RANGE'
  | 'FORBIDDEN'
  | 'TOO_MANY_REQUESTS';

export class ReconciliationError extends Error {
  public readonly code: HistoricalApiErrorCode;
  public readonly status: number;
  public readonly retentionDays?: number;

  constructor(
    code: HistoricalApiErrorCode,
    message: string,
    status: number,
    retentionDays?: number
  ) {
    super(message);
    this.name = 'ReconciliationError';
    this.code = code;
    this.status = status;
    this.retentionDays = retentionDays;
  }
}

export type DowntimeSixBigLossMap = Record<DowntimeCategory, SixBigLossInfo>;
