/**
 * Filter histori — param URL + validasi + serialisasi (murni, tanpa React).
 *
 * Dipisah dari features/shared/historyFilters.ts pada refactoring E31.16
 * (FAT-279, audit P3-3): satu concern per file. Barrel penggabung:
 * features/shared/historyFilters.ts.
 */
import { HistoryFilters } from '../../../types/historical';
import { HistoryFiltersSchema } from '../../../services/api/schemas';
import {
  DEFAULT_HISTORY_PAGE_LIMIT,
  formatIsoWithOffset,
  resolveTimeWindowPreset,
} from '../../../utils/historicalExport';

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
