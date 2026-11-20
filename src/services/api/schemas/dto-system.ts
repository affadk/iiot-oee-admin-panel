/**
 * Skema Zod DTO — domain system health (validasi respons backend).
 *
 * Dipisah dari schemas/dto.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file skema = satu domain). Barrel penggabung: schemas/dto.ts.
 */
import { z } from 'zod';

/**
 * Key DTO Zod schemas for strict runtime parsing
 */
export const SystemHealthMetricsSchema = z
  .object({
    totalReceived: z.number(),
    validIngested: z.number(),
    invalidDiscarded: z.number(),
    lastIngestedAt: z.string().nullable(),
  })
  .nullable();

export const SystemHealthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  uptime: z.number().nonnegative(),
  timestamp: z.string(),
  ws_clients: z.number().int().nonnegative(),
  db_connected: z.boolean(),
  buffer_pending: z.number().int().nonnegative(),
  metrics: SystemHealthMetricsSchema,
});
