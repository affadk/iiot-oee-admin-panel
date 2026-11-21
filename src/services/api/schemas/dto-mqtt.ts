/**
 * Skema Zod DTO — domain broker MQTT (validasi respons backend).
 *
 * Dipisah dari schemas/dto.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file skema = satu domain). Barrel penggabung: schemas/dto.ts.
 */
import { z } from 'zod';

export const BrokerOverviewSchema = z.object({
  dynamicSecurity: z.object({
    available: z.boolean(),
    enabled: z.boolean(),
    // E23 Batch 3 (FAT-197, N-28): spec live — status enum
    // READY/CONNECTING/DISCONNECTED; varian available=false membawa
    // `reason` (tanpa `status`); count nullable (E20, FR-035-51).
    status: z.enum(['READY', 'CONNECTING', 'DISCONNECTED']).optional(),
    reason: z.string().nullable().optional(),
    clientsCount: z.number().int().nonnegative().nullable(),
    rolesCount: z.number().int().nonnegative().nullable(),
    groupsCount: z.number().int().nonnegative().nullable(),
    lastError: z.string().nullable().optional(),
    measuredAt: z.string().nullable().optional(),
  }),
  configuration: z.object({
    status: z.enum(['IN_SYNC', 'DRIFT', 'APPLYING', 'FAILED', 'UNAVAILABLE']),
    activeVersionId: z.string().nullable(),
    lastAppliedAt: z.string().nullable(),
    mutationLocked: z.boolean(),
    // E23 Batch 3 (FAT-197, N-28): objek lastOperation (bukan string).
    lastOperation: z
      .object({
        operation_id: z.string(),
        version_id: z.string(),
        type: z.enum(['APPLY', 'ROLLBACK', 'DISCARD']).nullable(),
        status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']),
      })
      .nullable(),
    measuredAt: z.string().nullable().optional(),
  }),
});
