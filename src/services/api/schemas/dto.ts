/**
 * Skema Zod DTO per domain (validasi respons backend).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { NumericCoercionSchema } from './transport';
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

export const IamInfoSchema = z.object({
  mode: z.enum(['shadow', 'enforce', 'partial']),
  authzVersion: z.number().int().nonnegative(),
  effectiveInMode: z.string(),
  enforcedDomains: z.array(z.string()).optional(),
});

export const BrokerOverviewSchema = z.object({
  dynamicSecurity: z.object({
    enabled: z.boolean(),
    status: z.enum(['CONNECTED', 'DISCONNECTED']),
    clientsCount: z.number().int().nonnegative(),
    rolesCount: z.number().int().nonnegative(),
    groupsCount: z.number().int().nonnegative(),
  }),
  configuration: z.object({
    status: z.enum(['IN_SYNC', 'DRIFT', 'APPLYING', 'FAILED']),
    activeVersionId: z.string().nullable(),
    lastAppliedAt: z.string().nullable(),
    mutationLocked: z.boolean(),
  }),
});

export const WorkOrderResolveSchema = z.object({
  success: z.boolean(),
  work_order: z.object({
    wo_id: z.string(),
    machine_id: z.string().nullable(),
    product_id: z.string().nullable(),
    product_name: z.string().nullable(),
    std_cycle_time_sec: NumericCoercionSchema,
    operator_id: z.string().nullable(),
    operator_name: z.string().nullable(),
    target_qty: z.number(),
    targetPerHour: z.number(),
    shift_plan: z.object({
      shift_start: z.string(),
      shift_end: z.string(),
      planned_break_min: z.number(),
      planned_operating_sec: z.number(),
    }),
    break: z.object({
      start: z.string(),
      end: z.string(),
      minutes: z.number(),
    }),
    status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'ABORTED']),
  }),
});

export const UserRoleSchema = z.enum(['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE']);

export const AuthMeCapabilityDecisionSchema = z.enum(['allow', 'deny', 'unknown']);

export const AuthMeResponseSchema = z
  .object({
    operator: z.object({
      operator_id: z.string(),
      name: z.string(),
      role: UserRoleSchema,
      line_id: z.string().optional(),
    }),
    primaryRole: UserRoleSchema,
    effectiveRoles: z.array(
      z.object({
        roleName: z.string(),
        scopeType: z.string(),
        scopeId: z.string().nullable(),
      })
    ),
    authzVersion: NumericCoercionSchema,
    catalogueVersion: z.string().optional(),
    mode: z.enum(['shadow', 'enforce', 'partial']),
    capabilities: z.union([
      z.record(z.string(), AuthMeCapabilityDecisionSchema),
      z.array(
        z.object({
          key: z.string(),
          state: AuthMeCapabilityDecisionSchema,
        })
      ),
    ]),
  })
  .transform((parsed) => {
    const normalizedCapabilities: Record<string, 'allow' | 'deny' | 'unknown'> = Array.isArray(parsed.capabilities)
      ? Object.fromEntries(parsed.capabilities.map((item) => [item.key, item.state]))
      : parsed.capabilities;

    return {
      ...parsed,
      capabilities: normalizedCapabilities,
    };
  });

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().min(1),
  expires_in: NumericCoercionSchema,
  operator: z.object({
    id: z.string(),
    username: z.string(),
    role: UserRoleSchema,
    line_id: z.string().optional(),
  }),
});

export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().min(1),
  expires_in: NumericCoercionSchema,
});

export const IamPolicyRuleSchema = z.object({
  id: z.string(),
  role: z.string(),
  subject_match: z.string().optional(),
  role_id: z.string().optional(),
  permission_id: z.string().optional(),
  action: z.string(),
  resource_pattern: z.string(),
  eft: z.enum(['ALLOW', 'DENY']),
  abac_condition: z.union([z.string(), z.record(z.string(), z.unknown()), z.null()]).optional(),
  is_active: z.boolean(),
  reason: z.string().optional(),
});

export const ScopeLevelSchema = z.enum(['ORGANIZATION', 'SITE', 'AREA', 'LINE', 'MACHINE', 'DEVICE']);

export const IamRoleSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(64),
  privilege_level: z.number().int().min(1).max(100),
  is_system: z.boolean(),
  description: z.string(),
  created_at: z.string(),
  policy_count: z.number().int().nonnegative().optional(),
});

export const IamPermissionSchema = z.object({
  id: z.string(),
  action: z.string().min(1).max(64),
  resource_type: z.string().min(1).max(64),
  description: z.string(),
});

export const IamAssignmentSchema = z.object({
  id: z.string(),
  operator_id: z.string().min(1).max(32),
  operator_name: z.string(),
  role_id: z.string(),
  role_name: z.string().min(2).max(64),
  scope_type: ScopeLevelSchema,
  scope_id: z.string().max(64).nullable(),
  created_at: z.string(),
});

export const OperatorSchema = z.object({
  operator_id: z.string().min(3).max(32),
  name: z.string().min(3).max(100),
  role: UserRoleSchema,
  line_id: z.string().max(32),
  is_active: z.boolean(),
  is_protected: z.boolean().optional(),
  created_at: z.string(),
});

export const BoundDeviceSummarySchema = z.object({
  device_id: z.string().min(1),
  mac_address: z.string().min(1),
  ip_address: z.string().nullable(),
  firmware_version: z.string().nullable(),
  online: z.boolean(),
  model: z.string().optional(),
});

export const BoundMachineSummarySchema = z.object({
  machine_id: z.string().min(1),
  name: z.string().min(1),
  modbus_slave_id: z.number().int().min(1).max(247),
});

export const EdgeDeviceSchema = z.object({
  device_id: z.string().regex(/^STM32-[A-Za-z0-9_-]+$/),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  mac_address: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/),
  ip_address: z.string().nullable(),
  firmware_version: z.string().nullable(),
  online: z.boolean(),
  last_seen: z.string().nullable(),
  bound_machine_id: z.string().nullable(),
  bound_machine_name: z.string().nullable().optional(),
  boundMachine: BoundMachineSummarySchema.nullable().optional(),
  created_at: z.string(),
});

export const MachineSchema = z.object({
  machine_id: z.string().regex(/^CNC-[A-Z0-9_-]{3,32}$/),
  name: z.string().min(3).max(100),
  bound_device_id: z.string().nullable(),
  boundDevice: BoundDeviceSummarySchema.nullable().optional(),
  modbus_slave_id: z.number().int().min(1).max(247),
  line_id: z.string().nullable().optional(),
  created_at: z.string(),
});

export const MachineStatusHistoryItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  deviceId: z.string().nullable(),
  machineId: z.string(),
  state: z.enum([
    'UNCONFIGURED',
    'READY',
    'RUNNING',
    'PLANNED_DOWNTIME',
    'UNPLANNED_DOWNTIME',
    'BATCH_FINISHED',
    'OFFLINE',
  ]),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSec: z.number().nonnegative(),
  triggerSource: z.string(),
  isActive: z.boolean(),
});

export const ProductionLineSchema = z.object({
  lineId: z.string().regex(/^[A-Z0-9_-]{1,64}$/),
  lineName: z.string().min(3).max(100),
  description: z.string().max(255).nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const ShiftSchema = z.object({
  shiftId: z.string().regex(/^[A-Z0-9_-]{1,64}$/),
  shiftName: z.string().min(2).max(100),
  shiftCode: z.string().min(1).max(32),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const ShiftScheduleSchema = z.object({
  scheduleId: z.string().min(1),
  lineId: z.string().min(1),
  shiftId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  isActive: z.boolean(),
  shiftName: z.string().optional(),
  shiftCode: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  createdAt: z.string(),
});

export const BindDeviceRequestSchema = z.object({
  device_id: z.string().regex(/^STM32-[A-Za-z0-9_-]+$/),
});

export const DeviceHealthSchema = z.object({
  device_id: z.string().min(1),
  timestamp: z.string().nullable().optional(),
  heapFree: z.number().nonnegative(),
  tasksHealthy: z.number().int().nonnegative(),
  tasksTotal: z.number().int().nonnegative(),
  ageSec: z.number().nonnegative(),
  eventFlags: z.array(z.string()),
  staleCount: z.number().int().nonnegative(),
  staleTasks: z.array(z.string()),
});

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
    groupBy: z.enum(['machine', 'day', 'month']).optional(),
    bucket: z.enum(['1m', '5m', '15m', '1h', '1d']).optional(),
    from: IsoOffsetDateTimeSchema,
    to: IsoOffsetDateTimeSchema,
    limit: z.number().int().min(1).max(2000),
    cursor: z.string().min(1).optional(),
    envelope: z.literal(true),
  })
  .refine((val) => Date.parse(val.from) <= Date.parse(val.to), {
    path: ['from'],
    message: 'Waktu awal (from) harus lebih kecil atau sama dengan waktu akhir (to).',
  });

export const TelemetryRollupItemSchema = z.object({
  groupBy: z.enum(['machine', 'day', 'month']),
  bucket: z.string().nullable(),
  machineId: z.string().nullable(),
  machine_id: z.string().nullable().optional(),
  machine_name: z.string().nullable().optional(),
  device_id: z.string().nullable().optional(),
  totalCount: NumericCoercionSchema,
  goodCount: NumericCoercionSchema,
  rejectCount: NumericCoercionSchema,
  operatingSec: NumericCoercionSchema,
  runSec: NumericCoercionSchema,
  availabilityPct: z.union([z.string(), z.number()]),
  performancePct: z.union([z.string(), z.number(), z.null()]),
  qualityPct: z.union([z.string(), z.number()]),
  oeePct: z.union([z.string(), z.number()]),
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
  availabilityPct: z.union([z.string(), z.number()]),
  performancePct: z.union([z.string(), z.number(), z.null()]),
  qualityPct: z.union([z.string(), z.number()]),
  oeePct: z.union([z.string(), z.number()]),
  sampleCount: z.number().int().nonnegative(),
  provisional: z.boolean(),
});

export const ReconciliationRefreshSchema = z
  .object({
    from: IsoOffsetDateTimeSchema,
    to: IsoOffsetDateTimeSchema,
  })
  .refine((val) => Date.parse(val.from) <= Date.parse(val.to), {
    path: ['from'],
    message: 'Rentang rekonsiliasi tidak valid: from harus <= to.',
  });
