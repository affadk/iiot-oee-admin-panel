import {
  INITIAL_MACHINES,
  INITIAL_DEVICES,
  INITIAL_DEVICE_HEALTH_OVERRIDES,
  INITIAL_PRODUCTS,
  INITIAL_OPERATORS,
  INITIAL_WORK_ORDERS,
  INITIAL_LIVE_STATES,
  INITIAL_DOWNTIME_EVENTS,
  INITIAL_OPERATIONAL_EVENTS,
  INITIAL_MQTT_CLIENTS,
  INITIAL_MQTT_ROLES,
  INITIAL_MQTT_GROUPS,
  INITIAL_BROKER_CONFIG,
  INITIAL_CONFIG_VERSIONS,
  INITIAL_BROKER_OPERATIONS,
  INITIAL_BROKER_BACKUPS,
  INITIAL_SYSTEM_HEALTH,
  INITIAL_AUDIT_LOGS,
  INITIAL_IAM_ROLES,
  INITIAL_IAM_PERMISSIONS,
  INITIAL_IAM_ASSIGNMENTS,
  INITIAL_IAM_POLICIES,
  INITIAL_IAM_AUDIT_DECISIONS,
  INITIAL_PRODUCTION_LINES,
  INITIAL_SHIFTS,
  INITIAL_SHIFT_SCHEDULES,
} from './mockData';
import {
  ADMIN_ENDPOINTS,
  AdminEndpointKey,
  FORBIDDEN_ENDPOINT_PATTERNS,
  isValidEndpointPrefix,
} from './endpoints';
import { Machine, EdgeDevice, DeviceHealth, MachineStatusHistoryItem } from '../../types/assets';
import {
  WorkOrder,
  WorkOrderResolveResult,
  WorkOrderCancelResult,
  Product,
  Operator,
  ProductionLine,
  Shift,
  ShiftSchedule,
} from '../../types/production';
import {
  LiveStateRecord,
  DowntimeEvent,
  OperationalEvent,
  DowntimeCategory,
} from '../../types/monitoring';
import {
  ShiftSummary,
  HourlyOeePoint,
  ShiftTimelineSegment,
  RejectParetoItem,
  TelemetryHistoryRecord,
  TelemetryRollupItem,
  TelemetryRollupQuery,
  ReconciliationJob,
  ReconciliationRefreshRequest,
} from '../../types/analytics';
import {
  MqttClient,
  MqttRole,
  MqttAcl,
  MqttGroup,
  BrokerOverviewInfo,
  BrokerConfigSchema,
  BrokerConfigVersion,
  BrokerOperation,
  BrokerBackup,
} from '../../types/mqtt';
import { SystemHealth, AuditLogItem } from '../../types/system';
import {
  IamInfo,
  IamRole,
  IamPermission,
  IamAssignment,
  IamPolicyRule,
  IamAuditDecision,
  IamEffectivePermissions,
  ScopeLevel,
} from '../../types/iam';
import {
  UserRole,
  NetworkAccessMode,
  LoginResponse,
  AuthMeResponse,
  ApiError,
} from '../../types/auth';
import {
  CursorPageResponse,
  DowntimeExportQuery,
  DowntimeHistoryQuery,
  ExportResult,
  OperationalEventsExportQuery,
  OperationalEventsQuery,
  TelemetryExportQuery,
  TelemetryHistoryQuery,
  WorkOrdersQuery,
} from '../../types/historical';
import {
  CAPABILITY_SPECS,
  CapabilityKey,
  CUSTOM_ROLE_MAX_LEVEL,
  VALIDATION_PATTERNS,
  buildAuthMeCapabilities,
  canManageTargetRole,
  evaluateCasbinAbacDecision,
  isReservedPermission,
  isSystemRoleName,
  matchAbacCondition,
  normalizeMacAddress,
  policyMatchesRole,
  policyTargetsAdmin,
  validateDeviceInput,
  validateMachineInput,
  validateOperatorInput,
  validateProductInput,
  validateProductionLineInput,
  validateShiftInput,
  validateShiftScheduleInput,
  doTimeRangesOverlap,
} from '../../utils/capabilities';
import {
  AuthMeResponseSchema,
  BindDeviceRequestSchema,
  DeviceHealthSchema,
  EdgeDeviceSchema,
  IamAssignmentSchema,
  IamPermissionSchema,
  IamPolicyRuleSchema,
  IamRoleSchema,
  LoginResponseSchema,
  MachineSchema,
  OperatorSchema,
  ProductionLineSchema,
  RefreshResponseSchema,
  ShiftSchema,
  ShiftScheduleSchema,
  TelemetryRollupItemSchema,
  normalizeListResponse,
} from './schemas';
import { httpApiClient } from './httpClient';
import { resolveApiMode, resolveAuthTtlFallbackSec, resolveEffectiveAccess } from './mode';
import { telemetrySocket } from '../ws/telemetrySocket';
import {
  RETENTION_POLICY_DAYS,
  assertRetentionWindow,
  buildDowntimeExportEndpoint,
  buildDowntimeHistoryEndpoint,
  buildOperationalEventsEndpoint,
  buildOperationalEventsExportEndpoint,
  buildTelemetryExportEndpoint,
  buildTelemetryHistoryEndpoint,
  buildTelemetryHourlyExportEndpoint,
  buildTelemetryRollupEndpoint,
  buildWorkOrdersEndpoint,
  formatDowntimeExportRows,
  formatOperationalEventExportRows,
  formatTelemetryExportRows,
  paginateWithCursor,
  parseExportMetadataHeaders,
  serializeExportRecords,
} from '../../utils/historicalExport';
import { normalizeFsmState } from '../../utils/oeeCalculations';

interface AuthClientHooks {
  onUnauthorized?: (reason?: string) => void;
  onForbidden?: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
}

class MemoryStore {
  machines = [...INITIAL_MACHINES];
  devices = [...INITIAL_DEVICES];
  deviceHealthOverrides = { ...INITIAL_DEVICE_HEALTH_OVERRIDES };
  products = [...INITIAL_PRODUCTS];
  operators = [...INITIAL_OPERATORS];
  productionLines = [...INITIAL_PRODUCTION_LINES];
  shifts = [...INITIAL_SHIFTS];
  shiftSchedules = [...INITIAL_SHIFT_SCHEDULES];
  workOrders = [...INITIAL_WORK_ORDERS];
  liveStates = [...INITIAL_LIVE_STATES];
  downtimes = [...INITIAL_DOWNTIME_EVENTS];
  operationalEvents = [...INITIAL_OPERATIONAL_EVENTS];
  mqttClients = [...INITIAL_MQTT_CLIENTS];
  mqttRoles = [...INITIAL_MQTT_ROLES];
  mqttGroups = [...INITIAL_MQTT_GROUPS];
  brokerConfig = JSON.parse(JSON.stringify(INITIAL_BROKER_CONFIG)) as BrokerConfigSchema;
  configVersions = [...INITIAL_CONFIG_VERSIONS];
  brokerOperations: BrokerOperation[] = [...INITIAL_BROKER_OPERATIONS];
  brokerBackups: BrokerBackup[] = [...INITIAL_BROKER_BACKUPS];
  systemHealth = { ...INITIAL_SYSTEM_HEALTH };
  auditLogs = [...INITIAL_AUDIT_LOGS];

  iamInfo: IamInfo = {
    mode: 'enforce',
    authzVersion: 7,
    effectiveInMode: 'ABAC + Scope Enforcement Active',
    enforcedDomains: ['work_orders', 'operators', 'assets', 'mqtt', 'access_control', 'audit'],
  };
  iamRoles = [...INITIAL_IAM_ROLES];
  iamPermissions = [...INITIAL_IAM_PERMISSIONS];
  iamAssignments = [...INITIAL_IAM_ASSIGNMENTS];
  iamPolicies = [...INITIAL_IAM_POLICIES];
  iamAuditDecisions = [...INITIAL_IAM_AUDIT_DECISIONS];
  operatorPasswords = new Map<string, string>();

  currentUserId = 'ADM-001';
  currentUserName = 'Alexandria Vance';
  currentUserRole: UserRole = 'ADMIN';
  currentUserLineId = 'ORG-ALL';
  networkAccessMode: NetworkAccessMode = 'LAN';
  authToken: string | null = 'mem_jwt_initial_admin_lan';
  isAuthenticated = true;
  tokenAuthzVersion = 7;

  endpointCalls = new Map<AdminEndpointKey, string[]>();
  reconciliationCallTimestamps: number[] = [];
  exportCallTimestamps = new Map<string, number[]>();
  hooks: AuthClientHooks = {};

  assertExportRateLimit(endpointKey: string) {
    const now = Date.now();
    const recent = (this.exportCallTimestamps.get(endpointKey) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 5) {
      throw new ApiError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Batas ekspor 5 permintaan/menit tercapai. Tunggu hingga hitung mundur selesai.',
        httpStatus: 429,
      });
    }
    recent.push(now);
    this.exportCallTimestamps.set(endpointKey, recent);
  }

  recordEndpoint(key: AdminEndpointKey, resolvedPath: string) {
    const clean = resolvedPath.split('?')[0];
    if (!isValidEndpointPrefix(clean)) {
      throw new ApiError({
        code: 'CONTRACT_VIOLATION',
        message: `Invalid endpoint prefix "${resolvedPath}"`,
        httpStatus: 400,
      });
    }
    for (const forbidden of FORBIDDEN_ENDPOINT_PATTERNS) {
      if (clean.includes(forbidden)) {
        throw new ApiError({
          code: 'CONTRACT_VIOLATION',
          message: `Forbidden HMI or legacy endpoint "${resolvedPath}"`,
          httpStatus: 403,
        });
      }
    }
    const existing = this.endpointCalls.get(key) || [];
    existing.push(resolvedPath);
    this.endpointCalls.set(key, existing);
  }

  addAudit(
    action: string,
    resource_type: AuditLogItem['resource_type'],
    resource_id: string,
    details: string,
    extras?: { device_id?: string | null; machine_id?: string | null; machine_name?: string }
  ) {
    this.auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      device_id: extras?.device_id ?? null,
      machine_id: extras?.machine_id ?? null,
      machine_name: extras?.machine_name ?? 'Plant System',
      operator_id: this.currentUserId,
      operator_name: this.currentUserName,
      event_type: action,
      action,
      resource_type,
      resource_id,
      details,
      client_ip: this.networkAccessMode === 'LAN' ? '192.168.1.105' : '10.200.0.14',
      access_mode: this.networkAccessMode,
    });
  }

  addOperationalEvent(
    event_type: OperationalEvent['event_type'],
    severity: OperationalEvent['severity'],
    message: string,
    extras?: { device_id?: string | null; machine_id?: string | null; machine_name?: string }
  ) {
    this.operationalEvents.unshift({
      id: `op-ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      device_id: extras?.device_id ?? null,
      machine_id: extras?.machine_id ?? null,
      machine_name: extras?.machine_name ?? 'Plant System',
      event_type,
      severity,
      message,
      acknowledged: false,
      timestamp: new Date().toISOString(),
    });
  }

  addAuthzDecision(decision: 'ALLOW' | 'DENY', action: string, resource: string, reason?: string) {
    this.iamAuditDecisions.unshift({
      id: `dec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subject: this.currentUserId,
      decision,
      mode: this.iamInfo.mode === 'shadow' ? 'shadow' : 'enforce',
      action,
      resource,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  private assetTxChain: Promise<void> = Promise.resolve();

  /**
   * Serializes asset/binding mutations and restores snapshots on error so concurrent
   * operations or mid-flight failures can never leave partial state or violate 1:1 binding.
   */
  runAssetTransaction<T>(fn: () => T): Promise<T> {
    const run = this.assetTxChain.then(() => {
      const snapshot = {
        machines: this.machines.map((m) => ({ ...m })),
        devices: this.devices.map((d) => ({ ...d })),
        liveStates: this.liveStates.map((l) => ({ ...l })),
        workOrders: this.workOrders.map((w) => ({ ...w })),
        downtimes: this.downtimes.map((dt) => ({ ...dt })),
        operationalEvents: this.operationalEvents.map((ev) => ({ ...ev })),
        auditLogs: this.auditLogs.map((al) => ({ ...al })),
      };
      try {
        return fn();
      } catch (err) {
        this.machines = snapshot.machines;
        this.devices = snapshot.devices;
        this.liveStates = snapshot.liveStates;
        this.workOrders = snapshot.workOrders;
        this.downtimes = snapshot.downtimes;
        this.operationalEvents = snapshot.operationalEvents;
        this.auditLogs = snapshot.auditLogs;
        throw err;
      }
    });
    this.assetTxChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}


/** 409 SHIFT_SCHEDULE_OVERLAP: satu lini tidak boleh punya 2 shift yang jamnya tumpang tindih di hari yang sama. */
function assertNoScheduleOverlap(lineId: string, shiftId: string, dayOfWeek: number, excludeScheduleId: string | null) {
  const shift = store.shifts.find((s) => s.shiftId === shiftId);
  if (!shift) return;
  for (const other of store.shiftSchedules) {
    if (!other.isActive || other.lineId !== lineId || other.dayOfWeek !== dayOfWeek) continue;
    if (excludeScheduleId && other.scheduleId === excludeScheduleId) continue;
    const otherShift = store.shifts.find((s) => s.shiftId === other.shiftId);
    if (!otherShift) continue;
    if (doTimeRangesOverlap(shift.startTime, shift.endTime, otherShift.startTime, otherShift.endTime)) {
      throw new ApiError({
        code: 'SHIFT_SCHEDULE_OVERLAP',
        message: `Jadwal tumpang tindih: shift ${shift.shiftCode} (${shift.startTime}–${shift.endTime}) bentrok dengan ${otherShift.shiftCode} (${otherShift.startTime}–${otherShift.endTime}) di lini ${lineId} hari ke-${dayOfWeek}.`,
        httpStatus: 409,
      });
    }
  }
}

export const store = new MemoryStore();

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

function assertAuthenticated() {
  if (!store.isAuthenticated || !store.authToken) {
    const err = new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Token Bearer operator tidak ditemukan atau sesi telah berakhir.',
      httpStatus: 401,
    });
    store.hooks.onUnauthorized?.(err.message);
    throw err;
  }
  const activeActor = store.operators.find((o) => o.operator_id === store.currentUserId);
  if (!activeActor || !activeActor.is_active) {
    store.isAuthenticated = false;
    store.authToken = null;
    const err = new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Akun operator dinonaktifkan atau tidak lagi terdaftar. Silakan login ulang.',
      httpStatus: 401,
    });
    store.hooks.onUnauthorized?.(err.message);
    throw err;
  }
  if (store.tokenAuthzVersion < store.iamInfo.authzVersion) {
    store.isAuthenticated = false;
    store.authToken = null;
    const err = new ApiError({
      code: 'AUTHZ_VERSION_STALE',
      message: 'Sesi berakhir karena perubahan hak akses (authz_version kedaluwarsa). Silakan login ulang.',
      httpStatus: 401,
    });
    store.hooks.onUnauthorized?.(err.message);
    throw err;
  }
}

/**
 * Guard tulis (D1 + mode akses Private/Public): mutasi hanya bila akses
 * efektif mengizinkan — LAN selalu boleh; tunnel hanya bila mode `public`.
 * Mode `private` (default) menolak dengan 403 + keputusan DENY tercatat.
 * Gating di sini hanya UX/pertahanan lapis pertama — backend WAJIB menegakkan
 * aturan yang sama di server (lihat docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md).
 */
function assertLanAccess(capability: CapabilityKey, resourceId?: string) {
  const effective = resolveEffectiveAccess(store.networkAccessMode);
  if (!effective.canMutate) {
    const err = new ApiError({
      code: 'FORBIDDEN',
      message: effective.reason,
      httpStatus: 403,
    });
    store.addAuthzDecision('DENY', capability, resourceId ?? 'remote-tunnel', err.message);
    store.hooks.onForbidden?.(capability, resourceId, err.message);
    throw err;
  }
}

const CAPABILITY_CASBIN_MAP: Partial<Record<CapabilityKey, { action: string; resourceType: string }>> = {
  'operational_event.ack': { action: 'ack', resourceType: 'operational_events' },
  'downtime.reason.label': { action: 'classify', resourceType: 'downtime' },
  'export.telemetry': { action: 'refresh', resourceType: 'telemetry' },
  'audit.system.read': { action: 'read', resourceType: 'access_control' },
  'device.manage': { action: 'manage', resourceType: 'assets' },
  'machine.manage': { action: 'manage', resourceType: 'assets' },
  'product.manage': { action: 'manage', resourceType: 'products' },
  'operator.read': { action: 'read', resourceType: 'operators' },
  'operator.create': { action: 'create', resourceType: 'operators' },
  'operator.status.update': { action: 'status', resourceType: 'operators' },
  'operator.password.rotate': { action: 'rotate_password', resourceType: 'operators' },
  'operator.update': { action: 'update', resourceType: 'operators' },
  'operator.delete': { action: 'delete', resourceType: 'operators' },
  'work_order.cancel': { action: 'cancel', resourceType: 'work_orders' },
  'telemetry.reconciliation.refresh': { action: 'refresh', resourceType: 'telemetry' },
  'access_control.manage': { action: 'manage', resourceType: 'access_control' },
  'mqtt.dynsec.read': { action: 'read', resourceType: 'mqtt_admin' },
  'mqtt.dynsec.manage': { action: 'manage', resourceType: 'mqtt_admin' },
  'mqtt.config.read': { action: 'read', resourceType: 'mqtt_configuration' },
  'mqtt.config.read_raw': { action: 'read_raw', resourceType: 'mqtt_configuration' },
  'mqtt.config.manage': { action: 'manage', resourceType: 'mqtt_configuration' },
  'mqtt.overview.read': { action: 'read', resourceType: 'mqtt_admin' },
};

function matchesMappedPolicy(
  policyAction: string,
  policyResourcePattern: string,
  mapped: { action: string; resourceType: string },
  specificResourceKey?: string
): boolean {
  const qualifiedAction = `${mapped.action}:${mapped.resourceType}`;
  const actionOk =
    policyAction === '*' ||
    policyAction
      .split('|')
      .map((s) => s.trim())
      .some((part) => part === mapped.action || part === qualifiedAction);
  if (!actionOk) return false;

  return (
    policyResourcePattern === '*' ||
    policyResourcePattern === `${mapped.resourceType}:*` ||
    policyResourcePattern.endsWith(`:${mapped.resourceType}:*`) ||
    (specificResourceKey ? policyResourcePattern === specificResourceKey : false)
  );
}

function assertCapability(
  capability: CapabilityKey,
  allowedRoles: UserRole[],
  options: { requireLan?: boolean; requireAuth?: boolean; resourceId?: string } = {}
) {
  const { requireLan = true, requireAuth = true, resourceId } = options;
  if (requireAuth) assertAuthenticated();
  if (requireLan) assertLanAccess(capability, resourceId);

  const actorAssignments = store.iamAssignments.filter((a) => a.operator_id === store.currentUserId);
  const orgAssignedRoles = actorAssignments
    .filter((a) => a.scope_type === 'ORGANIZATION')
    .map((a) => a.role_name);
  const effectiveRoleSet = new Set<string>([store.currentUserRole, ...orgAssignedRoles]);
  const baselineAllowed = allowedRoles.some((r) => effectiveRoleSet.has(r));

  let hasDynamicAllow = false;
  const mapped = CAPABILITY_CASBIN_MAP[capability];
  if (mapped) {
    const resourceKey = resourceId ? `${mapped.resourceType}:${resourceId}` : `${mapped.resourceType}:*`;
    const actor = store.operators.find((o) => o.operator_id === store.currentUserId);
    const abacEnv = {
      networkMode: store.networkAccessMode,
      subjectActive: actor?.is_active ?? true,
      actorLineId: store.currentUserLineId,
    };
    const casbinEval = evaluateCasbinAbacDecision({
      primaryRole: store.currentUserRole,
      assignments: actorAssignments,
      policies: store.iamPolicies,
      mode: store.iamInfo.mode,
      action: mapped.action,
      resourceKey,
      baselineAllowed,
      env: abacEnv,
    });

    if (casbinEval.shadowMismatch) {
      store.addAuthzDecision(casbinEval.finalDecision, capability, resourceId ?? capability, casbinEval.reason);
    }

    if (store.iamInfo.mode === 'enforce') {
      let hasSpecificDeny = false;
      for (const p of store.iamPolicies) {
        if (!p.is_active) continue;
        if (!policyMatchesRole(p.role, effectiveRoleSet)) continue;
        if (!matchesMappedPolicy(p.action, p.resource_pattern, mapped, resourceKey)) continue;
        const abac = matchAbacCondition(p.abac_condition, abacEnv);
        if (abac.malformed) {
          hasSpecificDeny = true;
          continue;
        }
        if (!abac.matched) continue;
        if (p.eft === 'DENY') {
          hasSpecificDeny = true;
        } else if (p.eft === 'ALLOW') {
          hasDynamicAllow = true;
        }
      }

      if (hasSpecificDeny) {
        const err = new ApiError({
          code: 'FORBIDDEN',
          message: `Ditolak oleh kebijakan akses "${capability}" pada resource "${resourceId ?? '*'}".`,
          httpStatus: 403,
        });
        store.addAuthzDecision('DENY', capability, resourceId ?? capability, err.message);
        store.hooks.onForbidden?.(capability, resourceId, err.message);
        throw err;
      }
    }
  }

  const effectiveAllowed = baselineAllowed || (store.iamInfo.mode === 'enforce' && hasDynamicAllow);

  if (!effectiveAllowed) {
    const err = new ApiError({
      code: 'FORBIDDEN',
      message: `Peran ${Array.from(effectiveRoleSet).join(', ')} tidak memiliki otorisasi "${capability}".`,
      httpStatus: 403,
    });
    store.addAuthzDecision('DENY', capability, resourceId ?? capability, err.message);
    store.hooks.onForbidden?.(capability, resourceId, err.message);
    throw err;
  }

  if (!baselineAllowed && hasDynamicAllow) {
    store.addAuthzDecision('ALLOW', capability, resourceId ?? capability, 'Diizinkan oleh policy role kustom.');
  }
}

function throwValidationIssues(message: string, fieldErrors: Record<string, string>): never {
  throw new ApiError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
    issues: Object.entries(fieldErrors).map(([field, msg]) => ({
      field,
      path: field,
      message: msg,
    })),
  });
}

function enrichAndValidateDevice(dev: EdgeDevice): EdgeDevice {
  const machine = dev.bound_machine_id
    ? store.machines.find((m) => m.machine_id === dev.bound_machine_id)
    : store.machines.find((m) => m.bound_device_id === dev.device_id);
  return EdgeDeviceSchema.parse({
    ...dev,
    bound_machine_id: machine ? machine.machine_id : dev.bound_machine_id ?? null,
    bound_machine_name: machine ? machine.name : dev.bound_machine_name ?? null,
    boundMachine: machine
      ? {
          machine_id: machine.machine_id,
          name: machine.name,
          modbus_slave_id: machine.modbus_slave_id,
        }
      : null,
  });
}

function enrichAndValidateMachine(machine: Machine): Machine {
  const dev = machine.bound_device_id
    ? store.devices.find((d) => d.device_id === machine.bound_device_id)
    : store.devices.find((d) => d.bound_machine_id === machine.machine_id);
  return MachineSchema.parse({
    ...machine,
    bound_device_id: dev ? dev.device_id : machine.bound_device_id ?? null,
    boundDevice: dev
      ? {
          device_id: dev.device_id,
          mac_address: dev.mac_address,
          ip_address: dev.ip_address,
          firmware_version: dev.firmware_version,
          online: dev.online,
          model: dev.model,
        }
      : null,
  });
}

function generateTelemetrySeries(deviceId: string, count = 60): TelemetryHistoryRecord[] {
  const list: TelemetryHistoryRecord[] = [];
  const baseNow = Date.now();
  const targetDevice = deviceId || 'STM32-OEE-01';
  const isUnknownCapacity = targetDevice === 'STM32-OEE-05';
  for (let i = 0; i < count; i++) {
    let offsetMs: number;
    if (i < 12) {
      offsetMs = (i + 1) * 5 * 60_000;
    } else if (i < 36) {
      // Every ~3 hours for the past 3.5 days so WO correlation windows always contain samples
      offsetMs = (i - 10) * 3 * 3600_000;
    } else {
      offsetMs = (i - 32) * 2.1 * 24 * 3600_000;
    }
    const ts = new Date(baseNow - offsetMs).toISOString();
    const fsm = normalizeFsmState(
      isUnknownCapacity
        ? 'UNCONFIGURED'
        : i % 13 === 5
        ? 'PLANNED_DOWNTIME'
        : i % 9 === 3
        ? 'UNPLANNED_DOWNTIME'
        : 'RUNNING'
    );
    const totalCount = isUnknownCapacity ? 0 : Math.max(20, 350 - i * 2);
    const rejectCount = isUnknownCapacity ? 0 : 8 + (i % 4);
    const goodCount = Math.max(0, totalCount - rejectCount);
    const operatingTimeSec = 3600;
    const downtimeSec = fsm === 'RUNNING' ? (i % 4) * 90 : 1200;
    const runTimeSec = Math.max(0, operatingTimeSec - downtimeSec);
    const lastCycleTimeSec = isUnknownCapacity ? null : Number((42.1 + ((i * 0.35) % 2)).toFixed(1));
    list.push({
      id: `tel-${targetDevice}-${String(i + 1).padStart(3, '0')}`,
      device_id: targetDevice,
      timestamp: ts,
      fsm_state: fsm,
      total_count: totalCount,
      good_count: goodCount,
      reject_count: rejectCount,
      totalCount,
      goodCount,
      rejectCount,
      operatingTimeSec,
      runTimeSec,
      downtimeSec,
      lastCycleTimeSec,
      oee: isUnknownCapacity ? 0 : Number((84.6 - (i % 5) * 1.4).toFixed(1)),
      availability: isUnknownCapacity ? 100 : Number((92.4 - (i % 3) * 1.1).toFixed(1)),
      performance: isUnknownCapacity ? 0 : 94.1,
      quality: isUnknownCapacity ? 100 : 97.4,
      cycle_time_ms: isUnknownCapacity ? 0 : 42100 + ((i * 350) % 2000),
      temperature_c: Number((48.2 + ((i * 0.3) % 4)).toFixed(1)),
      vibration_rms: Number((1.24 + ((i * 0.05) % 0.4)).toFixed(2)),
      is_buffered: i % 11 === 4,
    });
  }
  return list;
}

const REJECT_PARETO_BY_DEVICE: Record<string, RejectParetoItem[]> = {
  'STM32-OEE-01': [
    { reason: 'Dimension Tolerance Exceeded (Outer Diameter)', count: 18, percentage: 46.2, cumulative_percentage: 46.2 },
    { reason: 'Surface Roughness Ra > 0.8um', count: 11, percentage: 28.2, cumulative_percentage: 74.4 },
    { reason: 'Thread Pitch Defect M12', count: 6, percentage: 15.4, cumulative_percentage: 89.8 },
    { reason: 'Burr at Parting Line', count: 3, percentage: 7.7, cumulative_percentage: 97.5 },
    { reason: 'Material Porosity/Inclusion', count: 1, percentage: 2.5, cumulative_percentage: 100.0 },
  ],
  'STM32-OEE-02': [
    { reason: 'Concentricity Runout > 0.03mm', count: 9, percentage: 52.9, cumulative_percentage: 52.9 },
    { reason: 'Tool Wear Chatter Mark', count: 5, percentage: 29.4, cumulative_percentage: 82.3 },
    { reason: 'Chamfer Undercut', count: 3, percentage: 17.7, cumulative_percentage: 100.0 },
  ],
  'STM32-OEE-03': [
    { reason: 'Hydraulic Pressure Short-Shot', count: 14, percentage: 63.6, cumulative_percentage: 63.6 },
    { reason: 'Flange Seat Warping', count: 5, percentage: 22.7, cumulative_percentage: 86.3 },
    { reason: 'Gasket Groove Burr', count: 3, percentage: 13.7, cumulative_percentage: 100.0 },
  ],
  'STM32-OEE-04': [],
  'STM32-OEE-05': [],
};

export const demoApiClient = {
  setAuthHooks(hooks: AuthClientHooks) {
    store.hooks = hooks;
  },

  getCalledEndpointKeys(): AdminEndpointKey[] {
    return Array.from(store.endpointCalls.keys());
  },

  resetEndpointTracker() {
    store.endpointCalls.clear();
  },

  setNetworkMode(mode: NetworkAccessMode) {
    store.networkAccessMode = mode;
  },

  getNetworkMode(): NetworkAccessMode {
    return store.networkAccessMode;
  },

  setUserRole(role: UserRole) {
    store.currentUserRole = role;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    const match = store.operators.find((o) => o.role === role);
    if (match) {
      store.currentUserId = match.operator_id;
      store.currentUserName = match.name;
      store.currentUserLineId = match.line_id;
    }
  },

  getUserRole(): UserRole {
    return store.currentUserRole;
  },

  setTokenAuthzVersion(version: number) {
    store.tokenAuthzVersion = version;
  },

  setIamMode(mode: 'shadow' | 'enforce' | 'partial') {
    store.iamInfo.mode = mode;
  },

  setSessionActive(active: boolean, token?: string | null) {
    store.isAuthenticated = active;
    store.authToken = active ? (token ?? `mem_jwt_${Date.now()}`) : null;
    if (active) {
      store.tokenAuthzVersion = store.iamInfo.authzVersion;
    }
  },

  // =========================================================================
  // AUTHENTICATION (4 ops)
  // =========================================================================
  async login(operator_id: string, password?: string, station_id?: string): Promise<LoginResponse> {
    if (store.networkAccessMode === 'REMOTE_TUNNEL') {
      assertLanAccess('dashboard.read', 'auth/login');
    }
    store.recordEndpoint('AUTH_LOGIN', ADMIN_ENDPOINTS.AUTH_LOGIN.buildPath());
    const op = store.operators.find((o) => o.operator_id === operator_id.trim());
    if (!op || !op.is_active) {
      throw new ApiError({
        code: 'UNAUTHORIZED',
        message: 'ID Operator tidak ditemukan atau akun sedang nonaktif.',
        httpStatus: 401,
      });
    }
    const storedPassword = store.operatorPasswords.get(op.operator_id);
    if (storedPassword !== undefined) {
      if (password !== storedPassword) {
        throw new ApiError({
          code: 'UNAUTHORIZED',
          message: 'ID atau password salah.',
          httpStatus: 401,
        });
      }
    } else if (password !== undefined && password.trim().length < 4) {
      throw new ApiError({
        code: 'UNAUTHORIZED',
        message: 'ID atau password salah.',
        httpStatus: 401,
      });
    }
    store.currentUserId = op.operator_id;
    store.currentUserName = op.name;
    store.currentUserRole = op.role;
    store.currentUserLineId = op.line_id;
    store.isAuthenticated = true;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.authToken = `mem_jwt_${Date.now()}_${op.operator_id}`;
    store.addAuthzDecision('ALLOW', 'auth:login', ADMIN_ENDPOINTS.AUTH_LOGIN.buildPath());
    store.addAudit(
      'AUTH_LOGIN',
      'OPERATOR',
      op.operator_id,
      `Operator authenticated via LAN${station_id ? ` at station ${station_id}` : ''}`
    );
    return LoginResponseSchema.parse({
      success: true,
      token: `mem_jwt_${Date.now()}_${op.operator_id}`,
      expires_in: resolveAuthTtlFallbackSec(),
      operator: {
        id: op.operator_id,
        username: op.name,
        role: op.role,
        line_id: op.line_id,
      },
    });
  },

  async refreshSession(): Promise<{ token: string; expires_in: number; authz_version: number }> {
    assertAuthenticated();
    assertLanAccess('dashboard.read', 'auth/refresh');
    store.recordEndpoint('AUTH_REFRESH', ADMIN_ENDPOINTS.AUTH_REFRESH.buildPath());
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.authToken = `mem_jwt_refresh_${Date.now()}`;
    const parsed = RefreshResponseSchema.parse({
      success: true,
      token: `mem_jwt_refresh_${Date.now()}`,
      expires_in: resolveAuthTtlFallbackSec(),
    });
    return {
      token: parsed.token,
      expires_in: parsed.expires_in,
      authz_version: store.iamInfo.authzVersion,
    };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    assertAuthenticated();
    assertLanAccess('dashboard.read', 'auth/password/change');
    store.recordEndpoint('AUTH_CHANGE_PASSWORD', ADMIN_ENDPOINTS.AUTH_CHANGE_PASSWORD.buildPath());
    if (!currentPassword || currentPassword.trim().length === 0) {
      throwValidationIssues('Password saat ini wajib diisi.', { current_password: 'Wajib diisi.' });
    }
    const existingPassword = store.operatorPasswords.get(store.currentUserId);
    if (existingPassword !== undefined && currentPassword !== existingPassword) {
      throw new ApiError({
        code: 'UNAUTHORIZED',
        message: 'Password saat ini salah.',
        httpStatus: 401,
      });
    }
    if (!newPassword || newPassword.length < 8) {
      throwValidationIssues('Password baru minimal 8 karakter.', {
        new_password: 'Password baru minimal 8 karakter.',
      });
    }
    store.operatorPasswords.set(store.currentUserId, newPassword);
    store.addAudit('PASSWORD_CHANGED', 'OPERATOR', store.currentUserId, 'Operator mengganti password sendiri via LAN');
    return { success: true, message: 'Password berhasil diperbarui.' };
  },

  async getAuthMe(signal?: AbortSignal): Promise<AuthMeResponse> {
    checkAbort(signal);
    assertAuthenticated();
    store.recordEndpoint('AUTH_ME', ADMIN_ENDPOINTS.AUTH_ME.buildPath());

    const roleAssignments = store.iamAssignments.filter((a) => a.operator_id === store.currentUserId);
    const effectiveRoles =
      roleAssignments.length > 0
        ? roleAssignments.map((a) => ({
            roleName: a.role_name,
            scopeType: a.scope_type,
            scopeId: a.scope_id,
          }))
        : [{ roleName: store.currentUserRole, scopeType: 'ORGANIZATION', scopeId: null }];
    const hasNonOrgScope = effectiveRoles.some((r) => r.scopeType !== 'ORGANIZATION');

    const capabilities = buildAuthMeCapabilities(store.currentUserRole, hasNonOrgScope, store.iamInfo.mode);

    // Reflect explicit active DENY and ALLOW policies (including custom roles) when mode === 'enforce'
    if (store.iamInfo.mode === 'enforce') {
      const effectiveRoleNames = new Set([
        store.currentUserRole,
        ...roleAssignments.filter((a) => a.scope_type === 'ORGANIZATION').map((a) => a.role_name),
      ]);
      const abacEnv = {
        networkMode: store.networkAccessMode,
        subjectActive: true,
        actorLineId: store.currentUserLineId,
      };
      (Object.entries(CAPABILITY_CASBIN_MAP) as Array<[CapabilityKey, { action: string; resourceType: string }]>).forEach(
        ([capKey, mapped]) => {
          const matchingPolicies = store.iamPolicies.filter(
            (p) =>
              p.is_active &&
              policyMatchesRole(p.role, effectiveRoleNames) &&
              matchesMappedPolicy(p.action, p.resource_pattern, mapped)
          );
          const matchingDeny = matchingPolicies.find((p) => p.eft === 'DENY');
          if (matchingDeny) {
            capabilities[capKey] = matchingDeny.abac_condition ? 'unknown' : 'deny';
            return;
          }
          if (capabilities[capKey] === 'deny') {
            const matchingAllow = matchingPolicies.find((p) => {
              if (p.eft !== 'ALLOW') return false;
              const abac = matchAbacCondition(p.abac_condition, abacEnv);
              return !abac.malformed && abac.matched;
            });
            if (matchingAllow) {
              const hasAbacOrScope = Boolean(matchingAllow.abac_condition) || CAPABILITY_SPECS[capKey].attributeDependent;
              capabilities[capKey] = hasAbacOrScope ? 'unknown' : 'allow';
            }
          }
        }
      );
    }

    return AuthMeResponseSchema.parse({
      operator: {
        operator_id: store.currentUserId,
        name: store.currentUserName,
        role: store.currentUserRole,
        line_id: store.currentUserLineId,
      },
      primaryRole: store.currentUserRole,
      effectiveRoles,
      authzVersion: store.iamInfo.authzVersion,
      mode: store.iamInfo.mode,
      capabilities,
    });
  },

  // =========================================================================
  // HEALTH & WS (2 ops)
  // =========================================================================
  async getSystemHealth(signal?: AbortSignal): Promise<SystemHealth> {
    checkAbort(signal);
    store.recordEndpoint('HEALTH', ADMIN_ENDPOINTS.HEALTH.buildPath());
    return {
      ...store.systemHealth,
      timestamp: new Date().toISOString(),
    };
  },

  getTelemetryWebSocketUrl(): string {
    const path = ADMIN_ENDPOINTS.WS_TELEMETRY.buildPath();
    store.recordEndpoint('WS_TELEMETRY', path);
    return path;
  },

  // =========================================================================
  // DEVICES (6 ops)
  // =========================================================================
  async getDevices(signal?: AbortSignal): Promise<EdgeDevice[]> {
    checkAbort(signal);
    store.recordEndpoint('DEVICES_LIST', ADMIN_ENDPOINTS.DEVICES_LIST.buildPath());
    return store.devices.map((d) => enrichAndValidateDevice(d));
  },

  async getDeviceById(deviceId: string, signal?: AbortSignal): Promise<EdgeDevice> {
    checkAbort(signal);
    store.recordEndpoint('DEVICES_GET', ADMIN_ENDPOINTS.DEVICES_GET.buildPath(deviceId));
    const dev = store.devices.find((d) => d.device_id === deviceId);
    if (!dev) {
      throw new ApiError({
        code: 'DEVICE_NOT_FOUND',
        message: `Perangkat "${deviceId}" tidak ditemukan.`,
        httpStatus: 404,
      });
    }
    return enrichAndValidateDevice(dev);
  },

  async getDeviceHealth(deviceId: string, signal?: AbortSignal): Promise<DeviceHealth> {
    checkAbort(signal);
    store.recordEndpoint('DEVICES_HEALTH', ADMIN_ENDPOINTS.DEVICES_HEALTH.buildPath(deviceId));
    const dev = store.devices.find((d) => d.device_id === deviceId);
    if (!dev || !dev.online) {
      return DeviceHealthSchema.parse({
        device_id: deviceId,
        timestamp: null,
        heapFree: 0,
        tasksHealthy: 0,
        tasksTotal: 0,
        ageSec: 999999,
        eventFlags: [],
        staleCount: 0,
        staleTasks: [],
      });
    }
    const preset = store.deviceHealthOverrides[deviceId];
    if (preset) {
      return DeviceHealthSchema.parse({
        ...preset,
        timestamp: new Date(Date.now() - preset.ageSec * 1000).toISOString(),
      });
    }
    return DeviceHealthSchema.parse({
      device_id: deviceId,
      timestamp: new Date().toISOString(),
      heapFree: 45120,
      tasksHealthy: 9,
      tasksTotal: 9,
      ageSec: 3,
      eventFlags: ['NTP_SYNCED', 'MQTT_TLS_ACTIVE', 'MODBUS_HEALTHY'],
      staleCount: 0,
      staleTasks: [],
    });
  },

  async registerDevice(data: {
    device_id: string;
    model?: string;
    serial_number?: string;
    mac_address: string;
    ip_address?: string | null;
    firmware_version?: string | null;
  }): Promise<EdgeDevice> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: data.device_id });
    const errors = validateDeviceInput({
      deviceId: data.device_id,
      macAddress: data.mac_address,
      ipAddress: data.ip_address ?? undefined,
      firmwareVersion: data.firmware_version ?? undefined,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi registrasi perangkat gagal.', errors);
    }
    store.recordEndpoint('DEVICES_CREATE', ADMIN_ENDPOINTS.DEVICES_CREATE.buildPath());

    return store.runAssetTransaction(() => {
      const normalizedDeviceId = data.device_id.trim();
      const canonicalMac = normalizeMacAddress(data.mac_address);

      if (store.devices.some((d) => d.device_id === normalizedDeviceId)) {
        throw new ApiError({
          code: 'CONFLICT',
          message: `Device ID "${normalizedDeviceId}" sudah terdaftar.`,
          httpStatus: 409,
        });
      }
      if (store.devices.some((d) => normalizeMacAddress(d.mac_address) === canonicalMac)) {
        throw new ApiError({
          code: 'CONFLICT',
          message: `MAC Address "${data.mac_address}" (${canonicalMac}) sudah digunakan perangkat lain.`,
          httpStatus: 409,
        });
      }

      const newDevice: EdgeDevice = {
        device_id: normalizedDeviceId,
        model: data.model?.trim() || 'STM32H743-Edge-Pro',
        serial_number: data.serial_number?.trim() || normalizedDeviceId,
        mac_address: canonicalMac,
        ip_address: data.ip_address?.trim() || null,
        firmware_version: data.firmware_version?.trim() || null,
        online: false,
        last_seen: null,
        bound_machine_id: null,
        bound_machine_name: null,
        created_at: new Date().toISOString(),
      };
      store.devices.push(newDevice);
      store.addAudit('REGISTER_DEVICE', 'DEVICE', newDevice.device_id, `Registered edge device ${newDevice.device_id}`, {
        device_id: newDevice.device_id,
      });
      return enrichAndValidateDevice(newDevice);
    });
  },

  async updateDevice(
    deviceId: string,
    patch: { ip_address?: string | null; firmware_version?: string | null }
  ): Promise<EdgeDevice> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });

    const rawPatch = patch as Record<string, unknown>;
    const immutableErrors: Record<string, string> = {};
    if (rawPatch.device_id !== undefined) {
      immutableErrors.deviceId = 'device_id bersifat immutable dan tidak dapat diubah setelah registrasi.';
    }
    if (rawPatch.mac_address !== undefined) {
      immutableErrors.macAddress = 'mac_address bersifat immutable dan tidak dapat diubah setelah registrasi.';
    }
    if (Object.keys(immutableErrors).length > 0) {
      throwValidationIssues('Field immutable perangkat tidak boleh diubah.', immutableErrors);
    }

    const errors = validateDeviceInput({
      ipAddress: patch.ip_address ?? undefined,
      firmwareVersion: patch.firmware_version ?? undefined,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan perangkat gagal.', errors);
    }

    store.recordEndpoint('DEVICES_UPDATE', ADMIN_ENDPOINTS.DEVICES_UPDATE.buildPath(deviceId));
    return store.runAssetTransaction(() => {
      const dev = store.devices.find((d) => d.device_id === deviceId);
      if (!dev) {
        throw new ApiError({
          code: 'DEVICE_NOT_FOUND',
          message: `Perangkat "${deviceId}" tidak ditemukan.`,
          httpStatus: 404,
        });
      }
      if (patch.ip_address !== undefined) dev.ip_address = patch.ip_address?.trim() || null;
      if (patch.firmware_version !== undefined) dev.firmware_version = patch.firmware_version?.trim() || null;

      store.addAudit('UPDATE_DEVICE', 'DEVICE', deviceId, `Updated network/firmware for ${deviceId}`, {
        device_id: deviceId,
        machine_id: dev.bound_machine_id,
        machine_name: dev.bound_machine_name ?? 'Unbound',
      });
      return enrichAndValidateDevice(dev);
    });
  },

  async deleteDevice(deviceId: string): Promise<{ success: boolean }> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
    store.recordEndpoint('DEVICES_DELETE', ADMIN_ENDPOINTS.DEVICES_DELETE.buildPath(deviceId));

    const result = await store.runAssetTransaction(() => {
      const dev = store.devices.find((d) => d.device_id === deviceId);
      if (!dev) {
        throw new ApiError({
          code: 'DEVICE_NOT_FOUND',
          message: `Perangkat "${deviceId}" tidak ditemukan.`,
          httpStatus: 404,
        });
      }
      if (dev.bound_machine_id) {
        const activeWo = store.workOrders.find(
          (w) => w.machine_id === dev.bound_machine_id && (w.status === 'ACTIVE' || w.status === 'PENDING')
        );
        if (activeWo) {
          throw new ApiError({
            code: 'MACHINE_HAS_ACTIVE_WO',
            message: `Tidak dapat menghapus perangkat: mesin terikat memiliki Work Order ${activeWo.status} (${activeWo.wo_id}).`,
            httpStatus: 409,
            activeWoId: activeWo.wo_id,
          });
        }
        const machine = store.machines.find((m) => m.machine_id === dev.bound_machine_id);
        if (machine) {
          machine.bound_device_id = null;
          machine.updated_at = new Date().toISOString();
        }
      }

      // History preservation (ON DELETE SET NULL for historical telemetry/downtime/events)
      store.downtimes.forEach((dt) => {
        if (dt.device_id === deviceId) dt.device_id = null;
      });
      store.operationalEvents.forEach((ev) => {
        if (ev.device_id === deviceId) ev.device_id = null;
      });
      // device_live_state is per-device live snapshot (ON DELETE CASCADE)
      store.liveStates = store.liveStates.filter((ls) => ls.device_id !== deviceId);
      store.devices = store.devices.filter((d) => d.device_id !== deviceId);
      store.addAudit('DELETE_DEVICE', 'DEVICE', deviceId, `Deleted edge device ${deviceId} (telemetry history preserved)`);
      return {
        wasBoundMachineId: dev.bound_machine_id,
      };
    });

    telemetrySocket.emitLifecycleEvent('DEVICE_EVENT', {
      action: 'DELETED',
      device_id: deviceId,
      machine_id: result.wasBoundMachineId,
    });
    return { success: true };
  },

  // =========================================================================
  // MACHINES (7 ops)
  // =========================================================================
  async getMachinesPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<Machine>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('MACHINES_LIST', `${ADMIN_ENDPOINTS.MACHINES_LIST.buildPath()}?${qs.toString()}`);
    const page = paginateWithCursor(
      store.machines.map((m) => enrichAndValidateMachine(m)),
      (m) => m.created_at,
      {
        cursor: query.cursor,
        limit: query.limit ?? 50,
        maxLimit: 100,
      }
    );
    return normalizeListResponse(page, MachineSchema, query.limit ?? 50);
  },

  async getMachines(signal?: AbortSignal): Promise<Machine[]> {
    checkAbort(signal);
    store.recordEndpoint('MACHINES_LIST', ADMIN_ENDPOINTS.MACHINES_LIST.buildPath());
    return store.machines.map((m) => enrichAndValidateMachine(m));
  },

  async getMachineById(machineId: string, signal?: AbortSignal): Promise<Machine> {
    checkAbort(signal);
    store.recordEndpoint('MACHINES_GET', ADMIN_ENDPOINTS.MACHINES_GET.buildPath(machineId));
    const machine = store.machines.find((m) => m.machine_id === machineId);
    if (!machine) {
      throw new ApiError({
        code: 'MACHINE_NOT_FOUND',
        message: `Mesin "${machineId}" tidak ditemukan.`,
        httpStatus: 404,
      });
    }
    return enrichAndValidateMachine(machine);
  },


  async getMachineStatusHistory(
    machineId: string,
    query: { from?: string; to?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<MachineStatusHistoryItem>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.from) qs.set('from', query.from);
    if (query.to) qs.set('to', query.to);
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint(
      'MACHINES_STATUS_HISTORY',
      `${ADMIN_ENDPOINTS.MACHINES_STATUS_HISTORY.buildPath(machineId)}?${qs.toString()}`
    );
    const machine = store.machines.find((m) => m.machine_id === machineId);
    if (!machine) {
      throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: `Mesin "${machineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    // Demo: satu segmen status berjalan (state live saat ini).
    const live = store.liveStates.find((l) => l.machine_id === machineId);
    const startedAt = new Date(Date.now() - 3600_000).toISOString();
    const item: MachineStatusHistoryItem = {
      id: `msh-${machineId}-current`,
      deviceId: machine.bound_device_id,
      machineId,
      state: live ? normalizeFsmState(live.fsm_state) : 'RUNNING',
      startedAt,
      endedAt: null,
      durationSec: 3600,
      triggerSource: 'SYSTEM',
      isActive: true,
    };
    return paginateWithCursor([item], (i) => i.startedAt, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
  },

  async createMachine(data: {
    machine_id: string;
    name: string;
    modbus_slave_id?: number;
    bound_device_id?: string | null;
  }): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: data.machine_id });
    const modbusSlaveId = data.modbus_slave_id ?? 1;
    const requestedDeviceId = data.bound_device_id?.trim() || null;

    const errors = validateMachineInput({
      machineId: data.machine_id,
      machineName: data.name,
      modbusSlaveId,
      boundDeviceId: requestedDeviceId,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan mesin gagal.', errors);
    }

    store.recordEndpoint('MACHINES_CREATE', ADMIN_ENDPOINTS.MACHINES_CREATE.buildPath());

    const created = await store.runAssetTransaction(() => {
      const id = data.machine_id.trim();
      if (store.machines.some((m) => m.machine_id === id)) {
        throw new ApiError({
          code: 'MACHINE_ALREADY_EXISTS',
          message: `Machine ID "${id}" sudah terdaftar.`,
          httpStatus: 409,
        });
      }
      if (store.machines.some((m) => m.modbus_slave_id === modbusSlaveId)) {
        throw new ApiError({
          code: 'MODBUS_SLAVE_CONFLICT',
          message: `Modbus Slave ID ${modbusSlaveId} sudah dipakai mesin lain.`,
          httpStatus: 409,
        });
      }
      if (requestedDeviceId) {
        const dev = store.devices.find((d) => d.device_id === requestedDeviceId);
        if (!dev) {
          throw new ApiError({ code: 'DEVICE_NOT_FOUND', message: 'Perangkat tidak ditemukan.', httpStatus: 404 });
        }
        if (dev.bound_machine_id || store.machines.some((m) => m.bound_device_id === requestedDeviceId)) {
          throw new ApiError({
            code: 'DEVICE_ALREADY_BOUND',
            message: `Perangkat ${dev.device_id} sudah terikat ke mesin ${dev.bound_machine_id}.`,
            httpStatus: 409,
          });
        }
        dev.bound_machine_id = id;
        dev.bound_machine_name = data.name.trim();
        const live = store.liveStates.find((ls) => ls.device_id === requestedDeviceId);
        if (live) {
          live.machine_id = id;
          live.machine_name = data.name.trim();
        }
      }

      const now = new Date().toISOString();
      const newMachine: Machine = {
        machine_id: id,
        name: data.name.trim(),
        code: id,
        bound_device_id: requestedDeviceId,
        modbus_slave_id: modbusSlaveId,
        created_at: now,
        updated_at: now,
      };
      store.machines.push(newMachine);
      store.addAudit('CREATE_MACHINE', 'MACHINE', newMachine.machine_id, `Created machine ${newMachine.name}`, {
        machine_id: newMachine.machine_id,
        machine_name: newMachine.name,
        device_id: newMachine.bound_device_id,
      });
      if (requestedDeviceId) {
        store.addOperationalEvent(
          'MACHINE_BOUND',
          'INFO',
          `Edge device ${requestedDeviceId} diikatkan saat pembuatan mesin ${newMachine.name}`,
          {
            machine_id: newMachine.machine_id,
            machine_name: newMachine.name,
            device_id: requestedDeviceId,
          }
        );
      }
      return enrichAndValidateMachine(newMachine);
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_CREATED', {
      machine_id: created.machine_id,
      name: created.name,
      bound_device_id: created.bound_device_id,
    });
    if (created.bound_device_id) {
      telemetrySocket.emitLifecycleEvent('MACHINE_BOUND', {
        machine_id: created.machine_id,
        device_id: created.bound_device_id,
      });
    }
    return created;
  },

  async updateMachine(
    machineId: string,
    patch: { name?: string; modbus_slave_id?: number }
  ): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });

    const rawPatch = patch as Record<string, unknown>;
    if (
      rawPatch.bound_device_id !== undefined ||
      rawPatch.device_id !== undefined ||
      rawPatch.machine_id !== undefined
    ) {
      throwValidationIssues('Pembaruan relasi device tidak diizinkan melalui endpoint mesin.', {
        bound_device_id: 'Gunakan endpoint POST /bind atau POST /unbind untuk mengubah ikatan device.',
      });
    }

    const errors = validateMachineInput({
      machineName: patch.name,
      modbusSlaveId: patch.modbus_slave_id,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan mesin gagal.', errors);
    }

    store.recordEndpoint('MACHINES_UPDATE', ADMIN_ENDPOINTS.MACHINES_UPDATE.buildPath(machineId));
    const updated = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }
      if (
        patch.modbus_slave_id !== undefined &&
        store.machines.some((m) => m.machine_id !== machineId && m.modbus_slave_id === patch.modbus_slave_id)
      ) {
        throw new ApiError({
          code: 'MODBUS_SLAVE_CONFLICT',
          message: `Modbus Slave ID ${patch.modbus_slave_id} sudah dipakai mesin lain.`,
          httpStatus: 409,
        });
      }

      if (patch.name !== undefined) machine.name = patch.name.trim();
      if (patch.modbus_slave_id !== undefined) machine.modbus_slave_id = patch.modbus_slave_id;
      machine.updated_at = new Date().toISOString();

      if (machine.bound_device_id) {
        const dev = store.devices.find((d) => d.device_id === machine.bound_device_id);
        if (dev) dev.bound_machine_name = machine.name;
        const live = store.liveStates.find((ls) => ls.device_id === machine.bound_device_id);
        if (live) live.machine_name = machine.name;
      }

      store.addAudit('UPDATE_MACHINE', 'MACHINE', machineId, `Updated machine ${machine.name}`, {
        machine_id: machineId,
        machine_name: machine.name,
      });
      return enrichAndValidateMachine(machine);
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_UPDATED', {
      machine_id: updated.machine_id,
      name: updated.name,
      modbus_slave_id: updated.modbus_slave_id,
    });
    return updated;
  },

  async deleteMachine(machineId: string): Promise<{ success: boolean }> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });
    store.recordEndpoint('MACHINES_DELETE', ADMIN_ENDPOINTS.MACHINES_DELETE.buildPath(machineId));

    const deletedMeta = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }

      const activeWo = store.workOrders.find(
        (w) => w.machine_id === machineId && (w.status === 'ACTIVE' || w.status === 'PENDING')
      );
      if (activeWo) {
        throw new ApiError({
          code: 'MACHINE_HAS_ACTIVE_WO',
          message: `Tidak dapat menghapus mesin: sedang menjalankan Work Order ${activeWo.status} (${activeWo.wo_id}).`,
          httpStatus: 409,
          activeWoId: activeWo.wo_id,
        });
      }

      const activeDt = store.downtimes.find((d) => d.machine_id === machineId && d.ended_at === null);
      if (activeDt) {
        throw new ApiError({
          code: 'MACHINE_HAS_ACTIVE_DOWNTIME',
          message: `Tidak dapat menghapus mesin: masih ada downtime aktif (${activeDt.id}).`,
          httpStatus: 409,
        });
      }

      const prevDeviceId = machine.bound_device_id;
      if (prevDeviceId) {
        const dev = store.devices.find((d) => d.device_id === prevDeviceId);
        if (dev) {
          dev.bound_machine_id = null;
          dev.bound_machine_name = null;
        }
      }

      // ON DELETE SET NULL on historical & live references
      store.workOrders.forEach((wo) => {
        if (wo.machine_id === machineId) {
          wo.machine_id = null;
          wo.machine_name = null;
        }
      });
      store.downtimes.forEach((dt) => {
        if (dt.machine_id === machineId) {
          dt.machine_id = null;
          dt.machine_name = '[deleted]';
        }
      });
      store.operationalEvents.forEach((ev) => {
        if (ev.machine_id === machineId) {
          ev.machine_id = null;
          ev.machine_name = '[deleted]';
        }
      });
      store.liveStates.forEach((ls) => {
        if (ls.machine_id === machineId) {
          ls.machine_id = null;
          ls.machine_name = '[deleted]';
        }
      });

      store.machines = store.machines.filter((m) => m.machine_id !== machineId);
      store.addAudit('DELETE_MACHINE', 'MACHINE', machineId, `Deleted machine ${machineId} (history preserved)`);
      return { prevDeviceId };
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_DELETED', {
      machine_id: machineId,
      unbound_device_id: deletedMeta.prevDeviceId,
    });
    return { success: true };
  },

  async bindDevice(machineId: string, deviceIdInput: string | { device_id: string }): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });
    const rawDeviceId = typeof deviceIdInput === 'string' ? deviceIdInput : deviceIdInput?.device_id;
    const parsedReq = BindDeviceRequestSchema.safeParse({ device_id: (rawDeviceId ?? '').trim() });
    if (!parsedReq.success) {
      throwValidationIssues('Payload binding device tidak valid.', {
        device_id: 'device_id wajib mengikuti format STM32-...',
      });
    }
    const deviceId = parsedReq.data.device_id;
    store.recordEndpoint('MACHINES_BIND', ADMIN_ENDPOINTS.MACHINES_BIND.buildPath(machineId));

    const updatedMachine = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }
      if (machine.bound_device_id) {
        throw new ApiError({
          code: 'MACHINE_ALREADY_BOUND',
          message: `Mesin ${machineId} sudah terikat ke perangkat ${machine.bound_device_id}. Lepas ikatan terlebih dahulu.`,
          httpStatus: 409,
        });
      }

      const device = store.devices.find((d) => d.device_id === deviceId);
      if (!device) {
        throw new ApiError({ code: 'DEVICE_NOT_FOUND', message: 'Perangkat tidak ditemukan.', httpStatus: 404 });
      }
      if (device.bound_machine_id || store.machines.some((m) => m.bound_device_id === deviceId)) {
        const holder =
          device.bound_machine_id || store.machines.find((m) => m.bound_device_id === deviceId)?.machine_id;
        throw new ApiError({
          code: 'DEVICE_ALREADY_BOUND',
          message: `Perangkat ${deviceId} sudah terikat ke mesin ${holder}.`,
          httpStatus: 409,
        });
      }

      machine.bound_device_id = deviceId;
      machine.updated_at = new Date().toISOString();
      device.bound_machine_id = machineId;
      device.bound_machine_name = machine.name;

      const live = store.liveStates.find((ls) => ls.device_id === deviceId);
      if (live) {
        live.machine_id = machineId;
        live.machine_name = machine.name;
      }

      store.addAudit('MACHINE_BOUND', 'MACHINE', machineId, `Bound edge device ${deviceId} to ${machine.name}`, {
        machine_id: machineId,
        machine_name: machine.name,
        device_id: deviceId,
      });
      store.addOperationalEvent(
        'MACHINE_BOUND',
        'INFO',
        `Edge device ${deviceId} berhasil diikatkan ke mesin ${machine.name} (${machineId})`,
        {
          machine_id: machineId,
          machine_name: machine.name,
          device_id: deviceId,
        }
      );

      return enrichAndValidateMachine(machine);
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_BOUND', {
      machine_id: machineId,
      device_id: deviceId,
      machine_name: updatedMachine.name,
    });
    return updatedMachine;
  },

  async unbindDevice(machineId: string): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });
    store.recordEndpoint('MACHINES_UNBIND', ADMIN_ENDPOINTS.MACHINES_UNBIND.buildPath(machineId));

    const result = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }
      if (!machine.bound_device_id) {
        throw new ApiError({
          code: 'MACHINE_NOT_BOUND',
          message: `Mesin ${machineId} tidak memiliki perangkat terikat.`,
          httpStatus: 400,
        });
      }
      const activeWo = store.workOrders.find(
        (w) => w.machine_id === machineId && (w.status === 'ACTIVE' || w.status === 'PENDING')
      );
      if (activeWo) {
        throw new ApiError({
          code: 'MACHINE_HAS_ACTIVE_WO',
          message: `Tidak dapat melepas perangkat: mesin memiliki Work Order ${activeWo.status} (${activeWo.wo_id}).`,
          httpStatus: 409,
          activeWoId: activeWo.wo_id,
        });
      }

      const prevDeviceId = machine.bound_device_id;
      machine.bound_device_id = null;
      machine.updated_at = new Date().toISOString();

      const dev = store.devices.find((d) => d.device_id === prevDeviceId);
      if (dev) {
        dev.bound_machine_id = null;
        dev.bound_machine_name = null;
      }

      const live = store.liveStates.find((ls) => ls.device_id === prevDeviceId);
      if (live) {
        live.machine_id = null;
        live.machine_name = 'Unbound Edge Controller';
      }

      store.addAudit('MACHINE_UNBOUND', 'MACHINE', machineId, `Unbound device ${prevDeviceId} from ${machine.name}`, {
        machine_id: machineId,
        machine_name: machine.name,
        device_id: prevDeviceId,
      });
      store.addOperationalEvent(
        'MACHINE_UNBOUND',
        'INFO',
        `Ikatan edge device ${prevDeviceId} dilepas dari mesin ${machine.name} (${machineId})`,
        {
          machine_id: machineId,
          machine_name: machine.name,
          device_id: prevDeviceId,
        }
      );

      return {
        machine: enrichAndValidateMachine(machine),
        prevDeviceId,
      };
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_UNBOUND', {
      machine_id: machineId,
      device_id: result.prevDeviceId,
      machine_name: result.machine.name,
    });
    return result.machine;
  },

  // =========================================================================
  // PRODUCTS (5 ops — public read; ADMIN+LAN mutations)
  // =========================================================================
  async getProductsPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<Product>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('PRODUCTS_LIST', `${ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath()}?${qs.toString()}`);
    return paginateWithCursor(store.products, (p) => p.created_at ?? '2026-01-01T00:00:00Z', {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
  },

  async getProducts(signal?: AbortSignal): Promise<Product[]> {
    checkAbort(signal);
    store.recordEndpoint('PRODUCTS_LIST', ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath());
    return store.products.map((p) => ({ ...p }));
  },

  async getProductById(productId: string, signal?: AbortSignal): Promise<Product> {
    checkAbort(signal);
    store.recordEndpoint('PRODUCTS_GET', ADMIN_ENDPOINTS.PRODUCTS_GET.buildPath(productId));
    const prod = store.products.find((p) => p.product_id === productId);
    if (!prod) {
      throw new ApiError({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.', httpStatus: 404 });
    }
    return { ...prod };
  },

  async createProduct(data: {
    product_id: string;
    sku?: string;
    name: string;
    ideal_cycle_time_seconds: number;
    active?: boolean;
  }): Promise<Product> {
    assertCapability('product.manage', ['ADMIN'], { resourceId: data.product_id });
    const errors = validateProductInput({
      productId: data.product_id,
      productName: data.name,
      stdCycleTimeSec: data.ideal_cycle_time_seconds,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan produk gagal.', errors);
    }

    store.recordEndpoint('PRODUCTS_CREATE', ADMIN_ENDPOINTS.PRODUCTS_CREATE.buildPath());
    const id = data.product_id.trim();
    if (store.products.some((p) => p.product_id === id)) {
      throw new ApiError({
        code: 'PRODUCT_ALREADY_EXISTS',
        message: `Product ID "${id}" sudah ada.`,
        httpStatus: 409,
      });
    }

    const newProd: Product = {
      product_id: id,
      sku: data.sku?.trim() || id,
      name: data.name.trim(),
      ideal_cycle_time_seconds: data.ideal_cycle_time_seconds,
      active: data.active ?? true,
      created_at: new Date().toISOString(),
    };
    store.products.push(newProd);
    store.addAudit('CREATE_PRODUCT', 'PRODUCT', newProd.product_id, `Created product ${newProd.product_id} (${newProd.name})`);
    return { ...newProd };
  },

  async updateProduct(
    productId: string,
    patch: { sku?: string; name?: string; ideal_cycle_time_seconds?: number; active?: boolean }
  ): Promise<Product> {
    assertCapability('product.manage', ['ADMIN'], { resourceId: productId });
    const prod = store.products.find((p) => p.product_id === productId);
    if (!prod) {
      store.recordEndpoint('PRODUCTS_UPDATE', ADMIN_ENDPOINTS.PRODUCTS_UPDATE.buildPath(productId));
      throw new ApiError({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.', httpStatus: 404 });
    }

    const errors = validateProductInput({
      productName: patch.name ?? prod.name,
      stdCycleTimeSec: patch.ideal_cycle_time_seconds ?? prod.ideal_cycle_time_seconds,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan produk gagal.', errors);
    }

    store.recordEndpoint('PRODUCTS_UPDATE', ADMIN_ENDPOINTS.PRODUCTS_UPDATE.buildPath(productId));
    Object.assign(prod, patch);
    store.addAudit('UPDATE_PRODUCT', 'PRODUCT', productId, `Updated product ${prod.product_id}`);
    return { ...prod };
  },

  async deleteProduct(productId: string): Promise<{ success: boolean }> {
    assertCapability('product.manage', ['ADMIN'], { resourceId: productId });
    store.recordEndpoint('PRODUCTS_DELETE', ADMIN_ENDPOINTS.PRODUCTS_DELETE.buildPath(productId));
    const prod = store.products.find((p) => p.product_id === productId);
    if (!prod) {
      throw new ApiError({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.', httpStatus: 404 });
    }

    const activeWo = store.workOrders.find(
      (w) => w.product_id === productId && (w.status === 'ACTIVE' || w.status === 'PENDING')
    );
    if (activeWo) {
      throw new ApiError({
        code: 'PRODUCT_HAS_ACTIVE_WO',
        message: `Tidak dapat menghapus produk: dipakai oleh Work Order ${activeWo.status} (${activeWo.wo_id}).`,
        httpStatus: 409,
        activeWoId: activeWo.wo_id,
      });
    }

    // ON DELETE SET NULL preserves historical completed/aborted WOs
    store.workOrders.forEach((wo) => {
      if (wo.product_id === productId) {
        wo.product_id = null;
        wo.product_name = null;
      }
    });

    store.products = store.products.filter((p) => p.product_id !== productId);
    store.addAudit('PRODUCT_DELETED', 'PRODUCT', productId, `Deleted product ${productId} (WO history set null)`);
    return { success: true };
  },


  // =========================================================================
  // PRODUCTION LINES / SHIFTS / SHIFT SCHEDULES (15 ops)
  // =========================================================================
  async getProductionLinesPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<ProductionLine>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('PRODUCTION_LINES_LIST', `${ADMIN_ENDPOINTS.PRODUCTION_LINES_LIST.buildPath()}?${qs.toString()}`);
    const page = paginateWithCursor(
      store.productionLines.map((l) => ({ ...l })),
      (l) => l.createdAt,
      { cursor: query.cursor, limit: query.limit ?? 50, maxLimit: 100 }
    );
    return normalizeListResponse(page, ProductionLineSchema, query.limit ?? 50);
  },

  async getProductionLineById(lineId: string, signal?: AbortSignal): Promise<ProductionLine> {
    checkAbort(signal);
    store.recordEndpoint('PRODUCTION_LINES_GET', ADMIN_ENDPOINTS.PRODUCTION_LINES_GET.buildPath(lineId));
    const line = store.productionLines.find((l) => l.lineId === lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...line };
  },

  async createProductionLine(data: {
    lineId: string;
    lineName: string;
    description?: string | null;
    isActive?: boolean;
  }): Promise<ProductionLine> {
    assertCapability('production_line.manage', ['ADMIN'], { resourceId: data.lineId });
    const errors = validateProductionLineInput({
      lineId: data.lineId,
      lineName: data.lineName,
      description: data.description,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan lini produksi gagal.', errors);
    }
    store.recordEndpoint('PRODUCTION_LINES_CREATE', ADMIN_ENDPOINTS.PRODUCTION_LINES_CREATE.buildPath());
    const id = data.lineId.trim();
    if (store.productionLines.some((l) => l.lineId === id)) {
      throw new ApiError({ code: 'PRODUCTION_LINE_ALREADY_EXISTS', message: `Line ID "${id}" sudah ada.`, httpStatus: 409 });
    }
    const created: ProductionLine = {
      lineId: id,
      lineName: data.lineName.trim(),
      description: data.description?.trim() || null,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
    };
    store.productionLines.push(created);
    store.addAudit('CREATE_PRODUCTION_LINE', 'PRODUCTION_LINE', created.lineId, `Created production line ${created.lineId} (${created.lineName})`);
    return { ...created };
  },

  async updateProductionLine(
    lineId: string,
    patch: { lineName?: string; description?: string | null; isActive?: boolean }
  ): Promise<ProductionLine> {
    assertCapability('production_line.manage', ['ADMIN'], { resourceId: lineId });
    const errors = validateProductionLineInput({
      lineName: patch.lineName,
      description: patch.description,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi perubahan lini produksi gagal.', errors);
    }
    store.recordEndpoint('PRODUCTION_LINES_UPDATE', ADMIN_ENDPOINTS.PRODUCTION_LINES_UPDATE.buildPath(lineId));
    const line = store.productionLines.find((l) => l.lineId === lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    if (patch.lineName !== undefined) line.lineName = patch.lineName.trim();
    if (patch.description !== undefined) line.description = patch.description?.trim() || null;
    if (patch.isActive !== undefined) line.isActive = patch.isActive;
    store.addAudit('UPDATE_PRODUCTION_LINE', 'PRODUCTION_LINE', lineId, `Updated production line ${lineId}`);
    return { ...line };
  },

  async deleteProductionLine(lineId: string): Promise<{ success: boolean }> {
    assertCapability('production_line.manage', ['ADMIN'], { resourceId: lineId });
    store.recordEndpoint('PRODUCTION_LINES_DELETE', ADMIN_ENDPOINTS.PRODUCTION_LINES_DELETE.buildPath(lineId));
    const line = store.productionLines.find((l) => l.lineId === lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    // ON DELETE RESTRICT: lini yang masih dipakai mesin/operator tidak boleh dihapus.
    const inUseByMachine = store.machines.find((m) => m.line_id === lineId);
    const inUseByOperator = store.operators.find((o) => o.line_id === lineId);
    if (inUseByMachine || inUseByOperator) {
      const who = inUseByMachine ? `mesin ${inUseByMachine.machine_id}` : `operator ${inUseByOperator!.operator_id}`;
      throw new ApiError({
        code: 'PRODUCTION_LINE_IN_USE',
        message: `Tidak dapat menghapus lini: masih dipakai oleh ${who}. Pindahkan dulu referensinya.`,
        httpStatus: 409,
      });
    }
    store.productionLines = store.productionLines.filter((l) => l.lineId !== lineId);
    store.addAudit('DELETE_PRODUCTION_LINE', 'PRODUCTION_LINE', lineId, `Deleted production line ${lineId} (riwayat shift & WO tetap tersimpan)`);
    return { success: true };
  },

  async getShiftsPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<Shift>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('SHIFTS_LIST', `${ADMIN_ENDPOINTS.SHIFTS_LIST.buildPath()}?${qs.toString()}`);
    const page = paginateWithCursor(
      store.shifts.map((s) => ({ ...s })),
      (s) => s.createdAt,
      { cursor: query.cursor, limit: query.limit ?? 50, maxLimit: 100 }
    );
    return normalizeListResponse(page, ShiftSchema, query.limit ?? 50);
  },

  async getShiftById(shiftId: string, signal?: AbortSignal): Promise<Shift> {
    checkAbort(signal);
    store.recordEndpoint('SHIFTS_GET', ADMIN_ENDPOINTS.SHIFTS_GET.buildPath(shiftId));
    const shift = store.shifts.find((s) => s.shiftId === shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...shift };
  },

  async createShift(data: {
    shiftId: string;
    shiftName: string;
    shiftCode: string;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }): Promise<Shift> {
    assertCapability('shift.manage', ['ADMIN'], { resourceId: data.shiftId });
    const errors = validateShiftInput({
      shiftId: data.shiftId,
      shiftName: data.shiftName,
      shiftCode: data.shiftCode,
      startTime: data.startTime,
      endTime: data.endTime,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan shift gagal.', errors);
    }
    store.recordEndpoint('SHIFTS_CREATE', ADMIN_ENDPOINTS.SHIFTS_CREATE.buildPath());
    const id = data.shiftId.trim();
    if (store.shifts.some((s) => s.shiftId === id)) {
      throw new ApiError({ code: 'SHIFT_ALREADY_EXISTS', message: `Shift ID "${id}" sudah ada.`, httpStatus: 409 });
    }
    const created: Shift = {
      shiftId: id,
      shiftName: data.shiftName.trim(),
      shiftCode: data.shiftCode.trim(),
      startTime: data.startTime,
      endTime: data.endTime,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
    };
    store.shifts.push(created);
    store.addAudit('CREATE_SHIFT', 'SHIFT', created.shiftId, `Created shift ${created.shiftId} (${created.shiftName})`);
    return { ...created };
  },

  async updateShift(
    shiftId: string,
    patch: { shiftName?: string; shiftCode?: string; startTime?: string; endTime?: string; isActive?: boolean }
  ): Promise<Shift> {
    assertCapability('shift.manage', ['ADMIN'], { resourceId: shiftId });
    const errors = validateShiftInput({
      shiftName: patch.shiftName,
      shiftCode: patch.shiftCode,
      startTime: patch.startTime,
      endTime: patch.endTime,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi perubahan shift gagal.', errors);
    }
    store.recordEndpoint('SHIFTS_UPDATE', ADMIN_ENDPOINTS.SHIFTS_UPDATE.buildPath(shiftId));
    const shift = store.shifts.find((s) => s.shiftId === shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    if (patch.shiftName !== undefined) shift.shiftName = patch.shiftName.trim();
    if (patch.shiftCode !== undefined) shift.shiftCode = patch.shiftCode.trim();
    if (patch.startTime !== undefined) shift.startTime = patch.startTime;
    if (patch.endTime !== undefined) shift.endTime = patch.endTime;
    if (patch.isActive !== undefined) shift.isActive = patch.isActive;
    // Denormalisasi jadwal yang memakai shift ini ikut diperbarui.
    store.shiftSchedules.forEach((sch) => {
      if (sch.shiftId === shiftId) {
        sch.shiftName = shift.shiftName;
        sch.shiftCode = shift.shiftCode;
        sch.startTime = shift.startTime;
        sch.endTime = shift.endTime;
      }
    });
    store.addAudit('UPDATE_SHIFT', 'SHIFT', shiftId, `Updated shift ${shiftId}`);
    return { ...shift };
  },

  async deleteShift(shiftId: string): Promise<{ success: boolean }> {
    assertCapability('shift.manage', ['ADMIN'], { resourceId: shiftId });
    store.recordEndpoint('SHIFTS_DELETE', ADMIN_ENDPOINTS.SHIFTS_DELETE.buildPath(shiftId));
    const shift = store.shifts.find((s) => s.shiftId === shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const inUse = store.shiftSchedules.find((sch) => sch.shiftId === shiftId);
    if (inUse) {
      throw new ApiError({
        code: 'SHIFT_IN_USE',
        message: `Tidak dapat menghapus shift: masih dipakai jadwal ${inUse.scheduleId} (lini ${inUse.lineId}). Hapus jadwalnya dulu.`,
        httpStatus: 409,
      });
    }
    store.shifts = store.shifts.filter((s) => s.shiftId !== shiftId);
    store.addAudit('DELETE_SHIFT', 'SHIFT', shiftId, `Deleted shift ${shiftId} (riwayat shift summary tetap tersimpan)`);
    return { success: true };
  },

  async getShiftSchedulesPage(
    query: { line_id?: string; shift_id?: string; day_of_week?: number; is_active?: boolean; cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<ShiftSchedule>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.line_id) qs.set('line_id', query.line_id);
    if (query.shift_id) qs.set('shift_id', query.shift_id);
    if (query.day_of_week !== undefined) qs.set('day_of_week', String(query.day_of_week));
    if (query.is_active !== undefined) qs.set('is_active', String(query.is_active));
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('SHIFT_SCHEDULES_LIST', `${ADMIN_ENDPOINTS.SHIFT_SCHEDULES_LIST.buildPath()}?${qs.toString()}`);
    let items = store.shiftSchedules.map((s) => ({ ...s }));
    if (query.line_id) items = items.filter((s) => s.lineId === query.line_id);
    if (query.shift_id) items = items.filter((s) => s.shiftId === query.shift_id);
    if (query.day_of_week !== undefined) items = items.filter((s) => s.dayOfWeek === query.day_of_week);
    if (query.is_active !== undefined) items = items.filter((s) => s.isActive === query.is_active);
    const page = paginateWithCursor(items, (s) => s.createdAt, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
    return normalizeListResponse(page, ShiftScheduleSchema, query.limit ?? 50);
  },

  async getShiftScheduleById(scheduleId: string, signal?: AbortSignal): Promise<ShiftSchedule> {
    checkAbort(signal);
    store.recordEndpoint('SHIFT_SCHEDULES_GET', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_GET.buildPath(scheduleId));
    const sch = store.shiftSchedules.find((s) => s.scheduleId === scheduleId);
    if (!sch) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_NOT_FOUND', message: `Jadwal shift "${scheduleId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...sch };
  },

  async createShiftSchedule(data: {
    lineId: string;
    shiftId: string;
    dayOfWeek: number;
    isActive?: boolean;
  }): Promise<ShiftSchedule> {
    assertCapability('shift_schedule.manage', ['ADMIN']);
    const errors = validateShiftScheduleInput({
      lineId: data.lineId,
      shiftId: data.shiftId,
      dayOfWeek: data.dayOfWeek,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan jadwal shift gagal.', errors);
    }
    const line = store.productionLines.find((l) => l.lineId === data.lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${data.lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const shift = store.shifts.find((s) => s.shiftId === data.shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${data.shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    store.recordEndpoint('SHIFT_SCHEDULES_CREATE', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_CREATE.buildPath());
    assertNoScheduleOverlap(data.lineId, data.shiftId, data.dayOfWeek, null);
    const scheduleId = `sched-${data.lineId.toLowerCase()}-${data.shiftId.toLowerCase()}-d${data.dayOfWeek}`;
    if (store.shiftSchedules.some((s) => s.scheduleId === scheduleId)) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_ALREADY_EXISTS', message: `Jadwal untuk lini ${data.lineId} / shift ${data.shiftId} / hari ${data.dayOfWeek} sudah ada.`, httpStatus: 409 });
    }
    const created: ShiftSchedule = {
      scheduleId,
      lineId: data.lineId,
      shiftId: data.shiftId,
      dayOfWeek: data.dayOfWeek,
      isActive: data.isActive ?? true,
      shiftName: shift.shiftName,
      shiftCode: shift.shiftCode,
      startTime: shift.startTime,
      endTime: shift.endTime,
      createdAt: new Date().toISOString(),
    };
    store.shiftSchedules.push(created);
    store.addAudit('CREATE_SHIFT_SCHEDULE', 'SHIFT_SCHEDULE', created.scheduleId, `Created shift schedule ${created.scheduleId}`);
    return { ...created };
  },

  async updateShiftSchedule(
    scheduleId: string,
    patch: { lineId?: string; shiftId?: string; dayOfWeek?: number; isActive?: boolean }
  ): Promise<ShiftSchedule> {
    assertCapability('shift_schedule.manage', ['ADMIN'], { resourceId: scheduleId });
    const errors = validateShiftScheduleInput({
      lineId: patch.lineId,
      shiftId: patch.shiftId,
      dayOfWeek: patch.dayOfWeek,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi perubahan jadwal shift gagal.', errors);
    }
    store.recordEndpoint('SHIFT_SCHEDULES_UPDATE', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_UPDATE.buildPath(scheduleId));
    const sch = store.shiftSchedules.find((s) => s.scheduleId === scheduleId);
    if (!sch) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_NOT_FOUND', message: `Jadwal shift "${scheduleId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const nextLineId = patch.lineId ?? sch.lineId;
    const nextShiftId = patch.shiftId ?? sch.shiftId;
    const nextDay = patch.dayOfWeek ?? sch.dayOfWeek;
    if (!store.productionLines.some((l) => l.lineId === nextLineId)) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${nextLineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const nextShift = store.shifts.find((s) => s.shiftId === nextShiftId);
    if (!nextShift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${nextShiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    assertNoScheduleOverlap(nextLineId, nextShiftId, nextDay, scheduleId);
    sch.lineId = nextLineId;
    sch.shiftId = nextShiftId;
    sch.dayOfWeek = nextDay;
    if (patch.isActive !== undefined) sch.isActive = patch.isActive;
    sch.shiftName = nextShift.shiftName;
    sch.shiftCode = nextShift.shiftCode;
    sch.startTime = nextShift.startTime;
    sch.endTime = nextShift.endTime;
    store.addAudit('UPDATE_SHIFT_SCHEDULE', 'SHIFT_SCHEDULE', scheduleId, `Updated shift schedule ${scheduleId}`);
    return { ...sch };
  },

  async deleteShiftSchedule(scheduleId: string): Promise<{ success: boolean }> {
    assertCapability('shift_schedule.manage', ['ADMIN'], { resourceId: scheduleId });
    store.recordEndpoint('SHIFT_SCHEDULES_DELETE', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_DELETE.buildPath(scheduleId));
    const sch = store.shiftSchedules.find((s) => s.scheduleId === scheduleId);
    if (!sch) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_NOT_FOUND', message: `Jadwal shift "${scheduleId}" tidak ditemukan.`, httpStatus: 404 });
    }
    store.shiftSchedules = store.shiftSchedules.filter((s) => s.scheduleId !== scheduleId);
    store.addAudit('DELETE_SHIFT_SCHEDULE', 'SHIFT_SCHEDULE', scheduleId, `Deleted shift schedule ${scheduleId} (riwayat shift summary tetap tersimpan)`);
    return { success: true };
  },

  // =========================================================================
  // OPERATORS (7 ops — ADMIN/SUPERVISOR read/create/status; ADMIN ONLY update/delete/password)
  // =========================================================================
  async getOperators(signal?: AbortSignal): Promise<Operator[]> {
    checkAbort(signal);
    assertCapability('operator.read', ['ADMIN', 'SUPERVISOR']);
    store.recordEndpoint('OPERATORS_LIST', ADMIN_ENDPOINTS.OPERATORS_LIST.buildPath());
    return store.operators.map((o) => OperatorSchema.parse({ ...o }));
  },

  async getOperatorById(operatorId: string, signal?: AbortSignal): Promise<Operator> {
    checkAbort(signal);
    assertCapability('operator.read', ['ADMIN', 'SUPERVISOR'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_GET', ADMIN_ENDPOINTS.OPERATORS_GET.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    return OperatorSchema.parse({ ...op });
  },

  async createOperator(data: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
    password: string;
    is_active?: boolean;
  }): Promise<Operator> {
    assertCapability('operator.create', ['ADMIN', 'SUPERVISOR'], { resourceId: data.operator_id });
    if (!canManageTargetRole(store.currentUserRole, data.role)) {
      const err = new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Peran ${store.currentUserRole} tidak berhak membuat akun dengan peran ${data.role}.`,
        httpStatus: 403,
      });
      store.hooks.onForbidden?.('operator.create', data.operator_id, err.message);
      throw err;
    }

    const errors = validateOperatorInput({
      operatorId: data.operator_id,
      operatorName: data.name,
      lineId: data.line_id,
      password: data.password,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan operator gagal.', errors);
    }

    store.recordEndpoint('OPERATORS_CREATE', ADMIN_ENDPOINTS.OPERATORS_CREATE.buildPath());
    const id = data.operator_id.trim();
    if (store.operators.some((o) => o.operator_id === id)) {
      throw new ApiError({
        code: 'OPERATOR_ALREADY_EXISTS',
        message: `Operator ID "${id}" sudah ada.`,
        httpStatus: 409,
      });
    }

    const newOp: Operator = OperatorSchema.parse({
      operator_id: id,
      name: data.name.trim(),
      role: data.role,
      line_id: data.line_id?.trim() || 'LINE-01',
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
    });
    store.operators.push(newOp);
    store.operatorPasswords.set(newOp.operator_id, data.password);
    store.addAudit('CREATE_OPERATOR', 'OPERATOR', newOp.operator_id, `Created operator ${newOp.name} (${newOp.role})`);
    return { ...newOp };
  },

  async updateOperator(
    operatorId: string,
    patch: { name?: string; role?: UserRole; line_id?: string }
  ): Promise<Operator> {
    assertCapability('operator.update', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_UPDATE', ADMIN_ENDPOINTS.OPERATORS_UPDATE.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    if ((op.is_protected || operatorId === 'ADM-001') && patch.role && patch.role !== 'ADMIN') {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: `Akun dilindungi (${op.operator_id}) tidak dapat diturunkan perannya.`,
        httpStatus: 403,
      });
    }
    if (patch.role && !canManageTargetRole(store.currentUserRole, patch.role)) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Peran ${store.currentUserRole} tidak berhak mengubah peran akun menjadi ${patch.role}.`,
        httpStatus: 403,
      });
    }
    const errors = validateOperatorInput({
      operatorName: patch.name ?? op.name,
      lineId: patch.line_id ?? op.line_id,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan operator gagal.', errors);
    }
    const roleChanged = patch.role !== undefined && patch.role !== op.role;
    if (patch.name !== undefined) op.name = patch.name.trim();
    if (patch.role !== undefined) op.role = patch.role;
    if (patch.line_id !== undefined) op.line_id = patch.line_id.trim() || 'LINE-01';

    if (roleChanged) {
      store.iamInfo.authzVersion += 1;
      store.tokenAuthzVersion = store.iamInfo.authzVersion;
    }
    store.addAudit('UPDATE_OPERATOR', 'OPERATOR', operatorId, `Updated operator ${op.name}`);
    return OperatorSchema.parse({ ...op });
  },

  async deleteOperator(operatorId: string): Promise<{ success: boolean }> {
    assertCapability('operator.delete', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_DELETE', ADMIN_ENDPOINTS.OPERATORS_DELETE.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    if (op.is_protected || operatorId === 'ADM-001') {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: `Akun administrator dilindungi (${op.operator_id}) dan tidak dapat dihapus.`,
        httpStatus: 403,
      });
    }
    const activeWo = store.workOrders.find(
      (w) => w.operator_id === operatorId && w.status === 'ACTIVE'
    );
    if (activeWo) {
      throw new ApiError({
        code: 'OPERATOR_HAS_ACTIVE_WO',
        message: `Tidak dapat menghapus operator: masih aktif di Work Order ${activeWo.wo_id}.`,
        httpStatus: 409,
        activeWoId: activeWo.wo_id,
      });
    }
    // ON DELETE SET NULL for historical work orders + cascade cleanup for role assignments
    store.workOrders.forEach((wo) => {
      if (wo.operator_id === operatorId) {
        wo.operator_id = null;
        wo.operator_name = null;
      }
    });
    store.operators = store.operators.filter((o) => o.operator_id !== operatorId);
    store.iamAssignments = store.iamAssignments.filter((a) => a.operator_id !== operatorId);
    store.operatorPasswords.delete(operatorId);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_OPERATOR', 'OPERATOR', operatorId, `Deleted operator ${operatorId} (history preserved)`);
    return { success: true };
  },

  async rotateOperatorPassword(operatorId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    assertCapability('operator.password.rotate', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_PASSWORD', ADMIN_ENDPOINTS.OPERATORS_PASSWORD.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
      throwValidationIssues('Password baru wajib 8–128 karakter.', {
        new_password: 'Minimal 8 dan maksimal 128 karakter.',
      });
    }
    store.operatorPasswords.set(operatorId, newPassword);
    store.addAudit('ROTATE_OPERATOR_PASSWORD', 'OPERATOR', operatorId, `Rotated password for ${operatorId}`);
    return { success: true, message: `Password untuk ${operatorId} berhasil dirotasi.` };
  },

  async toggleOperatorStatus(operatorId: string, isActive: boolean): Promise<Operator> {
    assertCapability('operator.status.update', ['ADMIN', 'SUPERVISOR'], { resourceId: operatorId });
    store.recordEndpoint('OPERATORS_STATUS', ADMIN_ENDPOINTS.OPERATORS_STATUS.buildPath(operatorId));
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    if (!canManageTargetRole(store.currentUserRole, op.role)) {
      const err = new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Peran ${store.currentUserRole} tidak dapat mengubah status akun ${op.role}.`,
        httpStatus: 403,
      });
      store.hooks.onForbidden?.('operator.status.update', operatorId, err.message);
      throw err;
    }
    if ((op.is_protected || op.operator_id === 'ADM-001') && !isActive) {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: `Akun dilindungi (${op.operator_id}) tidak dapat dinonaktifkan.`,
        httpStatus: 403,
      });
    }

    const changed = op.is_active !== isActive;
    op.is_active = isActive;
    if (changed) {
      store.iamInfo.authzVersion += 1;
      store.tokenAuthzVersion = store.iamInfo.authzVersion;
    }
    store.addAudit('UPDATE_OPERATOR_STATUS', 'OPERATOR', operatorId, `Set active status to ${isActive}`);
    return OperatorSchema.parse({ ...op });
  },

  // =========================================================================
  // WORK ORDERS (4 Admin Panel ops ONLY — NO validate-zone/initiate/dispatch/complete)
  // =========================================================================
  async getWorkOrdersPage(
    query: WorkOrdersQuery = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<WorkOrder>> {
    checkAbort(signal);
    const endpoint = buildWorkOrdersEndpoint(query);
    store.recordEndpoint('WORK_ORDERS_LIST', endpoint);

    let items = [...store.workOrders];
    if (query.wo_id?.trim()) {
      const needle = query.wo_id.trim().toLowerCase();
      items = items.filter(
        (w) =>
          w.wo_id.toLowerCase().includes(needle) ||
          w.order_number.toLowerCase().includes(needle)
      );
    }
    if (query.status) {
      items = items.filter((w) => w.status === query.status);
    }
    if (query.machine_id && query.machine_id !== 'ALL') {
      items = items.filter((w) => w.machine_id === query.machine_id);
    }
    if (query.product_id && query.product_id !== 'ALL') {
      items = items.filter((w) => w.product_id === query.product_id);
    }
    if (query.operator_id && query.operator_id !== 'ALL') {
      items = items.filter((w) => w.operator_id === query.operator_id);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) {
        items = items.filter((w) => new Date(w.planned_start).getTime() >= fromMs);
      }
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) {
        items = items.filter((w) => new Date(w.planned_start).getTime() <= toMs);
      }
    }

    return paginateWithCursor(items, (w) => w.planned_start, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
  },

  async getWorkOrders(signal?: AbortSignal): Promise<WorkOrder[]> {
    const page = await this.getWorkOrdersPage({ limit: 100 }, signal);
    return page.data;
  },

  async getWorkOrderById(woId: string, signal?: AbortSignal): Promise<WorkOrder> {
    checkAbort(signal);
    store.recordEndpoint('WORK_ORDERS_GET', ADMIN_ENDPOINTS.WORK_ORDERS_GET.buildPath(woId));
    const wo = store.workOrders.find((w) => w.wo_id === woId);
    if (!wo) {
      throw new ApiError({ code: 'WO_NOT_FOUND', message: `Work Order "${woId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...wo };
  },

  async resolveWorkOrder(woId: string, deviceId?: string, signal?: AbortSignal): Promise<WorkOrderResolveResult> {
    checkAbort(signal);
    const base = ADMIN_ENDPOINTS.WORK_ORDERS_RESOLVE.buildPath(woId);
    const resolvedPath = deviceId ? `${base}?device_id=${encodeURIComponent(deviceId)}` : base;
    store.recordEndpoint('WORK_ORDERS_RESOLVE', resolvedPath);

    const wo = store.workOrders.find((w) => w.wo_id === woId);
    if (!wo) {
      throw new ApiError({ code: 'WO_NOT_FOUND', message: `Work Order "${woId}" tidak ditemukan.`, httpStatus: 404 });
    }

    const machine = store.machines.find((m) => m.machine_id === wo.machine_id);
    const targetDeviceId = deviceId ?? machine?.bound_device_id ?? undefined;
    const device = targetDeviceId ? store.devices.find((d) => d.device_id === targetDeviceId) : undefined;

    if (device && !device.online) {
      throw new ApiError({
        code: 'DEVICE_OFFLINE',
        message: `Perangkat mesin ${device.device_id} sedang tidak terhubung (offline).`,
        httpStatus: 503,
      });
    }

    const product = store.products.find((p) => p.product_id === wo.product_id);
    const plannedOperatingSec = 25200; // 7 hours net operating after 60m break
    const targetPerHour = Math.round((wo.target_quantity / plannedOperatingSec) * 3600);

    return {
      success: true,
      work_order: {
        wo_id: wo.wo_id,
        machine_id: wo.machine_id,
        product_id: wo.product_id,
        product_name: wo.product_name,
        std_cycle_time_sec: product?.ideal_cycle_time_seconds ?? 45,
        operator_id: wo.operator_id,
        operator_name: wo.operator_name,
        target_qty: wo.target_quantity,
        targetPerHour,
        shift_plan: {
          shift_start: '07:00',
          shift_end: '15:00',
          planned_break_min: 60,
          planned_operating_sec: plannedOperatingSec,
        },
        break: {
          start: '14:00',
          end: '15:00',
          minutes: 60,
        },
        status: wo.status,
      },
    };
  },

  async cancelWorkOrder(woId: string, reason?: string): Promise<WorkOrderCancelResult> {
    assertCapability('work_order.cancel', ['ADMIN'], { resourceId: woId });
    if (reason && reason.length > 500) {
      throwValidationIssues('Alasan pembatalan maksimal 500 karakter.', {
        reason: 'Maksimal 500 karakter.',
      });
    }

    store.recordEndpoint('WORK_ORDERS_CANCEL', ADMIN_ENDPOINTS.WORK_ORDERS_CANCEL.buildPath(woId));
    const wo = store.workOrders.find((w) => w.wo_id === woId);
    if (!wo) {
      throw new ApiError({ code: 'WO_NOT_FOUND', message: `Work Order "${woId}" tidak ditemukan.`, httpStatus: 404 });
    }
    if (wo.status === 'COMPLETED' || wo.status === 'ABORTED') {
      throw new ApiError({
        code: 'WORK_ORDER_CONFLICT',
        message: `Work Order "${woId}" sudah berstatus ${wo.status} dan tidak dapat dibatalkan.`,
        httpStatus: 409,
        activeWoId: wo.wo_id,
      });
    }

    wo.status = 'ABORTED';
    wo.actual_end = new Date().toISOString();
    if (reason?.trim()) {
      wo.cancel_reason = reason.trim();
      wo.notes = reason.trim();
    }
    store.addAudit('WORK_ORDER_CANCELLED', 'WORK_ORDER', woId, `Cancelled Work Order ${woId}: ${reason || '-'}`, {
      machine_id: wo.machine_id,
      machine_name: wo.machine_name ?? '[deleted]',
    });

    return {
      success: true,
      work_order: {
        wo_id: wo.wo_id,
        status: 'ABORTED',
        machine_id: wo.machine_id,
      },
    };
  },

  // =========================================================================
  // MONITORING: LIVE STATE, DOWNTIME, OPERATIONAL EVENTS
  // =========================================================================
  async getLiveState(signal?: AbortSignal): Promise<LiveStateRecord[]> {
    checkAbort(signal);
    store.recordEndpoint('LIVE_STATE', ADMIN_ENDPOINTS.LIVE_STATE.buildPath());
    return store.liveStates.map((s) => ({
      ...s,
      fsm_state: normalizeFsmState(s.fsm_state),
    }));
  },

  async getLiveStateByDevice(deviceId: string, signal?: AbortSignal): Promise<LiveStateRecord> {
    checkAbort(signal);
    store.recordEndpoint('LIVE_STATE_BY_DEVICE', ADMIN_ENDPOINTS.LIVE_STATE_BY_DEVICE.buildPath(deviceId));
    const rec = store.liveStates.find((s) => s.device_id === deviceId);
    if (!rec) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: `Live state untuk perangkat "${deviceId}" tidak ditemukan.`,
        httpStatus: 404,
      });
    }
    return { ...rec, fsm_state: normalizeFsmState(rec.fsm_state) };
  },

  async getActiveDowntimes(signal?: AbortSignal): Promise<DowntimeEvent[]> {
    checkAbort(signal);
    store.recordEndpoint('DOWNTIME_ACTIVE', ADMIN_ENDPOINTS.DOWNTIME_ACTIVE.buildPath());
    return store.downtimes.filter((d) => d.ended_at === null).map((d) => ({ ...d }));
  },

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
      items = items.filter((d) => {
        const isGeneric =
          !d.is_labeled ||
          !d.reason ||
          d.reason.toLowerCase().includes('unclassified') ||
          d.reason.toLowerCase().includes('unplanned');
        return isGeneric;
      });
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
    assertCapability('export.telemetry', ['ADMIN', 'SUPERVISOR'], {
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
  ): Promise<DowntimeEvent> {
    assertCapability('downtime.reason.label', ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'], {
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
    return { ...dt };
  },

  // Operational Events (Global + Per-Device)
  async getOperationalEventsByDevice(
    deviceId: string,
    query: Omit<OperationalEventsQuery, 'device_id'> = {},
    signal?: AbortSignal
  ): Promise<OperationalEvent[]> {
    checkAbort(signal);
    const endpoint = buildOperationalEventsEndpoint({ ...query, device_id: deviceId });
    store.recordEndpoint('OPERATIONAL_EVENTS_BY_DEVICE', endpoint);
    return store.operationalEvents.filter((e) => e.device_id === deviceId).map((e) => ({ ...e }));
  },

  async getOperationalEvents(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal
  ): Promise<OperationalEvent[]> {
    const page = await this.getOperationalEventsPage({ ...query, limit: 200 }, signal);
    return page.data;
  },

  async getOperationalEventsPage(
    query: OperationalEventsQuery = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<OperationalEvent>> {
    checkAbort(signal);
    const isGlobal = !query.device_id || query.device_id === 'ALL';
    const endpoint = buildOperationalEventsEndpoint(query);
    store.recordEndpoint(
      isGlobal ? 'OPERATIONAL_EVENTS_LIST' : 'OPERATIONAL_EVENTS_BY_DEVICE',
      endpoint
    );

    let items = [...store.operationalEvents];
    if (!isGlobal) {
      items = items.filter((e) => e.device_id === query.device_id);
    }
    if (query.machine_id && query.machine_id !== 'ALL') {
      items = items.filter((e) => e.machine_id === query.machine_id);
    }
    if (query.event_type && query.event_type !== 'ALL') {
      items = items.filter((e) => e.event_type === query.event_type);
    }
    if (query.severity && query.severity !== 'ALL') {
      items = items.filter((e) => e.severity === query.severity);
    }
    if (query.acknowledged !== undefined) {
      items = items.filter((e) => e.acknowledged === query.acknowledged);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((e) => new Date(e.timestamp).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((e) => new Date(e.timestamp).getTime() <= toMs);
    }

    return paginateWithCursor(items, (e) => e.timestamp, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 200,
    });
  },

  async exportOperationalEventsData(
    query: OperationalEventsExportQuery,
    signal?: AbortSignal
  ): Promise<ExportResult> {
    checkAbort(signal);
    const isGlobal = !query.device_id || query.device_id === 'ALL';
    const endpoint = buildOperationalEventsExportEndpoint(query);
    assertCapability('export.telemetry', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit(
      isGlobal ? 'OPERATIONAL_EVENTS_EXPORT' : 'OPERATIONAL_EVENTS_DEVICE_EXPORT'
    );
    store.recordEndpoint(
      isGlobal ? 'OPERATIONAL_EVENTS_EXPORT' : 'OPERATIONAL_EVENTS_DEVICE_EXPORT',
      endpoint
    );

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);

    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = store.operationalEvents
      .filter((e) => {
        if (!isGlobal && e.device_id !== query.device_id) return false;
        if (query.machine_id && query.machine_id !== 'ALL' && e.machine_id !== query.machine_id) return false;
        if (query.event_type && query.event_type !== 'ALL' && e.event_type !== query.event_type) return false;
        const ts = new Date(e.timestamp).getTime();
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const rows = formatOperationalEventExportRows(filtered);
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const deviceLabel = isGlobal ? 'ALL' : query.device_id!;
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': isGlobal
        ? 'timescaledb:operational_events_global'
        : 'timescaledb:operational_events_device',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': deviceLabel,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `operational_events_${isGlobal ? 'global' : deviceLabel}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  },

  async acknowledgeOperationalEvent(id: string, note?: string): Promise<OperationalEvent> {
    assertCapability('operational_event.ack', ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'], {
      resourceId: id,
    });
    if (note && note.length > 500) {
      throwValidationIssues('Catatan ack maksimal 500 karakter.', { note: 'Maksimal 500 karakter.' });
    }

    store.recordEndpoint('OPERATIONAL_EVENTS_ACK', ADMIN_ENDPOINTS.OPERATIONAL_EVENTS_ACK.buildPath(id));
    const ev = store.operationalEvents.find((e) => e.id === id);
    if (!ev) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Operational event tidak ditemukan.', httpStatus: 404 });
    }

    // Idempotent acknowledgment (preserves original timestamp if already acknowledged unless note updated)
    if (!ev.acknowledged) {
      ev.acknowledged = true;
      ev.acknowledged_by = store.currentUserName;
      ev.acknowledged_at = new Date().toISOString();
    }
    if (note?.trim()) {
      ev.ack_note = note.trim();
    }
    store.addAudit(
      'ACK_EVENT',
      'DEVICE',
      ev.device_id ?? id,
      `Acknowledged event ${id}${ev.ack_note ? ` — Note: ${ev.ack_note}` : ''}`,
      { device_id: ev.device_id, machine_id: ev.machine_id, machine_name: ev.machine_name }
    );
    return { ...ev };
  },

  // =========================================================================
  // SYSTEM AUDIT (ADMIN + LAN only -> /api/v1/system/audit)
  // =========================================================================
  async getSystemAuditPage(
    query: { from?: string; to?: string; event_type?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<AuditLogItem>> {
    checkAbort(signal);
    assertCapability('audit.system.read', ['ADMIN']);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.from) qs.set('from', query.from);
    if (query.to) qs.set('to', query.to);
    if (query.event_type) qs.set('event_type', query.event_type);
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('SYSTEM_AUDIT', `${ADMIN_ENDPOINTS.SYSTEM_AUDIT.buildPath()}?${qs.toString()}`);

    let items = [...store.auditLogs];
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((a) => new Date(a.timestamp).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((a) => new Date(a.timestamp).getTime() <= toMs);
    }
    return paginateWithCursor(items, (a) => a.timestamp, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 200,
    });
  },

  async getAuditLogs(signal?: AbortSignal): Promise<AuditLogItem[]> {
    const page = await this.getSystemAuditPage({ limit: 200 }, signal);
    return page.data;
  },

  // =========================================================================
  // TELEMETRY, OEE, QUALITY & RECONCILIATION (12 ops)
  // =========================================================================
  async getShiftSummary(machineId?: string, signal?: AbortSignal): Promise<ShiftSummary> {
    checkAbort(signal);
    const qs = machineId ? `?machine_id=${encodeURIComponent(machineId)}` : '';
    store.recordEndpoint('OEE_SHIFT_SUMMARY', `${ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath()}${qs}`);
    const targetMachine = store.machines.find((m) => m.machine_id === machineId) || store.machines[0];
    const live = store.liveStates.find((l) => l.machine_id === targetMachine?.machine_id);
    return {
      shift_name: 'Shift 1 (07:00-15:00)',
      machine_id: targetMachine?.machine_id || 'CNC-MILLING-01',
      machine_name: targetMachine?.name || 'CNC Milling Center Alpha',
      shift_start: '2026-11-11T07:00:00+07:00',
      shift_end: '2026-11-11T15:00:00+07:00',
      tz: 'Asia/Jakarta',
      oee: live?.oee ?? 84.6,
      availability: live?.availability ?? 92.4,
      performance: live?.performance ?? 94.1,
      quality: live?.quality ?? 97.4,
      planned_production_time_min: 480,
      planned_break_min: 60,
      operating_time_min: 420,
      run_time_min: 388,
      unplanned_downtime_min: 32,
      planned_downtime_min: 60,
      total_parts: live?.total_count ?? 350,
      good_parts: live?.good_count ?? 342,
      defect_parts: live?.reject_count ?? 8,
      target_per_hour: 64,
    };
  },

  async getShiftTimeline(
    machineId?: string,
    bucket: '1m' | '5m' | '15m' | '1h' = '15m',
    signal?: AbortSignal
  ): Promise<ShiftTimelineSegment[]> {
    checkAbort(signal);
    const qs = new URLSearchParams({ bucket });
    if (machineId) qs.set('machine_id', machineId);
    store.recordEndpoint('OEE_SHIFT_TIMELINE', `${ADMIN_ENDPOINTS.OEE_SHIFT_TIMELINE.buildPath()}?${qs.toString()}`);
    return [
      { start: '07:00', end: '09:15', fsm_state: 'RUNNING', planned: false, duration_min: 135 },
      { start: '09:15', end: '09:30', fsm_state: 'UNPLANNED_DOWNTIME', planned: false, downtime_id: 'dt-ev-02', duration_min: 15 },
      { start: '09:30', end: '12:00', fsm_state: 'RUNNING', planned: false, duration_min: 150 },
      { start: '12:00', end: '12:45', fsm_state: 'PLANNED_DOWNTIME', planned: true, downtime_id: 'dt-ev-04', duration_min: 45 },
      { start: '12:45', end: '14:49', fsm_state: 'RUNNING', planned: false, duration_min: 124 },
      { start: '14:49', end: '15:00', fsm_state: 'BATCH_FINISHED', planned: false, duration_min: 11 },
    ];
  },

  async getOeeHourly(
    params: { machine_id?: string; device_id?: string; from?: string; to?: string; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    const qs = new URLSearchParams();
    if (params.machine_id) qs.set('machine_id', params.machine_id);
    if (params.device_id) qs.set('device_id', params.device_id);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.limit) qs.set('limit', String(params.limit));
    const qStr = qs.toString();
    store.recordEndpoint('OEE_HOURLY', `${ADMIN_ENDPOINTS.OEE_HOURLY.buildPath()}${qStr ? `?${qStr}` : ''}`);
    const devId =
      params.device_id ||
      store.machines.find((m) => m.machine_id === params.machine_id)?.bound_device_id ||
      'STM32-OEE-01';
    return this.getHourlyTrend(devId, signal);
  },

  async getHourlyTrend(deviceId: string, signal?: AbortSignal): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    if (!deviceId) {
      throwValidationIssues('device_id wajib disediakan.', { device_id: 'Wajib dipilih.' });
    }
    store.recordEndpoint('TELEMETRY_HOURLY', ADMIN_ENDPOINTS.TELEMETRY_HOURLY.buildPath(deviceId));
    const isUnknownCapacity = deviceId === 'STM32-OEE-05';
    return [
      { hour: '07:00', oee: isUnknownCapacity ? 0 : 78.4, availability: isUnknownCapacity ? 100 : 88.0, performance: isUnknownCapacity ? 0 : 91.0, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 42, good_count: isUnknownCapacity ? 0 : 41, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3168, hourly_downtime_sec: 432, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '08:00', oee: isUnknownCapacity ? 0 : 84.6, availability: isUnknownCapacity ? 100 : 92.4, performance: isUnknownCapacity ? 0 : 94.1, quality: isUnknownCapacity ? 100 : 97.4, parts_produced: isUnknownCapacity ? 0 : 48, good_count: isUnknownCapacity ? 0 : 47, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3326, hourly_downtime_sec: 274, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '09:00', oee: isUnknownCapacity ? 0 : 86.2, availability: isUnknownCapacity ? 100 : 94.0, performance: isUnknownCapacity ? 0 : 93.5, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 50, good_count: isUnknownCapacity ? 0 : 49, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3384, hourly_downtime_sec: 216, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '10:00', oee: isUnknownCapacity ? 0 : 82.0, availability: isUnknownCapacity ? 100 : 90.0, performance: isUnknownCapacity ? 0 : 92.0, quality: isUnknownCapacity ? 100 : 99.0, parts_produced: isUnknownCapacity ? 0 : 46, good_count: isUnknownCapacity ? 0 : 46, defect_count: 0, hourly_operating_sec: 3600, hourly_run_sec: 3240, hourly_downtime_sec: 360, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '11:00', oee: isUnknownCapacity ? 0 : 85.5, availability: isUnknownCapacity ? 100 : 93.0, performance: isUnknownCapacity ? 0 : 94.0, quality: isUnknownCapacity ? 100 : 97.8, parts_produced: isUnknownCapacity ? 0 : 49, good_count: isUnknownCapacity ? 0 : 48, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3348, hourly_downtime_sec: 252, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '12:00', oee: 0.0, availability: 0.0, performance: 0.0, quality: 100.0, parts_produced: 0, good_count: 0, defect_count: 0, hourly_operating_sec: 0, hourly_run_sec: 0, hourly_downtime_sec: 3600, sampleCount: 12, targetPerHour: 0, state: 'PLANNED_DOWNTIME', planned: true, provisional: false },
      { hour: '13:00', oee: isUnknownCapacity ? 0 : 87.8, availability: isUnknownCapacity ? 100 : 95.0, performance: isUnknownCapacity ? 0 : 94.5, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 52, good_count: isUnknownCapacity ? 0 : 51, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3420, hourly_downtime_sec: 180, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
      { hour: '14:00', oee: isUnknownCapacity ? 0 : 84.0, availability: isUnknownCapacity ? 100 : 92.0, performance: isUnknownCapacity ? 0 : 93.0, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 47, good_count: isUnknownCapacity ? 0 : 46, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3312, hourly_downtime_sec: 288, sampleCount: 44, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
    ];
  },

  async getTelemetryAggregate(
    deviceId: string,
    bucket: '1m' | '5m' | '15m' | '1h' | '1d' = '1h',
    signal?: AbortSignal
  ): Promise<{
    device_id: string;
    bucket: string;
    avg_oee: number;
    avg_availability: number;
    avg_performance: number;
    avg_quality: number;
    total_parts: number;
    sample_count: number;
  }> {
    checkAbort(signal);
    store.recordEndpoint(
      'TELEMETRY_AGGREGATE',
      `${ADMIN_ENDPOINTS.TELEMETRY_AGGREGATE.buildPath(deviceId)}?bucket=${bucket}`
    );
    const mult = bucket === '1m' ? 12 : bucket === '5m' ? 36 : bucket === '15m' ? 108 : bucket === '1h' ? 432 : 1850;
    return {
      device_id: deviceId,
      bucket,
      avg_oee: deviceId === 'STM32-OEE-05' ? 0 : 83.5,
      avg_availability: deviceId === 'STM32-OEE-05' ? 100 : 91.4,
      avg_performance: deviceId === 'STM32-OEE-05' ? 0 : 93.1,
      avg_quality: deviceId === 'STM32-OEE-05' ? 100 : 98.0,
      total_parts: deviceId === 'STM32-OEE-05' ? 0 : Math.round(mult * 0.77),
      sample_count: mult,
    };
  },

  async getTelemetryRollup(
    query: TelemetryRollupQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryRollupItem>> {
    checkAbort(signal);
    const fromMs = Date.parse(query.from);
    const toMs = Date.parse(query.to);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
      throwValidationIssues('Rentang waktu rollup from/to tidak valid.', {
        from: 'Pastikan format ISO 8601 valid dan from <= to.',
      });
    }

    const endpoint = buildTelemetryRollupEndpoint(query);
    store.recordEndpoint('TELEMETRY_ROLLUP', endpoint);

    const rows: TelemetryRollupItem[] = [];

    if (query.group_by === 'machine') {
      const candidates = [
        ...store.machines.map((m) => ({
          machine_id: m.machine_id as string | null,
          machine_name: m.name as string | null,
          device_id: m.bound_device_id,
          zeroCapacity: false,
        })),
        ...store.devices
          .filter((d) => !d.bound_machine_id)
          .map((d) => ({
            machine_id: null as string | null,
            machine_name: 'Unbound Edge Controller' as string | null,
            device_id: d.device_id as string | null,
            zeroCapacity: true,
          })),
      ];

      candidates.forEach((cand, idx) => {
        if (query.machine_id && query.machine_id !== 'ALL' && cand.machine_id !== query.machine_id) return;
        if (query.device_id && query.device_id !== 'ALL' && cand.device_id !== query.device_id) return;
        const live = store.liveStates.find(
          (l) =>
            (cand.device_id && l.device_id === cand.device_id) ||
            (cand.machine_id && l.machine_id === cand.machine_id)
        );
        const operatingSec = cand.zeroCapacity ? 14400 : 28800 - idx * 1200;
        const avail = cand.zeroCapacity ? 100 : live?.availability ?? 90.2;
        const runSec = Math.round((operatingSec * avail) / 100);
        const totalCount = cand.zeroCapacity ? 0 : Math.max(120, (live?.total_count ?? 220) * 4);
        const rejectCount = cand.zeroCapacity ? 0 : Math.max(2, (live?.reject_count ?? 5) * 3);
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const perf = cand.zeroCapacity ? null : Number((live?.performance ?? 92.5).toFixed(2));
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: cand.machine_id ?? cand.device_id ?? `row-${idx}`,
            groupBy: 'machine',
            machineId: cand.machine_id ?? null,
            machine_id: cand.machine_id,
            machine_name: cand.machine_name,
            device_id: cand.device_id,
            bucket: new Date(toMs).toISOString().slice(0, 10),
            totalCount,
            goodCount,
            rejectCount,
            operatingSec,
            runSec,
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: cand.zeroCapacity ? 48 : 380 - idx * 35,
            provisional: true,
          })
        );
      });
    } else if (query.group_by === 'day') {
      const days = 7;
      for (let i = 0; i < days; i++) {
        const dayDate = new Date(toMs - i * 24 * 3600_000);
        if (dayDate.getTime() < fromMs - 24 * 3600_000) continue;
        const dayKey = dayDate.toISOString().slice(0, 10);
        const zeroCap = query.device_id === 'STM32-OEE-05';
        const avail = zeroCap ? 100 : Number((91.8 - (i % 4) * 1.3).toFixed(2));
        const perf = zeroCap ? null : Number((93.6 - (i % 3) * 1.1).toFixed(2));
        const totalCount = zeroCap ? 0 : 940 - i * 24;
        const rejectCount = zeroCap ? 0 : 18 + (i % 5) * 3;
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: dayKey,
            groupBy: 'day',
            machineId: query.machine_id ?? null,
            machine_id: query.machine_id ?? null,
            machine_name: query.machine_id
              ? store.machines.find((m) => m.machine_id === query.machine_id)?.name ?? query.machine_id
              : 'Plant Aggregated',
            device_id: query.device_id ?? null,
            bucket: dayKey,
            totalCount,
            goodCount,
            rejectCount,
            operatingSec: 57600,
            runSec: Math.round((57600 * avail) / 100),
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: 1440 - i * 40,
            provisional: i === 0,
          })
        );
      }
    } else {
      // month
      for (let i = 0; i < 4; i++) {
        const d = new Date(toMs);
        d.setUTCMonth(d.getUTCMonth() - i);
        const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const zeroCap = query.device_id === 'STM32-OEE-05';
        const avail = zeroCap ? 100 : Number((90.5 - i * 0.9).toFixed(2));
        const perf = zeroCap ? null : Number((92.4 - i * 0.7).toFixed(2));
        const totalCount = zeroCap ? 0 : 24200 - i * 1150;
        const rejectCount = zeroCap ? 0 : 480 - i * 20;
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: monthKey,
            groupBy: 'month',
            machineId: query.machine_id ?? null,
            machine_id: query.machine_id ?? null,
            machine_name: query.machine_id
              ? store.machines.find((m) => m.machine_id === query.machine_id)?.name ?? query.machine_id
              : 'Plant Monthly Rollup',
            device_id: query.device_id ?? null,
            bucket: monthKey,
            totalCount,
            goodCount,
            rejectCount,
            operatingSec: 1_555_200,
            runSec: Math.round((1_555_200 * avail) / 100),
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: 41200 - i * 1800,
            provisional: i === 0,
          })
        );
      }
    }

    return paginateWithCursor(
      rows,
      (item) => (item.bucket && /^\d{4}-\d{2}/.test(item.bucket) ? `${item.bucket}T00:00:00Z` : new Date(toMs).toISOString()),
      {
        cursor: query.cursor,
        limit: query.limit ?? 50,
        maxLimit: 100,
        getId: (item) => item.groupKey,
      }
    );
  },

  async getRejectParetoGlobal(signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbort(signal);
    store.recordEndpoint('QUALITY_REJECTS_GLOBAL', ADMIN_ENDPOINTS.QUALITY_REJECTS_GLOBAL.buildPath());
    const map = new Map<string, number>();
    Object.values(REJECT_PARETO_BY_DEVICE)
      .flat()
      .forEach((item) => {
        map.set(item.reason, (map.get(item.reason) ?? 0) + item.count);
      });
    const total = Array.from(map.values()).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    let cumulative = 0;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => {
        const percentage = Number(((count / total) * 100).toFixed(1));
        cumulative = Math.min(100, Number((cumulative + percentage).toFixed(1)));
        return { reason, count, percentage, cumulative_percentage: cumulative };
      });
  },

  async getRejectPareto(deviceId: string, signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbort(signal);
    if (!deviceId) {
      return this.getRejectParetoGlobal(signal);
    }
    store.recordEndpoint('QUALITY_REJECTS_BY_DEVICE', ADMIN_ENDPOINTS.QUALITY_REJECTS_BY_DEVICE.buildPath(deviceId));
    return [...(REJECT_PARETO_BY_DEVICE[deviceId] ?? [])];
  },

  async getTelemetryHistory(deviceId: string, signal?: AbortSignal): Promise<TelemetryHistoryRecord[]> {
    checkAbort(signal);
    const devId = deviceId || 'STM32-OEE-01';
    store.recordEndpoint('TELEMETRY_HISTORY', ADMIN_ENDPOINTS.TELEMETRY_HISTORY.buildPath(devId));
    return generateTelemetrySeries(devId, 20);
  },

  async getTelemetryHistoryPage(
    query: TelemetryHistoryQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryHistoryRecord>> {
    checkAbort(signal);
    const endpoint = buildTelemetryHistoryEndpoint(query);
    store.recordEndpoint('TELEMETRY_HISTORY', endpoint);

    let items = generateTelemetrySeries(query.device_id || 'STM32-OEE-01', 60);
    if (query.is_buffered !== undefined) {
      items = items.filter((r) => Boolean(r.is_buffered) === query.is_buffered);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) items = items.filter((r) => new Date(r.timestamp).getTime() >= fromMs);
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) items = items.filter((r) => new Date(r.timestamp).getTime() <= toMs);
    }

    return paginateWithCursor(items, (r) => r.timestamp, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 200,
    });
  },

  async exportTelemetryData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildTelemetryExportEndpoint(query);
    assertCapability('export.telemetry', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit('TELEMETRY_EXPORT');
    store.recordEndpoint('TELEMETRY_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);

    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = generateTelemetrySeries(query.device_id || 'STM32-OEE-01', 60)
      .filter((r) => {
        const ts = new Date(r.timestamp).getTime();
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const rows = formatTelemetryExportRows(filtered);
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'timescaledb:oee_telemetry_logs',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': query.device_id,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `telemetry_${query.device_id}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  },

  async exportTelemetryHourlyData(query: TelemetryExportQuery, signal?: AbortSignal): Promise<ExportResult> {
    checkAbort(signal);
    const endpoint = buildTelemetryHourlyExportEndpoint(query);
    assertCapability('export.telemetry', ['ADMIN', 'SUPERVISOR'], {
      requireLan: false,
      resourceId: query.device_id,
    });
    store.assertExportRateLimit('TELEMETRY_HOURLY_EXPORT');
    store.recordEndpoint('TELEMETRY_HOURLY_EXPORT', endpoint);

    assertRetentionWindow(query.from, query.to, new Date(), RETENTION_POLICY_DAYS);
    const hourly = await this.getHourlyTrend(query.device_id, signal);
    const rows = hourly.map((h) => ({ ...h }));
    const { content, mimeType, extension } = serializeExportRecords(rows, query.format);
    const generatedAt = new Date().toISOString();
    const metadata = parseExportMetadataHeaders({
      'X-Export-Source': 'timescaledb:telemetry_hourly_cagg',
      'X-Export-Generated-At': generatedAt,
      'X-Export-Device-Id': query.device_id,
      'X-Export-Time-Window': `${query.from}..${query.to}`,
    });

    return {
      filename: `telemetry_hourly_${query.device_id}_${generatedAt.slice(0, 10)}.${extension}`,
      mimeType,
      format: query.format,
      content,
      rowCount: rows.length,
      metadata,
      endpoint,
    };
  },

  async getReconciliationJobs(signal?: AbortSignal): Promise<ReconciliationJob[]> {
    checkAbort(signal);
    store.recordEndpoint('RECONCILIATION_JOBS', ADMIN_ENDPOINTS.RECONCILIATION_JOBS.buildPath());
    return [
      {
        job_id: 'job-cagg-hourly',
        name: 'Ringkasan OEE Shift Per Jam',
        view_name: 'telemetry_hourly_cagg',
        schedule_interval: 'Every 15 minutes',
        last_run: '2026-11-11T08:30:00Z',
        last_status: 'SUCCESS',
        refresh_window_hours: 24,
        records_processed: 1420,
      },
      {
        job_id: 'job-cagg-daily',
        name: 'Ringkasan Produksi Harian Pabrik',
        view_name: 'production_daily_summary',
        schedule_interval: 'Every 1 hour',
        last_run: '2026-11-11T08:00:00Z',
        last_status: 'SUCCESS',
        refresh_window_hours: 168,
        records_processed: 8940,
      },
    ];
  },

  async triggerReconciliationRefresh(
    request: ReconciliationRefreshRequest = {}
  ): Promise<{ success: boolean; message: string }> {
    assertCapability('telemetry.reconciliation.refresh', ['ADMIN', 'SUPERVISOR']);
    const fromVal = request.from ?? request.startWindow;
    const toVal = request.to ?? request.endWindow;
    if (fromVal && toVal) {
      const fromMs = Date.parse(fromVal);
      const toMs = Date.parse(toVal);
      if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
        throwValidationIssues('Rentang rekonsiliasi from/to tidak valid.', {
          from: 'Pastikan format ISO 8601 valid dan from <= to.',
        });
      }
    }

    const now = Date.now();
    store.reconciliationCallTimestamps = store.reconciliationCallTimestamps.filter((t) => now - t < 60_000);
    if (store.reconciliationCallTimestamps.length >= 10) {
      throw new ApiError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Batas pembaruan tercapai (maksimal 10 kali per menit). Silakan tunggu sebentar sebelum mencoba lagi.',
        httpStatus: 429,
      });
    }
    store.reconciliationCallTimestamps.push(now);

    store.recordEndpoint('RECONCILIATION_REFRESH', ADMIN_ENDPOINTS.RECONCILIATION_REFRESH.buildPath());
    const rangeDesc = `${fromVal ?? '24 jam terakhir'} .. ${toVal ?? 'sekarang'}`;
    store.addAudit(
      'RECONCILIATION_REFRESH',
      'SYSTEM',
      'telemetry_hourly_cagg',
      `Memperbarui ringkasan data per jam (${rangeDesc})`
    );
    return {
      success: true,
      message: `Pembaruan ringkasan data selesai untuk rentang ${rangeDesc}.`,
    };
  },

  // =========================================================================
  // MQTT OVERVIEW + DYNAMIC SECURITY (1 + 23 = 24 ops)
  // =========================================================================
  async getBrokerOverview(signal?: AbortSignal): Promise<BrokerOverviewInfo> {
    checkAbort(signal);
    assertCapability('mqtt.overview.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_OVERVIEW', ADMIN_ENDPOINTS.MQTT_OVERVIEW.buildPath());
    const activeVer = store.configVersions.find((v) => v.status === 'ACTIVE');
    return {
      dynamicSecurity: {
        enabled: true,
        status: 'CONNECTED',
        clientsCount: store.mqttClients.length,
        rolesCount: store.mqttRoles.length,
        groupsCount: store.mqttGroups.length,
      },
      configuration: {
        status: 'IN_SYNC',
        activeVersionId: activeVer?.version_id ?? null,
        lastAppliedAt: activeVer?.applied_at ?? null,
        mutationLocked: false,
      },
    };
  },

  async getMqttDynamicSecurityStatus(signal?: AbortSignal) {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_STATUS', ADMIN_ENDPOINTS.MQTT_DYNSEC_STATUS.buildPath());
    return {
      enabled: true,
      status: 'CONNECTED' as const,
      clients_count: store.mqttClients.length,
      roles_count: store.mqttRoles.length,
      groups_count: store.mqttGroups.length,
    };
  },

  async getMqttClients(signal?: AbortSignal): Promise<MqttClient[]> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_LIST', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_LIST.buildPath());
    return store.mqttClients.map((c) => ({ ...c, roles: [...c.roles], groups: [...c.groups] }));
  },

  async getMqttClient(username: string, signal?: AbortSignal): Promise<MqttClient> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false, resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_GET', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_GET.buildPath(username));
    const client = store.mqttClients.find((c) => c.username === username);
    if (!client) {
      throw new ApiError({ code: 'NOT_FOUND', message: `MQTT Client "${username}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...client, roles: [...client.roles], groups: [...client.groups] };
  },

  async createMqttClient(payload: {
    username: string;
    password?: string;
    clientid?: string;
    textname?: string;
    textdescription?: string;
    roles?: string[];
    groups?: string[];
    deviceId?: string;
    access?: 'publish' | 'subscribe' | 'readwrite';
  }): Promise<{ client: MqttClient; generatedPassword?: string }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: payload.username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_CREATE', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_CREATE.buildPath());

    if (store.mqttClients.some((c) => c.username === payload.username.trim())) {
      throw new ApiError({
        code: 'CONFLICT',
        message: `MQTT Client "${payload.username}" sudah ada.`,
        httpStatus: 409,
      });
    }

    const derivedRoles =
      payload.roles && payload.roles.length > 0
        ? payload.roles
        : payload.deviceId
        ? [payload.access === 'subscribe' ? 'telemetry_listener' : 'edge_publisher']
        : [];

    if (derivedRoles.length === 0) {
      throwValidationIssues('Minimal satu role MQTT atau mode deviceId+access wajib dipilih (default-deny).', {
        roles: 'Minimal 1 role wajib dipilih.',
      });
    }

    const generatedPassword =
      payload.password && payload.password.trim().length > 0
        ? undefined
        : `dynsec_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

    const newClient: MqttClient = {
      username: payload.username.trim(),
      clientid: payload.clientid?.trim() || payload.deviceId?.trim() || undefined,
      textname: payload.textname?.trim() || (payload.deviceId ? `Edge ${payload.deviceId}` : undefined),
      textdescription: payload.textdescription?.trim() || undefined,
      enabled: true,
      roles: derivedRoles,
      groups: payload.groups ?? [],
      created_at: new Date().toISOString(),
    };
    store.mqttClients.push(newClient);
    store.addAudit('MQTT_CLIENT_CREATED', 'MQTT_SECURITY', newClient.username, `Created dynsec client ${newClient.username}`);
    return { client: { ...newClient }, generatedPassword };
  },

  async deleteMqttClient(username: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_DELETE.buildPath(username));
    store.mqttClients = store.mqttClients.filter((c) => c.username !== username);
    store.mqttGroups.forEach((g) => {
      g.clients = g.clients.filter((cl) => cl !== username);
    });
    store.addAudit('MQTT_CLIENT_DELETED', 'MQTT_SECURITY', username, `Deleted MQTT client ${username}`);
    return { success: true };
  },

  async toggleMqttClient(username: string, enabled: boolean): Promise<MqttClient> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_ENABLE', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_ENABLE.buildPath(username));
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (!c) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Client tidak ditemukan.', httpStatus: 404 });
    }
    c.enabled = enabled;
    store.addAudit('MQTT_CLIENT_TOGGLED', 'MQTT_SECURITY', username, `Set enabled status to ${enabled}`);
    return { ...c };
  },

  async rotateMqttClientPassword(username: string, password: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENTS_PASSWORD', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENTS_PASSWORD.buildPath(username));
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (!c) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Client tidak ditemukan.', httpStatus: 404 });
    }
    if (!password || password.length < 8) {
      throwValidationIssues('Password MQTT baru minimal 8 karakter.', { password: 'Minimal 8 karakter.' });
    }
    store.addAudit('MQTT_CLIENT_PASSWORD', 'MQTT_SECURITY', username, `Rotated MQTT password for ${username}`);
    return { success: true };
  },

  async addMqttClientRole(username: string, rolename: string, priority = 1): Promise<MqttClient> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint('MQTT_DYNSEC_CLIENT_ROLES_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_ADD.buildPath(username));
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (!c) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Client tidak ditemukan.', httpStatus: 404 });
    if (!c.roles.includes(rolename)) c.roles.push(rolename);
    store.addAudit('MQTT_CLIENT_ROLE_ADDED', 'MQTT_SECURITY', username, `Added role ${rolename} (priority ${priority})`);
    return { ...c };
  },

  async removeMqttClientRole(username: string, rolename: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: username });
    store.recordEndpoint(
      'MQTT_DYNSEC_CLIENT_ROLES_DELETE',
      ADMIN_ENDPOINTS.MQTT_DYNSEC_CLIENT_ROLES_DELETE.buildPath(username, rolename)
    );
    const c = store.mqttClients.find((cl) => cl.username === username);
    if (c) c.roles = c.roles.filter((r) => r !== rolename);
    store.addAudit('MQTT_CLIENT_ROLE_REMOVED', 'MQTT_SECURITY', username, `Removed role ${rolename}`);
  },

  async getMqttRoles(signal?: AbortSignal): Promise<MqttRole[]> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_LIST', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_LIST.buildPath());
    return store.mqttRoles.map((r) => ({ ...r, acls: r.acls.map((a) => ({ ...a })) }));
  },

  async getMqttRole(rolename: string, signal?: AbortSignal): Promise<MqttRole> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false, resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_GET', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_GET.buildPath(rolename));
    const role = store.mqttRoles.find((r) => r.rolename === rolename);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Role tidak ditemukan.', httpStatus: 404 });
    return { ...role, acls: role.acls.map((a) => ({ ...a })) };
  },

  async createMqttRole(role: MqttRole): Promise<MqttRole> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: role.rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_CREATE', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_CREATE.buildPath());
    if (store.mqttRoles.some((r) => r.rolename === role.rolename.trim())) {
      throw new ApiError({ code: 'CONFLICT', message: `MQTT role "${role.rolename}" sudah ada.`, httpStatus: 409 });
    }
    const created: MqttRole = {
      rolename: role.rolename.trim(),
      textname: role.textname?.trim(),
      textdescription: role.textdescription?.trim(),
      acls: role.acls ?? [],
    };
    store.mqttRoles.push(created);
    store.addAudit('MQTT_ROLE_CREATED', 'MQTT_SECURITY', created.rolename, `Created MQTT role ${created.rolename}`);
    return { ...created };
  },

  async deleteMqttRole(rolename: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLES_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLES_DELETE.buildPath(rolename));
    store.mqttRoles = store.mqttRoles.filter((r) => r.rolename !== rolename);
    store.mqttClients.forEach((c) => {
      c.roles = c.roles.filter((r) => r !== rolename);
    });
    store.mqttGroups.forEach((g) => {
      g.roles = g.roles.filter((r) => r !== rolename);
    });
    store.addAudit('MQTT_ROLE_DELETED', 'MQTT_SECURITY', rolename, `Deleted MQTT role ${rolename}`);
    return { success: true };
  },

  async addMqttRoleAcl(rolename: string, acl: MqttAcl): Promise<MqttRole> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLE_ACLS_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_ADD.buildPath(rolename));
    const role = store.mqttRoles.find((r) => r.rolename === rolename);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Role tidak ditemukan.', httpStatus: 404 });
    role.acls.push({ ...acl });
    store.addAudit('MQTT_ROLE_ACL_ADDED', 'MQTT_SECURITY', rolename, `Added ACL ${acl.acltype} ${acl.topic}`);
    return { ...role, acls: [...role.acls] };
  },

  async removeMqttRoleAcl(rolename: string, acltype: MqttAcl['acltype'], topic: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: rolename });
    store.recordEndpoint('MQTT_DYNSEC_ROLE_ACLS_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_ROLE_ACLS_DELETE.buildPath(rolename));
    const role = store.mqttRoles.find((r) => r.rolename === rolename);
    if (role) {
      role.acls = role.acls.filter((a) => !(a.acltype === acltype && a.topic === topic));
    }
    store.addAudit('MQTT_ROLE_ACL_REMOVED', 'MQTT_SECURITY', rolename, `Removed ACL ${acltype} ${topic}`);
  },

  async getMqttGroups(signal?: AbortSignal): Promise<MqttGroup[]> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_LIST', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_LIST.buildPath());
    return store.mqttGroups.map((g) => ({ ...g, clients: [...g.clients], roles: [...g.roles] }));
  },

  async getMqttGroup(groupname: string, signal?: AbortSignal): Promise<MqttGroup> {
    checkAbort(signal);
    assertCapability('mqtt.dynsec.read', ['ADMIN'], { requireLan: false, resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_GET', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_GET.buildPath(groupname));
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (!grp) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Group tidak ditemukan.', httpStatus: 404 });
    return { ...grp, clients: [...grp.clients], roles: [...grp.roles] };
  },

  async createMqttGroup(group: MqttGroup): Promise<MqttGroup> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: group.groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_CREATE', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_CREATE.buildPath());
    if (store.mqttGroups.some((g) => g.groupname === group.groupname.trim())) {
      throw new ApiError({ code: 'CONFLICT', message: `MQTT group "${group.groupname}" sudah ada.`, httpStatus: 409 });
    }
    const created: MqttGroup = {
      groupname: group.groupname.trim(),
      textname: group.textname?.trim(),
      textdescription: group.textdescription?.trim(),
      clients: group.clients ?? [],
      roles: group.roles ?? [],
    };
    store.mqttGroups.push(created);
    store.addAudit('MQTT_GROUP_CREATED', 'MQTT_SECURITY', created.groupname, `Created MQTT group ${created.groupname}`);
    return { ...created };
  },

  async deleteMqttGroup(groupname: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUPS_DELETE', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUPS_DELETE.buildPath(groupname));
    store.mqttGroups = store.mqttGroups.filter((g) => g.groupname !== groupname);
    store.mqttClients.forEach((c) => {
      c.groups = c.groups.filter((gr) => gr !== groupname);
    });
    store.addAudit('MQTT_GROUP_DELETED', 'MQTT_SECURITY', groupname, `Deleted MQTT group ${groupname}`);
    return { success: true };
  },

  async addMqttGroupClient(groupname: string, username: string): Promise<MqttGroup> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUP_CLIENTS_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_ADD.buildPath(groupname));
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (!grp) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Group tidak ditemukan.', httpStatus: 404 });
    if (!grp.clients.includes(username)) grp.clients.push(username);
    const cl = store.mqttClients.find((c) => c.username === username);
    if (cl && !cl.groups.includes(groupname)) cl.groups.push(groupname);
    store.addAudit('MQTT_GROUP_CLIENT_ADDED', 'MQTT_SECURITY', groupname, `Added ${username} to group ${groupname}`);
    return { ...grp };
  },

  async removeMqttGroupClient(groupname: string, username: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint(
      'MQTT_DYNSEC_GROUP_CLIENTS_DELETE',
      ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_CLIENTS_DELETE.buildPath(groupname, username)
    );
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (grp) grp.clients = grp.clients.filter((c) => c !== username);
    const cl = store.mqttClients.find((c) => c.username === username);
    if (cl) cl.groups = cl.groups.filter((g) => g !== groupname);
    store.addAudit('MQTT_GROUP_CLIENT_REMOVED', 'MQTT_SECURITY', groupname, `Removed ${username} from group ${groupname}`);
  },

  async addMqttGroupRole(groupname: string, rolename: string): Promise<MqttGroup> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint('MQTT_DYNSEC_GROUP_ROLES_ADD', ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_ADD.buildPath(groupname));
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (!grp) throw new ApiError({ code: 'NOT_FOUND', message: 'MQTT Group tidak ditemukan.', httpStatus: 404 });
    if (!grp.roles.includes(rolename)) grp.roles.push(rolename);
    store.addAudit('MQTT_GROUP_ROLE_ADDED', 'MQTT_SECURITY', groupname, `Added role ${rolename} to group ${groupname}`);
    return { ...grp };
  },

  async removeMqttGroupRole(groupname: string, rolename: string): Promise<void> {
    assertCapability('mqtt.dynsec.manage', ['ADMIN'], { resourceId: groupname });
    store.recordEndpoint(
      'MQTT_DYNSEC_GROUP_ROLES_DELETE',
      ADMIN_ENDPOINTS.MQTT_DYNSEC_GROUP_ROLES_DELETE.buildPath(groupname, rolename)
    );
    const grp = store.mqttGroups.find((g) => g.groupname === groupname);
    if (grp) grp.roles = grp.roles.filter((r) => r !== rolename);
    store.addAudit('MQTT_GROUP_ROLE_REMOVED', 'MQTT_SECURITY', groupname, `Removed role ${rolename} from group ${groupname}`);
  },

  // =========================================================================
  // MQTT BROKER CONFIGURATION MANAGER (13 Canonical Operations)
  // =========================================================================
  async getBrokerConfig(signal?: AbortSignal): Promise<BrokerConfigSchema> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_GET', ADMIN_ENDPOINTS.MQTT_CONFIG_GET.buildPath());
    return JSON.parse(JSON.stringify(store.brokerConfig));
  },

  async getBrokerConfigRaw(signal?: AbortSignal): Promise<string> {
    checkAbort(signal);
    assertCapability('mqtt.config.read_raw', ['ADMIN'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_RAW', ADMIN_ENDPOINTS.MQTT_CONFIG_RAW.buildPath());
    const c = store.brokerConfig;
    const listenerLines = c.listeners
      .map(
        (l) =>
          `listener ${l.port} ${l.bind_address}\nprotocol ${l.protocol}\nmax_connections ${l.max_connections}`
      )
      .join('\n\n');
    return [
      `# Mosquitto Broker Configuration (${c.version})`,
      `per_listener_settings ${c.general.per_listener_settings}`,
      `allow_anonymous ${c.general.allow_anonymous}`,
      `persistence ${c.general.persistence}`,
      `persistence_location ${c.general.persistence_location}`,
      `autosave_interval ${c.general.autosave_interval_seconds}`,
      `max_packet_size ${c.limits.max_packet_size_bytes}`,
      `max_queued_messages ${c.limits.max_queued_messages}`,
      '',
      listenerLines,
    ].join('\n');
  },

  async getBrokerConfigStatus(signal?: AbortSignal): Promise<{
    active_version: string;
    sync_state: 'IN_SYNC' | 'DRIFT' | 'APPLYING' | 'FAILED';
    last_applied_at: string;
    mutation_locked: boolean;
  }> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_STATUS', ADMIN_ENDPOINTS.MQTT_CONFIG_STATUS.buildPath());
    const activeVer = store.configVersions.find((v) => v.status === 'ACTIVE');
    return {
      active_version: activeVer?.version_id ?? store.brokerConfig.version,
      sync_state: 'IN_SYNC',
      last_applied_at: activeVer?.applied_at ?? '2026-11-08T14:20:00Z',
      mutation_locked: false,
    };
  },

  async getBrokerConfigVersions(limit = 100, signal?: AbortSignal): Promise<BrokerConfigVersion[]> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_LIST', `${ADMIN_ENDPOINTS.MQTT_CONFIG_LIST.buildPath()}?limit=${limit}`);
    return store.configVersions.slice(0, Math.min(500, limit)).map((v) => JSON.parse(JSON.stringify(v)));
  },

  async getBrokerConfigVersion(versionId: string, signal?: AbortSignal): Promise<BrokerConfigVersion> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false, resourceId: versionId });
    store.recordEndpoint('MQTT_CONFIG_VERSION_GET', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_GET.buildPath(versionId));
    const v = store.configVersions.find((ver) => ver.version_id === versionId);
    if (!v) throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });
    return JSON.parse(JSON.stringify(v));
  },

  async getBrokerConfigDiff(
    versionId: string,
    signal?: AbortSignal
  ): Promise<{ version_id: string; diff_summary: string; changed_keys: string[] }> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false, resourceId: versionId });
    store.recordEndpoint('MQTT_CONFIG_VERSION_DIFF', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DIFF.buildPath(versionId));
    const v = store.configVersions.find((ver) => ver.version_id === versionId);
    if (!v) throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });

    const changedKeys: string[] = [];
    if (v.config.general.autosave_interval_seconds !== store.brokerConfig.general.autosave_interval_seconds) {
      changedKeys.push('general.autosave_interval_seconds');
    }
    if (v.config.limits.max_connections !== store.brokerConfig.limits.max_connections) {
      changedKeys.push('limits.max_connections');
    }
    if (v.config.limits.max_queued_messages !== store.brokerConfig.limits.max_queued_messages) {
      changedKeys.push('limits.max_queued_messages');
    }
    if (JSON.stringify(v.config.listeners) !== JSON.stringify(store.brokerConfig.listeners)) {
      changedKeys.push('listeners');
    }
    if (changedKeys.length === 0) changedKeys.push('metadata.summary');

    return {
      version_id: versionId,
      diff_summary: v.summary,
      changed_keys: changedKeys,
    };
  },

  async stageBrokerConfig(newConfig: BrokerConfigSchema, summary: string): Promise<BrokerConfigVersion> {
    assertCapability('mqtt.config.manage', ['ADMIN']);
    store.recordEndpoint('MQTT_CONFIG_STAGE', ADMIN_ENDPOINTS.MQTT_CONFIG_STAGE.buildPath());

    const issues: Array<{ field: string; message: string }> = [];
    if (newConfig.limits.max_connections < 10 || newConfig.limits.max_connections > 50000) {
      issues.push({ field: 'limits.max_connections', message: 'Max connections wajib antara 10–50.000.' });
    }
    if (newConfig.general.autosave_interval_seconds < 60) {
      issues.push({ field: 'general.autosave_interval_seconds', message: 'Autosave interval minimal 60 detik.' });
    }
    if (newConfig.listeners.length === 0) {
      issues.push({ field: 'listeners', message: 'Minimal 1 listener MQTT wajib aktif.' });
    }
    if (issues.length > 0) {
      throw new ApiError({
        code: 'CONFIG_VALIDATION_FAILED',
        message: 'Validasi pengaturan koneksi gagal sebelum disimpan sebagai draf.',
        httpStatus: 422,
        issues,
      });
    }

    const activeVer = store.configVersions.find((v) => v.status === 'ACTIVE');
    const versionId = `cfg-staged-${Date.now().toString().slice(-5)}`;
    const staged: BrokerConfigVersion = {
      version_id: versionId,
      parent_version_id: activeVer?.version_id ?? null,
      applied_at: new Date().toISOString(),
      applied_by: store.currentUserName,
      summary: summary.trim() || 'Staged configuration draft via Admin Console',
      operation_type: 'RELOAD',
      status: 'STAGED',
      config: JSON.parse(JSON.stringify(newConfig)),
    };
    store.configVersions.unshift(staged);
    store.brokerOperations.unshift({
      operation_id: `op-cfg-${Date.now().toString().slice(-5)}`,
      type: 'STAGE',
      version_id: versionId,
      status: 'SUCCEEDED',
      reason: staged.summary,
      steps: [{ step: 'STAGE_DRAFT', status: 'SUCCEEDED', message: 'Konfigurasi kandidat tersimpan' }],
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    return JSON.parse(JSON.stringify(staged));
  },

  async deleteBrokerConfigVersion(versionId: string): Promise<{ success: boolean }> {
    assertCapability('mqtt.config.manage', ['ADMIN'], { resourceId: versionId });
    store.recordEndpoint('MQTT_CONFIG_VERSION_DELETE', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_DELETE.buildPath(versionId));
    const target = store.configVersions.find((v) => v.version_id === versionId);
    if (!target) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });
    }
    if (target.status !== 'STAGED') {
      throw new ApiError({
        code: 'CONFLICT',
        message: 'Hanya versi berstatus STAGED yang dapat dibuang (discard).',
        httpStatus: 409,
      });
    }
    store.configVersions = store.configVersions.filter((v) => v.version_id !== versionId);
    return { success: true };
  },

  async applyBrokerConfigVersion(
    versionId: string,
    options: { confirm: boolean; reason?: string }
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertCapability('mqtt.config.manage', ['ADMIN'], { resourceId: versionId });
    if (!options?.confirm) {
      throwValidationIssues('Konfirmasi eksplisit confirm=true wajib disertakan untuk apply konfigurasi broker.', {
        confirm: 'Wajib true.',
      });
    }
    if (options.reason && options.reason.length > 500) {
      throwValidationIssues('Alasan apply maksimal 500 karakter.', { reason: 'Maksimal 500 karakter.' });
    }

    store.recordEndpoint('MQTT_CONFIG_VERSION_APPLY', ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_APPLY.buildPath(versionId));
    const target = store.configVersions.find((v) => v.version_id === versionId);
    if (!target) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi tidak ditemukan.', httpStatus: 404 });
    }

    store.configVersions.forEach((v) => {
      if (v.status === 'ACTIVE') v.status = 'APPLIED';
    });
    target.status = 'ACTIVE';
    target.applied_at = new Date().toISOString();
    target.applied_by = store.currentUserName;
    store.brokerConfig = JSON.parse(JSON.stringify(target.config));

    const operation: BrokerOperation = {
      operation_id: `op-apply-${Date.now().toString().slice(-5)}`,
      type: 'APPLY',
      version_id: versionId,
      status: 'SUCCEEDED',
      reason: options.reason?.trim() || target.summary,
      steps: [
        { step: 'VALIDATE_SCHEMA', status: 'SUCCEEDED', message: 'Pemeriksaan format pengaturan berhasil' },
        { step: 'WRITE_BACKUP', status: 'SUCCEEDED', message: 'Cadangan otomatis tersimpan' },
        { step: 'RELOAD_BROKER', status: 'SUCCEEDED', message: 'Layanan koneksi dimuat ulang tanpa memutus sambungan' },
      ],
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    store.brokerOperations.unshift(operation);
    store.brokerBackups.unshift({
      backup_id: `bak-${Date.now().toString().slice(-4)}`,
      filename: `mosquitto-${new Date().toISOString().replace(/[:.]/g, '-')}.conf.bak`,
      version_id: versionId,
      created_at: new Date().toISOString(),
      size_bytes: 2910,
    });
    store.addAudit('BROKER_CONFIG_APPLIED', 'BROKER_CONFIG', versionId, operation.reason || target.summary);
    return {
      version: JSON.parse(JSON.stringify(target)),
      operation,
    };
  },

  async applyBrokerConfig(newConfig: BrokerConfigSchema, summary: string, reason?: string) {
    const staged = await this.stageBrokerConfig(newConfig, summary);
    return this.applyBrokerConfigVersion(staged.version_id, { confirm: true, reason: reason || summary });
  },

  async rollbackBrokerConfig(
    versionId: string,
    options: { confirm: boolean; reason?: string } = { confirm: true }
  ): Promise<{ version: BrokerConfigVersion; operation: BrokerOperation }> {
    assertCapability('mqtt.config.manage', ['ADMIN'], { resourceId: versionId });
    if (!options?.confirm) {
      throwValidationIssues('Konfirmasi eksplisit confirm=true wajib disertakan untuk rollback konfigurasi.', {
        confirm: 'Wajib true.',
      });
    }
    store.recordEndpoint(
      'MQTT_CONFIG_VERSION_ROLLBACK',
      ADMIN_ENDPOINTS.MQTT_CONFIG_VERSION_ROLLBACK.buildPath(versionId)
    );
    const targetVer = store.configVersions.find((v) => v.version_id === versionId);
    if (!targetVer) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Versi konfigurasi target tidak ditemukan.', httpStatus: 404 });
    }

    store.brokerConfig = JSON.parse(JSON.stringify(targetVer.config));
    store.configVersions.forEach((v) => {
      if (v.status === 'ACTIVE') v.status = 'ROLLED_BACK';
    });
    targetVer.status = 'ACTIVE';
    targetVer.applied_at = new Date().toISOString();

    const operation: BrokerOperation = {
      operation_id: `op-rb-${Date.now().toString().slice(-5)}`,
      type: 'ROLLBACK',
      version_id: versionId,
      status: 'SUCCEEDED',
      reason: options.reason?.trim() || `Rollback ke versi ${versionId}`,
      steps: [
        { step: 'RESTORE_SNAPSHOT', status: 'SUCCEEDED', message: `Snapshot ${versionId} dipulihkan` },
        { step: 'RELOAD_BROKER', status: 'SUCCEEDED', message: 'Layanan koneksi berhasil dimuat ulang' },
      ],
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    store.brokerOperations.unshift(operation);
    store.addAudit('BROKER_CONFIG_ROLLBACK', 'BROKER_CONFIG', versionId, `Rolled back to ${versionId}`);
    return {
      version: JSON.parse(JSON.stringify(targetVer)),
      operation,
    };
  },

  async getBrokerConfigOperations(limit = 50, signal?: AbortSignal): Promise<BrokerOperation[]> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_OPERATIONS', `${ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATIONS.buildPath()}?limit=${limit}`);
    return store.brokerOperations.slice(0, Math.min(500, limit)).map((o) => ({ ...o }));
  },

  async getBrokerConfigOperation(operationId: string, signal?: AbortSignal): Promise<BrokerOperation | null> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_OPERATION_GET', ADMIN_ENDPOINTS.MQTT_CONFIG_OPERATION_GET.buildPath(operationId));
    const op = store.brokerOperations.find((o) => o.operation_id === operationId);
    return op ? { ...op } : null;
  },

  async getBrokerConfigBackups(signal?: AbortSignal): Promise<BrokerBackup[]> {
    checkAbort(signal);
    assertCapability('mqtt.config.read', ['ADMIN', 'SUPERVISOR'], { requireLan: false });
    store.recordEndpoint('MQTT_CONFIG_BACKUPS', ADMIN_ENDPOINTS.MQTT_CONFIG_BACKUPS.buildPath());
    return store.brokerBackups.map((b) => ({ ...b }));
  },

  // =========================================================================
  // ACCESS CONTROL / IAM (18 Authoritative Operations — ADMIN + LAN ONLY)
  // =========================================================================
  async getIamInfo(signal?: AbortSignal): Promise<IamInfo> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_INFO', ADMIN_ENDPOINTS.IAM_INFO.buildPath());
    return { ...store.iamInfo };
  },

  async getIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_ROLES_LIST', ADMIN_ENDPOINTS.IAM_ROLES_LIST.buildPath());
    return store.iamRoles.map((r) =>
      IamRoleSchema.parse({
        ...r,
        policy_count: store.iamPolicies.filter((p) => p.role_id === r.id || p.role === r.name).length,
      })
    );
  },

  async createIamRole(data: { name: string; privilege_level: number; description: string }): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN']);
    const trimmedName = data.name.trim();
    const trimmedDesc = data.description.trim();
    const fieldErrors: Record<string, string> = {};

    if (!VALIDATION_PATTERNS.IAM_ROLE_NAME.test(trimmedName)) {
      fieldErrors.name = 'Nama role wajib diawali huruf, panjang 2–64 karakter (huruf, angka, "_", "-").';
    }
    if (!Number.isInteger(data.privilege_level) || data.privilege_level > CUSTOM_ROLE_MAX_LEVEL || data.privilege_level < 1) {
      fieldErrors.privilege_level = `Level custom role wajib bilangan bulat 1–${CUSTOM_ROLE_MAX_LEVEL}.`;
    }
    if (trimmedDesc.length < 3 || trimmedDesc.length > 256) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembuatan custom role gagal.', fieldErrors);
    }

    store.recordEndpoint('IAM_ROLES_CREATE', ADMIN_ENDPOINTS.IAM_ROLES_CREATE.buildPath());
    if (isSystemRoleName(trimmedName)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: `Nama "${trimmedName}" adalah role sistem yang dilindungi.`,
        httpStatus: 403,
      });
    }
    if (store.iamRoles.some((r) => r.name.toUpperCase() === trimmedName.toUpperCase())) {
      throw new ApiError({ code: 'CONFLICT', message: `Role "${trimmedName}" sudah ada.`, httpStatus: 409 });
    }

    const newRole: IamRole = IamRoleSchema.parse({
      id: `role-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      name: trimmedName,
      privilege_level: data.privilege_level,
      is_system: false,
      description: trimmedDesc,
      created_at: new Date().toISOString(),
    });
    store.iamRoles.push(newRole);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('CREATE_ROLE', 'IAM', newRole.id, `Created custom IAM role ${newRole.name} (level ${newRole.privilege_level})`);
    return { ...newRole, policy_count: 0 };
  },

  async updateIamRole(
    roleId: string,
    patch: { description?: string; privilege_level?: number }
  ): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_UPDATE', ADMIN_ENDPOINTS.IAM_ROLES_UPDATE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isSystemRoleName(role.name)) {
      throw new ApiError({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: `Role sistem (${role.name}) dilindungi dan tidak dapat diubah atau dihapus.`,
        httpStatus: 403,
      });
    }
    const fieldErrors: Record<string, string> = {};
    if (patch.privilege_level !== undefined && (!Number.isInteger(patch.privilege_level) || patch.privilege_level > CUSTOM_ROLE_MAX_LEVEL || patch.privilege_level < 1)) {
      fieldErrors.privilege_level = `Level custom role maksimal ${CUSTOM_ROLE_MAX_LEVEL} (1–29).`;
    }
    if (patch.description !== undefined && (patch.description.trim().length < 3 || patch.description.trim().length > 256)) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembaruan role gagal.', fieldErrors);
    }
    if (patch.description !== undefined) role.description = patch.description.trim();
    if (patch.privilege_level !== undefined) role.privilege_level = patch.privilege_level;
    store.addAudit('UPDATE_ROLE', 'IAM', roleId, `Updated IAM role ${role.name}`);
    return IamRoleSchema.parse({ ...role });
  },

  async deleteIamRole(roleId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_DELETE', ADMIN_ENDPOINTS.IAM_ROLES_DELETE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isSystemRoleName(role.name)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Role sistem (ADMIN, SUPERVISOR, OPERATOR, MAINTENANCE) dilindungi.',
        httpStatus: 403,
      });
    }
    const activeAssignments = store.iamAssignments.filter(
      (a) => a.role_id === roleId || a.role_name === role.name
    );
    if (activeAssignments.length > 0) {
      throw new ApiError({
        code: 'ROLE_IN_USE',
        message: `Role "${role.name}" masih digunakan oleh ${activeAssignments.length} penugasan operator. Cabut penugasan user terlebih dahulu sebelum menghapus role.`,
        httpStatus: 409,
      });
    }
    store.iamRoles = store.iamRoles.filter((r) => r.id !== roleId);
    // Clean up orphaned policy bindings for this unused custom role
    store.iamPolicies = store.iamPolicies.filter((p) => p.role_id !== roleId && p.role !== role.name);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_ROLE', 'IAM', roleId, `Deleted custom IAM role ${role.name}`);
    return { success: true };
  },

  async addIamRolePermission(
    roleId: string,
    permissionId: string,
    options?: {
      resourcePattern?: string;
      effect?: 'ALLOW' | 'DENY';
      abacCondition?: Record<string, unknown> | null;
      reason?: string;
    }
  ): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLE_PERMISSIONS_ADD', ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_ADD.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    const perm = store.iamPermissions.find((p) => p.id === permissionId);
    if (!role || !perm) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Role atau permission tidak ditemukan.', httpStatus: 404 });
    }
    const effect = options?.effect ?? 'ALLOW';
    if (role.name === 'ADMIN' && effect === 'DENY') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Policy DENY pada role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    if (!role.is_system && isReservedPermission(perm.action, perm.resource_type)) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${perm.action}:${perm.resource_type}" adalah reserved permission yang tidak boleh di-assign ke custom role.`,
        httpStatus: 403,
      });
    }
    const resourcePattern = options?.resourcePattern?.trim() || `${perm.resource_type}:*`;
    if (resourcePattern.length < 1 || resourcePattern.length > 128) {
      throwValidationIssues('Resource pattern wajib 1–128 karakter.', {
        resourcePattern: 'Panjang 1–128 karakter.',
      });
    }
    if (!role.is_system && effect === 'ALLOW' && (resourcePattern === '*' || resourcePattern === 'org:*')) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: 'Custom role tidak boleh diberikan wildcard resource pattern (*).',
        httpStatus: 403,
      });
    }
    const duplicate = store.iamPolicies.some(
      (p) =>
        (p.role_id === role.id || p.role === role.name) &&
        p.permission_id === perm.id &&
        p.resource_pattern === resourcePattern &&
        p.eft === effect
    );
    if (duplicate) {
      throw new ApiError({
        code: 'DUPLICATE_ROLE_PERMISSION',
        message: `Permission "${perm.action}:${perm.resource_type}" (${effect} · ${resourcePattern}) sudah terpasang pada role "${role.name}".`,
        httpStatus: 409,
      });
    }
    store.iamPolicies.push({
      id: `pol-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      role: role.name,
      role_id: role.id,
      permission_id: perm.id,
      action: perm.action,
      resource_pattern: resourcePattern,
      eft: effect,
      abac_condition: options?.abacCondition ?? null,
      is_active: true,
      reason: options?.reason?.trim() || `Role permission binding ${perm.action}:${perm.resource_type}`,
    });
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'ADD_ROLE_PERMISSION',
      'IAM',
      roleId,
      `Assigned ${effect} ${perm.action}:${perm.resource_type} (${resourcePattern}) to ${role.name}`
    );
    return { success: true };
  },

  async removeIamRolePermission(roleId: string, permissionId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint(
      'IAM_ROLE_PERMISSIONS_DELETE',
      ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_DELETE.buildPath(roleId, permissionId)
    );
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    }
    if (role.name === 'ADMIN') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Menghapus permission dari role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    const existingCount = store.iamPolicies.filter(
      (p) => p.role_id === roleId && p.permission_id === permissionId
    ).length;
    if (existingCount === 0) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: 'Ikatan permission pada role tersebut tidak ditemukan.',
        httpStatus: 404,
      });
    }
    store.iamPolicies = store.iamPolicies.filter(
      (p) => !(p.role_id === roleId && p.permission_id === permissionId)
    );
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'REMOVE_ROLE_PERMISSION',
      'IAM',
      roleId,
      `Revoked permission ${permissionId} from role ${role.name}`
    );
    return { success: true };
  },

  async getIamPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_PERMISSIONS_LIST', ADMIN_ENDPOINTS.IAM_PERMISSIONS_LIST.buildPath());
    return store.iamPermissions.map((p) => IamPermissionSchema.parse({ ...p }));
  },

  async createIamPermission(_data: Omit<IamPermission, 'id'>): Promise<IamPermission> {
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_PERMISSIONS_CREATE', ADMIN_ENDPOINTS.IAM_PERMISSIONS_CREATE.buildPath());
    throw new ApiError({
      code: 'PERMISSION_CATALOG_READ_ONLY',
      message: 'Permission Catalog bersifat master data tetap (read-only) dan tidak boleh dibuat, diubah, atau dihapus.',
      httpStatus: 403,
    });
  },

  async getIamUserRoles(signal?: AbortSignal): Promise<IamAssignment[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_USER_ROLES_LIST', ADMIN_ENDPOINTS.IAM_USER_ROLES_LIST.buildPath());
    return store.iamAssignments.map((a) => IamAssignmentSchema.parse({ ...a }));
  },

  async assignIamUserRole(data: {
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<IamAssignment> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: data.operatorId });
    store.recordEndpoint('IAM_USER_ROLES_CREATE', ADMIN_ENDPOINTS.IAM_USER_ROLES_CREATE.buildPath());
    const op = store.operators.find((o) => o.operator_id === data.operatorId);
    const role = store.iamRoles.find((r) => r.name === data.roleName);
    if (!op || !role) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Operator atau Role tidak ditemukan.', httpStatus: 404 });
    }
    if (role.name === 'ADMIN' && store.currentUserRole !== 'ADMIN') {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: 'Hanya ADMIN yang dapat memberikan penugasan role ADMIN.',
        httpStatus: 403,
      });
    }
    if (data.scopeType !== 'ORGANIZATION' && !data.scopeId?.trim()) {
      throwValidationIssues('scopeId wajib diisi untuk scope selain ORGANIZATION.', {
        scopeId: 'Scope ID wajib diisi.',
      });
    }
    const normalizedScopeId = data.scopeType === 'ORGANIZATION' ? null : (data.scopeId?.trim() ?? null);
    if (normalizedScopeId && normalizedScopeId.length > 64) {
      throwValidationIssues('Scope ID maksimal 64 karakter.', { scopeId: 'Maksimal 64 karakter.' });
    }
    const duplicate = store.iamAssignments.some(
      (a) =>
        a.operator_id === op.operator_id &&
        a.role_name === role.name &&
        a.scope_type === data.scopeType &&
        (a.scope_id ?? null) === normalizedScopeId
    );
    if (duplicate) {
      throw new ApiError({
        code: 'DUPLICATE_USER_ROLE',
        message: `Operator ${op.operator_id} sudah memiliki penugasan role ${role.name} pada scope ${data.scopeType}${normalizedScopeId ? ` (${normalizedScopeId})` : ''}.`,
        httpStatus: 409,
      });
    }

    const newAsg: IamAssignment = IamAssignmentSchema.parse({
      id: `asg-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      operator_id: op.operator_id,
      operator_name: op.name,
      role_id: role.id,
      role_name: role.name,
      scope_type: data.scopeType,
      scope_id: normalizedScopeId,
      created_at: new Date().toISOString(),
    });
    store.iamAssignments.push(newAsg);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'ASSIGN_USER_ROLE',
      'IAM',
      newAsg.id,
      `Assigned ${newAsg.role_name} to ${newAsg.operator_id} (${newAsg.scope_type})`
    );
    return { ...newAsg };
  },

  async revokeIamUserRole(assignment: {
    id?: string;
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: assignment.operatorId });
    store.recordEndpoint('IAM_USER_ROLES_DELETE', ADMIN_ENDPOINTS.IAM_USER_ROLES_DELETE.buildPath());
    const targetOp = store.operators.find((o) => o.operator_id === assignment.operatorId);
    if ((targetOp?.is_protected || assignment.operatorId === 'ADM-001') && assignment.roleName === 'ADMIN') {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: 'Anti-Lockout Guard: Role ADMIN pada ADM-001 tidak dapat dicabut.',
        httpStatus: 403,
      });
    }
    const matchesTarget = (a: IamAssignment) => {
      if (assignment.id && a.id === assignment.id) return true;
      return (
        a.operator_id === assignment.operatorId &&
        a.role_name === assignment.roleName &&
        a.scope_type === assignment.scopeType &&
        (a.scope_id ?? null) === (assignment.scopeId ?? null)
      );
    };
    const found = store.iamAssignments.some(matchesTarget);
    if (!found) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: 'Penugasan role operator tidak ditemukan.',
        httpStatus: 404,
      });
    }
    store.iamAssignments = store.iamAssignments.filter((a) => !matchesTarget(a));
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'REVOKE_USER_ROLE',
      'IAM',
      assignment.operatorId,
      `Revoked ${assignment.roleName} from ${assignment.operatorId}`
    );
    return { success: true };
  },

  async getIamPolicies(signal?: AbortSignal): Promise<IamPolicyRule[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_POLICIES_LIST', ADMIN_ENDPOINTS.IAM_POLICIES_LIST.buildPath());
    return store.iamPolicies.map((p) => IamPolicyRuleSchema.parse({ ...p }));
  },

  async createIamPolicy(data: Omit<IamPolicyRule, 'id'>): Promise<IamPolicyRule> {
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_POLICIES_CREATE', ADMIN_ENDPOINTS.IAM_POLICIES_CREATE.buildPath());
    if (policyTargetsAdmin(data.role) && data.eft === 'DENY') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Policy DENY pada role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    const roleParts = data.role.split('|').map((r) => r.trim());
    const hasCustomOrWildcardRole = roleParts.some((r) => {
      if (r === '*') return true;
      const found = store.iamRoles.find((ir) => ir.name === r);
      return found ? !found.is_system : !isSystemRoleName(r);
    });
    const resType = data.resource_pattern.split(':')[0] || '*';
    if (
      hasCustomOrWildcardRole &&
      data.eft === 'ALLOW' &&
      (isReservedPermission(data.action, resType) || data.resource_pattern.trim() === '*' || data.resource_pattern.trim() === 'org:*')
    ) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${data.action}:${resType}" adalah reserved permission yang tidak boleh diberikan melalui policy untuk custom role.`,
        httpStatus: 403,
      });
    }
    const newPol: IamPolicyRule = IamPolicyRuleSchema.parse({
      ...data,
      id: `pol-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
    });
    store.iamPolicies.push(newPol);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('CREATE_POLICY', 'IAM', newPol.id, `Created ${newPol.eft} policy for ${newPol.role}: ${newPol.action}`);
    return { ...newPol };
  },

  async updateIamPolicy(
    policyId: string,
    patch: Partial<Pick<IamPolicyRule, 'eft' | 'action' | 'resource_pattern' | 'abac_condition' | 'is_active' | 'reason'>>
  ): Promise<IamPolicyRule> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: policyId });
    store.recordEndpoint('IAM_POLICIES_UPDATE', ADMIN_ENDPOINTS.IAM_POLICIES_UPDATE.buildPath(policyId));
    const pol = store.iamPolicies.find((p) => p.id === policyId);
    if (!pol) throw new ApiError({ code: 'NOT_FOUND', message: 'Policy tidak ditemukan.', httpStatus: 404 });
    if (policyTargetsAdmin(pol.role) && (patch.is_active === false || patch.eft === 'DENY')) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Menonaktifkan atau mengubah policy ADMIN menjadi DENY dilarang.',
        httpStatus: 403,
      });
    }
    const nextAction = patch.action ?? pol.action;
    const nextResource = patch.resource_pattern ?? pol.resource_pattern;
    const nextEft = patch.eft ?? pol.eft;
    const roleParts = pol.role.split('|').map((r) => r.trim());
    const hasCustomOrWildcardRole = roleParts.some((r) => {
      if (r === '*') return true;
      const found = store.iamRoles.find((ir) => ir.name === r);
      return found ? !found.is_system : !isSystemRoleName(r);
    });
    const resType = nextResource.split(':')[0] || '*';
    if (
      hasCustomOrWildcardRole &&
      nextEft === 'ALLOW' &&
      (isReservedPermission(nextAction, resType) || nextResource.trim() === '*' || nextResource.trim() === 'org:*')
    ) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${nextAction}:${resType}" adalah reserved permission untuk sistem dan dilarang pada custom role.`,
        httpStatus: 403,
      });
    }
    Object.assign(pol, patch);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('UPDATE_POLICY', 'IAM', policyId, `Updated policy ${policyId}`);
    return IamPolicyRuleSchema.parse({ ...pol });
  },

  async toggleIamPolicy(policyId: string, isActive: boolean): Promise<IamPolicyRule> {
    return this.updateIamPolicy(policyId, { is_active: isActive });
  },

  async deleteIamPolicy(policyId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: policyId });
    store.recordEndpoint('IAM_POLICIES_DELETE', ADMIN_ENDPOINTS.IAM_POLICIES_DELETE.buildPath(policyId));
    const pol = store.iamPolicies.find((p) => p.id === policyId);
    if (!pol) throw new ApiError({ code: 'NOT_FOUND', message: 'Policy tidak ditemukan.', httpStatus: 404 });
    if (policyTargetsAdmin(pol.role)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Menghapus policy ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    store.iamPolicies = store.iamPolicies.filter((p) => p.id !== policyId);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_POLICY', 'IAM', policyId, `Deleted policy ${policyId}`);
    return { success: true };
  },

  async getSubjectEffectivePermissions(
    operatorId: string,
    signal?: AbortSignal
  ): Promise<IamEffectivePermissions> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: operatorId });
    store.recordEndpoint(
      'IAM_SUBJECT_EFFECTIVE_PERMISSIONS',
      ADMIN_ENDPOINTS.IAM_SUBJECT_EFFECTIVE_PERMISSIONS.buildPath(operatorId)
    );
    const op = store.operators.find((o) => o.operator_id === operatorId);
    if (!op) {
      throw new ApiError({ code: 'OPERATOR_NOT_FOUND', message: 'Operator tidak ditemukan.', httpStatus: 404 });
    }
    const assignments = store.iamAssignments.filter((a) => a.operator_id === operatorId);
    const roleNames = Array.from(new Set([op.role, ...assignments.map((a) => a.role_name)]));
    const matchingPolicies = store.iamPolicies.filter((p) => p.is_active && policyMatchesRole(p.role, roleNames));

    return {
      operatorId: op.operator_id,
      primaryRole: op.role,
      effectiveRoles:
        assignments.length > 0
          ? assignments.map((a) => ({
              roleName: a.role_name,
              scopeType: a.scope_type,
              scopeId: a.scope_id,
            }))
          : [{ roleName: op.role, scopeType: 'ORGANIZATION', scopeId: null }],
      permissions: matchingPolicies.map((p) => ({
        action: p.action,
        resourceType: p.resource_pattern.split(':')[0] || '*',
        resourcePattern: p.resource_pattern,
        effect: p.eft,
        sourceRole: p.role,
        abacCondition:
          typeof p.abac_condition === 'string'
            ? (() => {
                try {
                  return JSON.parse(p.abac_condition);
                } catch {
                  return { raw: p.abac_condition };
                }
              })()
            : p.abac_condition ?? null,
      })),
    };
  },

  async getIamAuditDecisions(limit = 100, signal?: AbortSignal): Promise<IamAuditDecision[]> {
    checkAbort(signal);
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_AUDIT', `${ADMIN_ENDPOINTS.IAM_AUDIT.buildPath()}?limit=${limit}`);
    return store.iamAuditDecisions.slice(0, Math.min(1000, limit)).map((d) => ({ ...d }));
  },
};

/**
 * Selector transport (Build Guide §4.1): mode Demo memakai store in-memory di
 * atas; mode Real memakai HTTP client ke backend (`./httpClient`). Mode
 * berasal dari env (`VITE_API_MODE`, default demo) dan TERKUNCI di sana
 * kecuali `VITE_ALLOW_API_MODE_SWITCH=true` (dev lokal) mengizinkan
 * override via query `?api=` / localStorage — lihat `./mode`. Seluruh halaman
 * memanggil `apiClient` yang sama — pergantian mode tidak mengubah UI apa pun.
 */
export const apiClient = resolveApiMode() === 'real' ? httpApiClient : demoApiClient;
