/**
 * Store in-memory demo (MemoryStore + singleton store).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { AuthClientHooks } from './helpers';
import { INITIAL_MACHINES, INITIAL_DEVICES, INITIAL_DEVICE_HEALTH_OVERRIDES, INITIAL_PRODUCTS, INITIAL_OPERATORS, INITIAL_WORK_ORDERS, INITIAL_LIVE_STATES, INITIAL_DOWNTIME_EVENTS, INITIAL_OPERATIONAL_EVENTS, INITIAL_MQTT_CLIENTS, INITIAL_MQTT_ROLES, INITIAL_MQTT_GROUPS, INITIAL_BROKER_CONFIG, INITIAL_CONFIG_VERSIONS, INITIAL_BROKER_OPERATIONS, INITIAL_BROKER_BACKUPS, INITIAL_SYSTEM_HEALTH, INITIAL_AUDIT_LOGS, INITIAL_IAM_ROLES, INITIAL_IAM_PERMISSIONS, INITIAL_IAM_ASSIGNMENTS, INITIAL_IAM_POLICIES, INITIAL_IAM_AUDIT_DECISIONS, INITIAL_PRODUCTION_LINES, INITIAL_SHIFTS, INITIAL_SHIFT_SCHEDULES } from '../mockData';
import { AdminEndpointKey, FORBIDDEN_ENDPOINT_PATTERNS, isValidEndpointPrefix } from '../endpoints';
import { OperationalEvent } from '../../../types/monitoring';
import { BrokerConfigSchema, BrokerOperation, BrokerBackup } from '../../../types/mqtt';
import { AuditLogItem } from '../../../types/system';
import { IamInfo } from '../../../types/iam';
import { UserRole, NetworkAccessMode, ApiError } from '../../../types/auth';

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

export const store = new MemoryStore();
