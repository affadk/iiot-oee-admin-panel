/**
 * Skema Zod DTO — domain telemetri + histori (validasi respons backend).
 *
 * Dipisah dari schemas/dto.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file skema = satu domain). Barrel penggabung: schemas/dto.ts.
 */
import { NumericCoercionSchema } from './transport';
import { z } from 'zod';

/**
 * ISO 8601 datetime with explicit timezone offset (`Z` or `+HH:MM` / `-HH:MM`),
 * e.g. `2026-11-01T00:00:00+07:00`. Rejects naive datetimes without offset.
 */
export const ISO_OFFSET_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export const IsoOffsetDateTimeSchema = z
  .string()
  .regex(
    ISO_OFFSET_DATETIME_REGEX,
    'Tanggal/waktu harus format ISO 8601 dengan offset zona waktu (contoh: 2026-11-01T00:00:00+07:00).'
  )
  .refine((val) => !Number.isNaN(Date.parse(val)), {
    message: 'Timestamp ISO 8601 tidak valid.',
  });

export const HistoryFiltersSchema = z
  .object({
    machineId: z.string().trim().min(1).max(64).optional(),
    deviceId: z.string().trim().min(1).max(64).optional(),
    woId: z.string().trim().min(1).max(64).optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'ABORTED']).optional(),
    eventType: z.string().trim().min(1).max(64).optional(),
    category: z.string().trim().min(1).max(64).optional(),
    activeOnly: z.boolean().optional(),
    unlabeledOnly: z.boolean().optional(),
    isBuffered: z.boolean().optional(),
    groupBy: z.enum(['machine', 'line', 'day', 'month']).optional(),
    bucket: z.enum(['1m', '5m', '15m', '1h', '1d']).optional(),
    // E12 T12.1 (X-1 / FAT-54): filter shift — keduanya harus terisi
    // bersamaan (lihat refine di bawah).
    shiftDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal shift harus format YYYY-MM-DD.')
      .optional(),
    shiftId: z.string().trim().min(1).max(64).optional(),
    from: IsoOffsetDateTimeSchema,
    to: IsoOffsetDateTimeSchema,
    limit: z.number().int().min(1).max(2000),
    cursor: z.string().min(1).optional(),
    envelope: z.literal(true),
  })
  .refine((val) => Date.parse(val.from) <= Date.parse(val.to), {
    path: ['from'],
    message: 'Waktu awal (from) harus lebih kecil atau sama dengan waktu akhir (to).',
  })
  .refine((val) => (val.shiftDate === undefined) === (val.shiftId === undefined), {
    path: ['shiftDate'],
    message: 'Filter shift butuh tanggal dan shift sekaligus (shift_date + shift_id).',
  });

export const TelemetryRollupItemSchema = z.object({
  // E23 Batch 3 (FAT-195, N-26): spec live groupBy mencakup 'line'.
  groupBy: z.enum(['machine', 'line', 'day', 'month']),
  bucket: z.string().nullable(),
  machineId: z.string().nullable(),
  machine_id: z.string().nullable().optional(),
  machine_name: z.string().nullable().optional(),
  device_id: z.string().nullable().optional(),
  lineId: z.string().nullable().optional(),
  totalCount: NumericCoercionSchema,
  goodCount: NumericCoercionSchema,
  rejectCount: NumericCoercionSchema,
  operatingSec: NumericCoercionSchema,
  runSec: NumericCoercionSchema,
  availabilityPct: z.union([z.string(), z.number(), z.null()]),
  performancePct: z.union([z.string(), z.number(), z.null()]),
  qualityPct: z.union([z.string(), z.number(), z.null()]),
  oeePct: z.union([z.string(), z.number(), z.null()]),
  sampleCount: z.number().int().nonnegative(),
  provisional: z.boolean(),
  groupKey: z.string(),
});

export const TelemetryAggregatePointSchema = z.object({
  bucket: z.string(),
  totalCount: NumericCoercionSchema,
  goodCount: NumericCoercionSchema,
  rejectCount: NumericCoercionSchema,
  operatingSec: NumericCoercionSchema,
  runSec: NumericCoercionSchema,
  availabilityPct: z.union([z.string(), z.number(), z.null()]),
  performancePct: z.union([z.string(), z.number(), z.null()]),
  qualityPct: z.union([z.string(), z.number(), z.null()]),
  oeePct: z.union([z.string(), z.number(), z.null()]),
  sampleCount: z.number().int().nonnegative(),
  provisional: z.boolean(),
  // E23 Batch 1 (FAT-180, N-11): delta spec live (opsional, nullable).
  outputDelta: z.number().nullable().optional(),
  goodDelta: z.number().nullable().optional(),
  rejectDelta: z.number().nullable().optional(),
});

export const ReconciliationRefreshSchema = z
  .object({
    // E23 Batch 1 (FAT-177, N-8): spec live — `{startWindow, endWindow}`
    // (datetime; field opsional, body wajib). Membalikkan keputusan E20
    // (R-11/T9/X29, `{from, to}` mengikuti api_docs §K.6).
    startWindow: IsoOffsetDateTimeSchema.optional(),
    endWindow: IsoOffsetDateTimeSchema.optional(),
  })
  .refine((val) => !val.startWindow || !val.endWindow || Date.parse(val.startWindow) <= Date.parse(val.endWindow), {
    path: ['startWindow'],
    message: 'Rentang rekonsiliasi tidak valid: startWindow harus <= endWindow.',
  });
