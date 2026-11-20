import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HistoryFilters } from '../../types/historical';
import { WorkOrder } from '../../types/production';
import { Machine } from '../../types/assets';
import { DowntimeEvent, OperationalEvent } from '../../types/monitoring';
import { HourlyOeePoint, TelemetryHistoryRecord } from '../../types/analytics';
import { HistoryFiltersSchema } from '../../services/api/schemas';
import {
  DEFAULT_HISTORY_PAGE_LIMIT,
  formatIsoWithOffset,
  resolveTimeWindowPreset,
} from '../../utils/historicalExport';
import { formatDeletedRelationLabel, parseServerMetric } from '../../utils/oeeCalculations';

export interface HistoryFilterValidationResult {
  valid: boolean;
  filters: HistoryFilters;
  errors: Record<string, string>;
}

export function getDefaultHistoryRange(days = 7, now: Date = new Date()): { from: string; to: string } {
  if (days === 1) return resolveTimeWindowPreset('24h', now);
  if (days === 30) return resolveTimeWindowPreset('30d', now);
  if (days === 90) return resolveTimeWindowPreset('90d', now);
  return {
    from: formatIsoWithOffset(new Date(now.getTime() - days * 24 * 60 * 60 * 1000)),
    to: formatIsoWithOffset(now),
  };
}

export function parseBoolParam(raw: string | null): boolean | undefined {
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return undefined;
}

export function validateHistoryFilters(candidate: HistoryFilters): HistoryFilterValidationResult {
  const parsed = HistoryFiltersSchema.safeParse(candidate);
  if (parsed.success) {
    return {
      valid: true,
      filters: parsed.data,
      errors: {},
    };
  }
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : 'filters';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return {
    valid: false,
    filters: candidate,
    errors,
  };
}

export function parseHistoryFiltersFromSearchParams(
  searchParams: URLSearchParams,
  defaults: Partial<HistoryFilters> = {},
  now: Date = new Date()
): HistoryFilterValidationResult {
  const defaultRange = getDefaultHistoryRange(7, now);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const limitRaw = searchParams.get('limit');
  const parsedLimit = limitRaw ? Number(limitRaw) : (defaults.limit ?? DEFAULT_HISTORY_PAGE_LIMIT);

  const statusRaw = searchParams.get('status') ?? defaults.status;
  const status =
    statusRaw === 'PENDING' ||
    statusRaw === 'ACTIVE' ||
    statusRaw === 'COMPLETED' ||
    statusRaw === 'ABORTED'
      ? statusRaw
      : undefined;

  const groupByRaw = searchParams.get('group_by') ?? searchParams.get('groupBy') ?? defaults.groupBy;
  const groupBy =
    groupByRaw === 'machine' || groupByRaw === 'day' || groupByRaw === 'month'
      ? groupByRaw
      : undefined;

  const bucketRaw = searchParams.get('bucket') ?? defaults.bucket;
  const bucket =
    bucketRaw === '1m' ||
    bucketRaw === '5m' ||
    bucketRaw === '15m' ||
    bucketRaw === '1h' ||
    bucketRaw === '1d'
      ? bucketRaw
      : undefined;

  const machineId =
    searchParams.get('machine_id') ?? searchParams.get('machineId') ?? defaults.machineId;
  const deviceId =
    searchParams.get('device_id') ?? searchParams.get('deviceId') ?? defaults.deviceId;
  // E12 T12.1 (X-1 / FAT-54): filter shift dari URL (shift_date/shift_id).
  const shiftDate =
    searchParams.get('shift_date') ?? searchParams.get('shiftDate') ?? defaults.shiftDate;
  const shiftId =
    searchParams.get('shift_id') ?? searchParams.get('shiftId') ?? defaults.shiftId;
  const woId = searchParams.get('wo_id') ?? searchParams.get('woId') ?? defaults.woId;
  const eventType =
    searchParams.get('event_type') ?? searchParams.get('eventType') ?? defaults.eventType;
  const category = searchParams.get('category') ?? defaults.category;

  const activeOnly =
    parseBoolParam(searchParams.get('active_only') ?? searchParams.get('activeOnly')) ??
    defaults.activeOnly;
  const unlabeledOnly =
    parseBoolParam(searchParams.get('unlabeled_only') ?? searchParams.get('unlabeledOnly')) ??
    defaults.unlabeledOnly;
  const isBuffered =
    parseBoolParam(searchParams.get('is_buffered') ?? searchParams.get('isBuffered')) ??
    defaults.isBuffered;

  const cursor = searchParams.get('cursor') || defaults.cursor || undefined;

  const candidate: HistoryFilters = {
    machineId: machineId && machineId !== 'ALL' ? machineId : undefined,
    deviceId: deviceId && deviceId !== 'ALL' ? deviceId : undefined,
    woId: woId || undefined,
    status,
    eventType: eventType && eventType !== 'ALL' ? eventType : undefined,
    category: category && category !== 'ALL' ? category : undefined,
    activeOnly,
    unlabeledOnly,
    isBuffered,
    groupBy,
    bucket,
    shiftDate: shiftDate || undefined,
    shiftId: shiftId || undefined,
    from: fromParam || defaults.from || defaultRange.from,
    to: toParam || defaults.to || defaultRange.to,
    limit: Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_HISTORY_PAGE_LIMIT,
    cursor,
    envelope: true,
  };

  return validateHistoryFilters(candidate);
}

export function serializeHistoryFiltersToSearchParams(
  filters: HistoryFilters,
  existing?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(existing ? existing.toString() : undefined);
  const managedKeys = [
    'machine_id',
    'machineId',
    'device_id',
    'deviceId',
    'wo_id',
    'woId',
    'status',
    'event_type',
    'eventType',
    'category',
    'active_only',
    'activeOnly',
    'unlabeled_only',
    'unlabeledOnly',
    'is_buffered',
    'isBuffered',
    'group_by',
    'groupBy',
    'bucket',
    'shift_date',
    'shiftDate',
    'shift_id',
    'shiftId',
    'from',
    'to',
    'limit',
    'cursor',
    'envelope',
  ];
  managedKeys.forEach((k) => next.delete(k));

  if (filters.machineId) next.set('machine_id', filters.machineId);
  if (filters.deviceId) next.set('device_id', filters.deviceId);
  if (filters.woId) next.set('wo_id', filters.woId);
  if (filters.status) next.set('status', filters.status);
  if (filters.eventType) next.set('event_type', filters.eventType);
  if (filters.category) next.set('category', filters.category);
  if (filters.activeOnly !== undefined) next.set('active_only', String(filters.activeOnly));
  if (filters.unlabeledOnly !== undefined) next.set('unlabeled_only', String(filters.unlabeledOnly));
  if (filters.isBuffered !== undefined) next.set('is_buffered', String(filters.isBuffered));
  if (filters.groupBy) next.set('group_by', filters.groupBy);
  if (filters.bucket) next.set('bucket', filters.bucket);
  if (filters.shiftDate) next.set('shift_date', filters.shiftDate);
  if (filters.shiftId) next.set('shift_id', filters.shiftId);
  if (filters.from) next.set('from', filters.from);
  if (filters.to) next.set('to', filters.to);
  if (filters.limit) next.set('limit', String(filters.limit));
  if (filters.cursor) next.set('cursor', filters.cursor);
  next.set('envelope', 'true');
  return next;
}

/**
 * Pure reducer that applies partial filter updates and automatically resets cursor
 * whenever any non-cursor filter parameter changes.
 *
 * E12 T12.1 (X-1 / FAT-54): from/to adalah turunan pilihan shift bila
 * shiftDate/shiftId terisi — mengganti rentang secara manual (preset ekspor,
 * rentang kustom) tanpa menyebut shift berarti pilihan shift tidak lagi
 * berlaku, jadi keduanya dibersihkan. Patch yang menyebut shift (pemilih
 * shift) tidak dibersihkan.
 */
export function applyHistoryFilterPatch(
  current: HistoryFilters,
  patch: Partial<HistoryFilters>
): HistoryFilters {
  const patchKeys = Object.keys(patch) as (keyof HistoryFilters)[];
  const onlyCursorChanged = patchKeys.length === 1 && patchKeys[0] === 'cursor';
  const rangeChanged = patchKeys.includes('from') || patchKeys.includes('to');
  const shiftMentioned = patchKeys.includes('shiftDate') || patchKeys.includes('shiftId');
  return {
    ...current,
    ...patch,
    envelope: true,
    cursor: onlyCursorChanged ? patch.cursor : undefined,
    ...(rangeChanged && !shiftMentioned
      ? { shiftDate: undefined, shiftId: undefined }
      : {}),
  };
}

export function useHistoryFilters(defaults: Partial<HistoryFilters> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const validation = useMemo(
    () => parseHistoryFiltersFromSearchParams(searchParams, defaults),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams]
  );

  const updateFilters = useCallback(
    (patch: Partial<HistoryFilters>) => {
      const next = applyHistoryFilterPatch(validation.filters, patch);
      const serialized = serializeHistoryFiltersToSearchParams(next, searchParams);
      setSearchParams(serialized, { replace: true });
    },
    [validation.filters, searchParams, setSearchParams]
  );

  const setCursor = useCallback(
    (cursor?: string) => {
      updateFilters({ cursor });
    },
    [updateFilters]
  );

  const resetFilters = useCallback(() => {
    const defaultRange = getDefaultHistoryRange(7);
    const base: HistoryFilters = {
      limit: DEFAULT_HISTORY_PAGE_LIMIT,
      from: defaultRange.from,
      to: defaultRange.to,
      ...defaults,
      cursor: undefined,
      envelope: true,
    };
    const serialized = serializeHistoryFiltersToSearchParams(base);
    setSearchParams(serialized, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSearchParams]);

  return {
    filters: validation.filters,
    isValid: validation.valid,
    validationErrors: validation.errors,
    updateFilters,
    setCursor,
    resetFilters,
  };
}

/**
 * Resolves the production window [from, to] for a Work Order with explicit ISO offsets.
 */
export function resolveWorkOrderWindow(
  wo: WorkOrder,
  now: Date = new Date()
): { from: string; to: string } {
  // E20 P20.5 (FAT-157): nama kanonis `actual_start_at`/`actual_end_at`
  // (§C); `planned_start` null bila tak ada (tanpa fallback ke created_at).
  const rawStart = wo.actual_start_at ?? wo.start_time ?? wo.planned_start;
  const rawEnd = wo.actual_end_at ?? wo.end_time;
  // `rawStart` null (tanpa actual/planned) → fallback jendela 8 jam
  // terakhir; `new Date(null)` = epoch 1970, jadi dicek eksplisit.
  const startDate = rawStart ? new Date(rawStart) : new Date(Number.NaN);
  const endDate = rawEnd ? new Date(rawEnd) : now;

  const validStart = Number.isNaN(startDate.getTime())
    ? new Date(now.getTime() - 8 * 60 * 60 * 1000)
    : startDate;
  const validEnd =
    Number.isNaN(endDate.getTime()) || endDate.getTime() < validStart.getTime()
      ? new Date(validStart.getTime() + 60 * 60 * 1000)
      : endDate;

  return {
    from: formatIsoWithOffset(validStart),
    to: formatIsoWithOffset(validEnd),
  };
}

/**
 * Correlates work_orders.machine_id -> machines.bound_device_id (device_id)
 */
export function resolveWorkOrderDeviceId(wo: WorkOrder, machines: Machine[]): string | null {
  if (!wo.machine_id) return null;
  const machine = machines.find((m) => m.machine_id === wo.machine_id);
  return machine?.bound_device_id ?? machine?.boundDevice?.device_id ?? null;
}

/**
 * E28 Batch B (FAT-224, E2E-10): sub-baris "WO / Batch" — order_number
 * yang SAMA dengan wo_id (duplikat) dan shift_name kosong tidak dirender;
 * pemisah "·" hanya di antara bagian yang ada; bila keduanya kosong,
 * '—' (bukan "·" menggantung atau sel kosong).
 */
export function formatWorkOrderSubline(wo: Pick<WorkOrder, 'wo_id' | 'order_number' | 'shift_name'>): string {
  const parts = [
    wo.order_number && wo.order_number !== wo.wo_id ? wo.order_number : null,
    wo.shift_name || null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export interface CorrelatedWorkOrderSummary {
  woId: string;
  machineLabel: string;
  machineDeleted: boolean;
  productLabel: string;
  productDeleted: boolean;
  operatorLabel: string;
  operatorDeleted: boolean;
  resolvedDeviceId: string | null;
  window: { from: string; to: string };
  telemetrySampleCount: number;
  provisionalHourlyCount: number;
  downtimeCount: number;
  totalDowntimeSec: number;
  operationalEventCount: number;
  avgOeePct: number | null;
  totalGoodParts: number;
  totalRejectParts: number;
}

export function correlateWorkOrderData(params: {
  workOrder: WorkOrder;
  machines: Machine[];
  telemetryRecords: TelemetryHistoryRecord[];
  hourlyPoints?: HourlyOeePoint[];
  downtimeEvents: DowntimeEvent[];
  operationalEvents: OperationalEvent[];
  now?: Date;
}): CorrelatedWorkOrderSummary {
  const {
    workOrder,
    machines,
    telemetryRecords,
    hourlyPoints = [],
    downtimeEvents,
    operationalEvents,
    now = new Date(),
  } = params;

  const machineInfo = formatDeletedRelationLabel(workOrder.machine_name, workOrder.machine_id);
  const productInfo = formatDeletedRelationLabel(workOrder.product_name, workOrder.product_id);
  const operatorInfo = formatDeletedRelationLabel(workOrder.operator_name, workOrder.operator_id);
  const resolvedDeviceId = resolveWorkOrderDeviceId(workOrder, machines);
  const window = resolveWorkOrderWindow(workOrder, now);

  const fromMs = Date.parse(window.from);
  const toMs = Date.parse(window.to);

  const inWindowTelemetry = telemetryRecords.filter((rec) => {
    const ts = Date.parse(rec.timestamp);
    return Number.isFinite(ts) && ts >= fromMs && ts <= toMs;
  });

  const inWindowDowntime = downtimeEvents.filter((ev) => {
    const startMs = Date.parse(ev.started_at);
    return Number.isFinite(startMs) && startMs >= fromMs && startMs <= toMs;
  });

  const inWindowEvents = operationalEvents.filter((ev) => {
    const ts = Date.parse(ev.recorded_at);
    return Number.isFinite(ts) && ts >= fromMs && ts <= toMs;
  });

  const provisionalHourlyCount = hourlyPoints.filter((pt) => pt.provisional).length;
  const totalDowntimeSec = inWindowDowntime.reduce((acc, ev) => acc + (ev.duration_seconds || 0), 0);

  const avgOeePct =
    inWindowTelemetry.length > 0
      ? Number(
          (
            inWindowTelemetry.reduce((acc, rec) => acc + parseServerMetric(rec.oee, 0), 0) /
            inWindowTelemetry.length
          ).toFixed(2)
        )
      : null;

  // E20 P20.5 (FAT-157): `completed_quantity`/`rejected_quantity` DIHAPUS
  // dari kontrak WO (§C) — tanpa telemetri dalam jendela, total = 0
  // (bukan angka karangan dari WO).
  const totalGoodParts =
    inWindowTelemetry.length > 0
      ? inWindowTelemetry.reduce((acc, rec) => acc + (rec.goodCount ?? rec.good_count ?? 0), 0)
      : 0;

  const totalRejectParts =
    inWindowTelemetry.length > 0
      ? inWindowTelemetry.reduce((acc, rec) => acc + (rec.rejectCount ?? rec.reject_count ?? 0), 0)
      : 0;

  return {
    woId: workOrder.wo_id,
    machineLabel: machineInfo.label,
    machineDeleted: machineInfo.isDeleted,
    productLabel: productInfo.label,
    productDeleted: productInfo.isDeleted,
    operatorLabel: operatorInfo.label,
    operatorDeleted: operatorInfo.isDeleted,
    resolvedDeviceId,
    window,
    telemetrySampleCount: inWindowTelemetry.length,
    provisionalHourlyCount,
    downtimeCount: inWindowDowntime.length,
    totalDowntimeSec,
    operationalEventCount: inWindowEvents.length,
    avgOeePct,
    totalGoodParts,
    totalRejectParts,
  };
}

export function formatRollupPerformance(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '— (Kapasitas 0/Unknown)';
  }
  const num = parseServerMetric(value, NaN);
  return Number.isFinite(num) ? `${num.toFixed(2)}%` : '—';
}
