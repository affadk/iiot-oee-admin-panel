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
  // E23 Batch 4 (FAT-205, N-36): spec live mewajibkan keduanya.
  catalogueVersion: z.string(),
  enforcedDomains: z.array(z.string()),
});

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
    // E23 Batch 4 (FAT-204, N-35): spec live — `targetPerHour` opsional +
    // nullable, `break` opsional (absen → null, bukan fabrikasi).
    targetPerHour: z.number().nullable().optional(),
    shift_plan: z.object({
      shift_start: z.string(),
      shift_end: z.string(),
      planned_break_min: z.number(),
      planned_operating_sec: z.number(),
    }),
    break: z
      .object({
        start: z.string(),
        end: z.string(),
        minutes: z.number(),
      })
      .nullable()
      .optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'ABORTED']),
  }),
});

/**
 * Role adalah string bebas (API doc §H/§3.4, E20 P20.3) — bukan enum.
 * Nilai dikenal: ADMIN, SUPERVISOR, OPERATOR, MAINTENANCE; default UNASSIGNED.
 */
export const UserRoleSchema = z.string();

export const AuthMeCapabilityDecisionSchema = z.enum(['allow', 'deny', 'unknown']);

export const AuthMeCapabilityEntrySchema = z.object({
  key: z.string(),
  domain: z.string().optional(),
  surface: z.string().optional(),
  decision: AuthMeCapabilityDecisionSchema,
  mode: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Bentuk NORMALISASI GET /auth/me (dihasilkan mapAuthMe — toleran terhadap
 * tiga bentuk dokumen: flat §L, nested §3.4, ringkas §6B; D-2). Capability
 * boleh berbentuk record ATAU array (array memakai `decision`, bukan `state`).
 * `primaryRole` tanpa default 'OPERATOR' — absen = undefined (UNASSIGNED).
 */
export const AuthMeResponseSchema = z
  .object({
    operator: z.object({
      operator_id: z.string(),
      name: z.string(),
      role: UserRoleSchema,
      line_id: z.string().optional(),
      isActive: z.boolean().optional(),
      isProtected: z.boolean().optional(),
      mustChangePassword: z.boolean().optional(),
    }),
    primaryRole: UserRoleSchema.optional(),
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
      z.array(AuthMeCapabilityEntrySchema),
    ]),
    capabilityDetails: z.record(z.string(), AuthMeCapabilityEntrySchema).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    access: z
      .object({
        mode: z.string().optional(),
        channel: z.string().optional(),
        mutations_allowed: z.boolean().optional(),
      })
      .optional(),
  })
  .transform((parsed) => {
    const decisionOf = (item: { decision?: 'allow' | 'deny' | 'unknown'; state?: 'allow' | 'deny' | 'unknown' }) =>
      item.decision ?? item.state ?? 'unknown';
    const normalizedCapabilities: Record<string, 'allow' | 'deny' | 'unknown'> = Array.isArray(parsed.capabilities)
      ? Object.fromEntries(parsed.capabilities.map((item) => [item.key, decisionOf(item)]))
      : parsed.capabilities;
    const capabilityDetails: Record<string, z.infer<typeof AuthMeCapabilityEntrySchema>> | undefined = Array.isArray(
      parsed.capabilities
    )
      ? Object.fromEntries(
          parsed.capabilities.map((item) => [
            item.key,
            {
              key: item.key,
              domain: (item as { domain?: string }).domain,
              surface: (item as { surface?: string }).surface,
              decision: decisionOf(item),
              mode: (item as { mode?: string }).mode,
              reason: (item as { reason?: string }).reason,
            },
          ])
        )
      : parsed.capabilityDetails;

    return {
      ...parsed,
      capabilities: normalizedCapabilities,
      capabilityDetails,
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
    // Spec 043 (§L): flag gerbang ganti-password-wajib.
    must_change_password: z.boolean().optional(),
  }),
});

export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().min(1),
  expires_in: NumericCoercionSchema,
  // Spec 043 (§L): authzVersion hasil baca ulang identitas dari database.
  authzVersion: NumericCoercionSchema.optional(),
});

/** Baris policy kanonis (§3.4, spec 042) — camelCase, TANPA `reason`. */
export const IamPolicyRuleSchema = z.object({
  id: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  subjectMatch: z.string(),
  permissionId: z.string().optional(),
  action: z.string(),
  resourceType: z.string(),
  resourcePattern: z.string(),
  effect: z.enum(['ALLOW', 'DENY']),
  // E28 Batch A (FAT-229 MUT-03): `abacCondition` HANYA record — BUKAN
  // nullable. Spec 20 Nov: POST /policies = optional record; server menolak
  // null (400). Baris tanpa ABAC = field ABSEN (undefined), bukan null.
  // Pengecualian yang disengaja: PUT /policies BOLEH nullable (null =
  // hapus kondisi) — itu jalur tulis HTTP, bukan skema baris ini. Pembaca
  // (mapIamPolicy) tetap toleran terhadap null dari server lama.
  abacCondition: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean(),
  createdAt: z.string(),
});

export const ScopeLevelSchema = z.enum(['ORGANIZATION', 'SITE', 'AREA', 'LINE', 'MACHINE', 'DEVICE']);

export const IamRoleSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(64),
  is_system: z.boolean(),
  description: z.string(),
  created_at: z.string(),
});

export const IamPermissionSchema = z.object({
  id: z.string(),
  action: z.string().min(1).max(64),
  resourceType: z.string().min(1).max(64),
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
  modbus_slave_id: z.number().int().min(1).max(247).optional(),
});

export const DeviceEnrollmentStateSchema = z.enum(['PROVISIONED', 'ACTIVE', 'REVOKED']);

export const EdgeDeviceSchema = z.object({
  device_id: z.string().regex(/^STM32-[A-Za-z0-9_-]+$/),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  // §E: MAC boleh kosong saat provisioning ("" sampai teramati via /hello).
  mac_address: z.union([z.literal(''), z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/)]),
  ip_address: z.string().nullable(),
  firmware_version: z.string().nullable(),
  online: z.boolean(),
  last_seen: z.string().nullable(),
  bound_machine_id: z.string().nullable(),
  bound_machine_name: z.string().nullable().optional(),
  boundMachine: BoundMachineSummarySchema.nullable().optional(),
  enrollmentState: DeviceEnrollmentStateSchema.optional(),
  provisionedAt: z.string().nullable().optional(),
  credentialRotatedAt: z.string().nullable().optional(),
  created_at: z.string(),
});

/**
 * E27 Spec 043 (FAT-232, T1): ID stasiun/kiosk — konvensi panel yang sama
 * dengan HistoryFiltersSchema (dto.ts:422): trim, 1..64 karakter. Batas ini
 * konvensi panel, BUKAN batas server; TIDAK ada regex ^STM32-... di sini
 * (EdgeDeviceSchema di atas menolak ID stasiun seperti ADMIN-CONSOLE-01).
 */
export const StationIdSchema = z.string().trim().min(1).max(64);

/**
 * E27 Spec 043 (FAT-232, T1): skema respons stasiun — bentuk DeviceResponse
 * yang sama dengan edge device, tapi device_id memakai StationIdSchema
 * (tanpa regex STM32) dan tanpa ikatan mesin. Dipakai mapStation().
 */
export const StationSchema = z.object({
  device_id: StationIdSchema,
  model: z.string().optional(),
  mac_address: z.string(),
  ip_address: z.string().nullable(),
  firmware_version: z.string().nullable(),
  online: z.boolean(),
  last_seen: z.string().nullable(),
  enrollmentState: DeviceEnrollmentStateSchema.optional(),
  provisionedAt: z.string().nullable().optional(),
  credentialRotatedAt: z.string().nullable().optional(),
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
  // E23 Batch 2 (FAT-185, N-16): spec live `startTime`/`endTime` hanya
  // string TANPA format — server boleh mengirim `07:00:00`. Skema TIDAK
  // lagi menuntut HH:MM ketat (dulu regex di sini membuat SELURUH list
  // melempar INVALID_RESPONSE bila satu item berformat `HH:MM:SS`);
  // normalisasi ke HH:MM dilakukan mapper (`normalizeShiftTime`,
  // mappers/assets.ts). Nilai yang tak bisa diparse diteruskan apa adanya
  // (tampil mentah, bukan gagal total).
  startTime: z.string(),
  endTime: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const ShiftScheduleSchema = z.object({
  scheduleId: z.string().min(1),
  lineId: z.string().min(1),
  shiftId: z.string().min(1),
  // E23 Batch 2 (FAT-186, N-17): spec live `dayOfWeek` hanya number TANPA
  // rentang/konvensi — server boleh memakai 0..6 (0=Minggu). Terima 0..7;
  // mapper menormalisasi 0 → 7 agar konsisten dengan konvensi panel
  // 1=Senin..7=Minggu (label hari di ShiftSchedulesPage).
  dayOfWeek: z.number().int().min(0).max(7),
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
