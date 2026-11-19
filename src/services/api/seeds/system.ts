/**
 * Seed data demo — domain system.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { SystemHealth, AuditLogItem, HealthDetail } from '../../../types/system';
import { IamRole, IamPermission, IamAssignment, IamPolicyRule, IamAuditDecision } from '../../../types/iam';

export const INITIAL_SYSTEM_HEALTH: SystemHealth = {
  status: 'ok',
  uptime: 1845920.42,
  uptime_seconds: 1845920,
  timestamp: new Date().toISOString(),
  ws_clients: 3,
  db_connected: true,
  buffer_pending: 2,
  buffer_dropped: 0,
  // E20 P20.4 (FAT-156): seed demo meniru bentuk lean /health (API doc §A)
  // — nilai yang tidak dikirim backend = null/UNKNOWN, bukan fabrikasi.
  backend: { status: 'UNKNOWN', label: null, environment: null, latency_ms: null },
  database: { engine: 'PostgreSQL (TimescaleDB)', latency_ms: null },
  mqtt: { status: 'UNKNOWN', connected_clients: null, dynamic_security: null },
  websocket: { status: 'UNKNOWN' },
  metrics: {
    totalReceived: 14820,
    validIngested: 14806,
    invalidDiscarded: 14,
    lastIngestedAt: new Date(Date.now() - 3_000).toISOString(),
  },
};

/**
 * E20 P20.4 (FAT-156): seed demo `GET /health/detail` (API doc §A) —
 * per-komponen + measuredAt. Demo-only; bukan bukti backend sungguhan.
 */
export const INITIAL_HEALTH_DETAIL: HealthDetail = {
  measuredAt: new Date().toISOString(),
  application: {
    status: 'UP',
    name: 'iiot-oee-backend',
    version: '1.0.0',
    environment: 'production',
    commit: null,
    uptimeSeconds: 1845920.42,
    measuredAt: new Date().toISOString(),
  },
  database: {
    status: 'UP',
    latencyMs: 1.87,
    measuredAt: new Date().toISOString(),
  },
  mqtt: {
    status: 'UP',
    adminConnection: {
      connected: true,
      pluginReady: true,
      lastError: null,
      lastConnectedAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
    clientsCount: 4,
    measuredAt: new Date().toISOString(),
  },
  websocket: {
    status: 'UP',
    clients: 3,
    measuredAt: new Date().toISOString(),
  },
};

/**
 * E20 P20.4 (FAT-156): seed audit = `OperationalEventItem` FR-034-01
 * (API doc §I) — tanpa field karangan (`operator_id`, `action`,
 * `resource_type`, `client_ip`, `access_mode`).
 */
export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'aud-001',
    recorded_at: '2026-11-11T08:05:10Z',
    device_id: 'STM32-OEE-03',
    machine_id: 'CNC-PRESS-03',
    machine_name: 'Hydraulic Stamping Press Charlie',
    wo_id: null,
    event_type: 'MASTER_DATA_MUTATION',
    trigger_source: 'ADMIN_PANEL',
    event_code: null,
    snapshot_total_count: null,
    snapshot_run_sec: null,
    description: 'Classified incident dt-ev-01 as EQUIPMENT_FAILURE with reason: Hydraulic pressure drop',
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    ack_note: null,
    created_at: '2026-11-11T08:05:10Z',
  },
  {
    id: 'aud-002',
    recorded_at: '2026-11-11T07:05:00Z',
    device_id: 'STM32-OEE-04',
    machine_id: 'CNC-WELD-04',
    machine_name: 'Robotic Welding Cell Delta',
    wo_id: 'WO-2026-097',
    event_type: 'WORK_ORDER_CANCELLED',
    trigger_source: 'ADMIN_PANEL',
    event_code: null,
    snapshot_total_count: null,
    snapshot_run_sec: null,
    description: 'Cancelled Work Order WO-2026-097 prior to servo calibration',
    acknowledged: true,
    acknowledged_at: '2026-11-11T07:06:00Z',
    acknowledged_by: 'ADM-001',
    ack_note: null,
    created_at: '2026-11-11T07:05:00Z',
  },
  {
    id: 'aud-003',
    recorded_at: '2026-11-10T16:40:00Z',
    device_id: 'STM32-OEE-01',
    machine_id: 'CNC-MILLING-01',
    machine_name: 'CNC Milling Center Alpha',
    wo_id: null,
    event_type: 'MQTT_ADMIN_CLIENT_CREATED',
    trigger_source: 'ADMIN_PANEL',
    event_code: null,
    snapshot_total_count: null,
    snapshot_run_sec: null,
    description: 'Created dynamic security credentials with role edge_publisher',
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    ack_note: null,
    created_at: '2026-11-10T16:40:00Z',
  },
];

export const INITIAL_IAM_ROLES: IamRole[] = [
  {
    id: 'role-admin',
    name: 'ADMIN',
    is_system: true,
    description: 'Akses penuh administrasi pabrik, perangkat, dan hak pengguna (immutable)',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-supervisor',
    name: 'SUPERVISOR',
    is_system: false,
    description: 'Pemantauan produksi, pengelolaan operator lini, analitik shift, dan pembaruan ringkasan data',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-operator',
    name: 'OPERATOR',
    is_system: false,
    description: 'Klasifikasi penyebab downtime, konfirmasi peristiwa operasional, dan pemantauan produksi',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-maintenance',
    name: 'MAINTENANCE',
    is_system: false,
    description: 'Pemantauan kondisi mesin, diagnostik perangkat, dan pemeriksaan perawatan preventif',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'role-quality-auditor',
    name: 'QUALITY_AUDITOR',
    is_system: false,
    description: 'Analisis produk cacat, audit kualitas, dan pemeriksaan kepatuhan produksi',
    created_at: '2026-06-15T09:00:00Z',
  },
];

export const INITIAL_IAM_PERMISSIONS: IamPermission[] = [
  { id: 'perm-01', action: 'read', resourceType: 'machine', description: 'Melihat daftar mesin, status langsung, dan riwayat status mesin' },
  { id: 'perm-02', action: 'read', resourceType: 'work_order', description: 'Memeriksa daftar, detail, dan resolve preview Work Order produksi' },
  { id: 'perm-03', action: 'cancel', resourceType: 'work_order', description: 'Membatalkan Work Order yang masih berjalan atau tertunda (ADMIN + LAN)' },
  { id: 'perm-04', action: 'manage', resourceType: 'machine', description: 'Mendaftarkan, mengubah, mengikat device, dan menghapus mesin' },
  { id: 'perm-05', action: 'label', resourceType: 'downtime_event', description: 'Mengisi dan memperbarui alasan kejadian downtime' },
  { id: 'perm-06', action: 'refresh', resourceType: 'telemetry', description: 'Ekspor data historis & pembaruan ringkasan rekonsiliasi per jam' },
  { id: 'perm-07', action: 'manage', resourceType: 'mqtt_admin', description: 'Khusus ADMIN: mengelola klien, role, grup, dan ACL Dynamic Security MQTT' },
  { id: 'perm-08', action: 'manage', resourceType: 'mqtt_configuration', description: 'Khusus ADMIN: stage, apply, dan rollback konfigurasi broker MQTT' },
  { id: 'perm-09', action: 'read_raw', resourceType: 'mqtt_configuration', description: 'Khusus ADMIN: melihat berkas konfigurasi mentah mosquitto.conf' },
  { id: 'perm-10', action: 'manage', resourceType: 'access_control', description: 'Khusus ADMIN: mengatur peran, penugasan, dan aturan hak akses IAM' },
  { id: 'perm-11', action: 'read', resourceType: 'access_control', description: 'Melihat log audit sistem dan inspeksi keputusan otorisasi IAM' },
  { id: 'perm-12', action: 'ack', resourceType: 'operational_event', description: 'Mengonfirmasi (acknowledge) peristiwa operasional produksi' },
  { id: 'perm-13', action: 'manage', resourceType: 'product', description: 'Menambah, mengubah, dan menghapus master data produk' },
  { id: 'perm-14', action: 'read', resourceType: 'operator', description: 'Melihat daftar akun operator dan penugasan lini' },
  { id: 'perm-15', action: 'create', resourceType: 'operator', description: 'Membuat akun operator baru' },
  { id: 'perm-16', action: 'update_status', resourceType: 'operator', description: 'Mengaktifkan atau menonaktifkan status akun operator' },
  { id: 'perm-17', action: 'update', resourceType: 'operator', description: 'Mengubah profil, penugasan line, atau label peran operator' },
  { id: 'perm-18', action: 'rotate_password', resourceType: 'operator', description: 'Merotasi kata sandi akun operator lain' },
  { id: 'perm-19', action: 'delete', resourceType: 'operator', description: 'Menghapus akun operator yang tidak dilindungi' },
  { id: 'perm-20', action: 'read', resourceType: 'mqtt_admin', description: 'Melihat ringkasan dan daftar klien/role Dynamic Security MQTT' },
  { id: 'perm-21', action: 'read', resourceType: 'mqtt_configuration', description: 'Melihat konfigurasi broker MQTT, riwayat versi, dan backup' },
  { id: 'perm-22', action: 'read', resourceType: 'telemetry', description: 'Melihat riwayat telemetri, analitik OEE, dan pareto kualitas' },
  { id: 'perm-23', action: 'manage', resourceType: 'device', description: 'Mendaftarkan, memperbarui, dan menghapus edge controller STM32' },
  { id: 'perm-24', action: 'read', resourceType: 'production_line', description: 'Melihat daftar dan detail master lini produksi' },
  { id: 'perm-25', action: 'manage', resourceType: 'production_line', description: 'Membuat, mengubah, dan menghapus master lini produksi' },
  { id: 'perm-26', action: 'read', resourceType: 'shift', description: 'Melihat daftar dan detail master shift kerja' },
  { id: 'perm-27', action: 'manage', resourceType: 'shift', description: 'Membuat, mengubah, dan menghapus master shift kerja' },
  { id: 'perm-28', action: 'read', resourceType: 'shift_schedule', description: 'Melihat jadwal shift mingguan per lini produksi' },
  { id: 'perm-29', action: 'manage', resourceType: 'shift_schedule', description: 'Mengatur jadwal shift mingguan per lini produksi' },
  // E20 P20.5 (FAT-157, pembaruan 09:23): authorize("create","machine") —
  // POST /machines, ADMIN + LAN (terpisah dari perm-04 manage:machine).
  { id: 'perm-30', action: 'create', resourceType: 'machine', description: 'Mendaftarkan mesin baru (ADMIN + LAN)' },
];

export const INITIAL_IAM_ASSIGNMENTS: IamAssignment[] = [
  {
    id: 'asg-01',
    operator_id: 'ADM-001',
    operator_name: 'Alexandria Vance',
    role_id: 'role-admin',
    role_name: 'ADMIN',
    scope_type: 'ORGANIZATION',
    scope_id: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'asg-02',
    operator_id: 'SUP-042',
    operator_name: 'Marcus Reinhardt',
    role_id: 'role-supervisor',
    role_name: 'SUPERVISOR',
    scope_type: 'ORGANIZATION',
    scope_id: null,
    created_at: '2026-02-15T08:00:00Z',
  },
  {
    id: 'asg-03',
    operator_id: 'OP-115',
    operator_name: 'Kenji Sato',
    role_id: 'role-operator',
    role_name: 'OPERATOR',
    scope_type: 'LINE',
    scope_id: 'LINE-01',
    created_at: '2026-03-01T08:00:00Z',
  },
];

/**
 * Baris policy kanonis (§3.4, spec 042): camelCase, TANPA `reason` (reason
 * hanya tersimpan di audit IAM, bukan di baris policy).
 */
export const INITIAL_IAM_POLICIES: IamPolicyRule[] = [
  {
    id: 'pol-01',
    roleId: 'role-admin',
    roleName: 'ADMIN',
    subjectMatch: 'operator:ADM-001',
    permissionId: 'perm-10',
    action: '*',
    resourceType: 'access_control',
    resourcePattern: 'org:*',
    effect: 'ALLOW',
    abacCondition: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-02',
    roleId: 'role-supervisor',
    roleName: 'SUPERVISOR',
    subjectMatch: 'role:SUPERVISOR',
    permissionId: 'perm-06',
    action: 'read|refresh',
    resourceType: 'telemetry',
    resourcePattern: 'telemetry:*',
    effect: 'ALLOW',
    abacCondition: {
      all: [
        { attr: 'department', eq: 'production' },
        { attr: 'networkMode', eq: 'LAN' },
      ],
    },
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-03',
    roleId: 'role-supervisor',
    roleName: 'SUPERVISOR',
    subjectMatch: 'role:SUPERVISOR',
    permissionId: 'perm-03',
    action: 'cancel',
    resourceType: 'work_order',
    resourcePattern: 'work_order:*',
    effect: 'DENY',
    abacCondition: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-04',
    roleId: 'role-operator',
    roleName: 'OPERATOR',
    subjectMatch: 'role:OPERATOR',
    permissionId: 'perm-05',
    action: 'read|label',
    resourceType: 'downtime_event',
    resourcePattern: 'downtime_event:*',
    effect: 'ALLOW',
    abacCondition: { attr: 'subjectActive', eq: true },
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-05',
    roleId: 'role-maintenance',
    roleName: 'MAINTENANCE',
    subjectMatch: 'role:MAINTENANCE',
    permissionId: 'perm-01',
    action: 'read',
    resourceType: 'machine',
    resourcePattern: 'machine:*',
    effect: 'ALLOW',
    abacCondition: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const INITIAL_IAM_AUDIT_DECISIONS: IamAuditDecision[] = [
  {
    id: 'dec-101',
    subject: 'ADM-001',
    decision: 'ALLOW',
    mode: 'enforce',
    action: 'manage:mqtt_configuration',
    resource: 'mqtt_configuration:listeners',
    timestamp: '2026-11-11T08:52:00Z',
  },
  {
    id: 'dec-102',
    subject: 'OP-115',
    decision: 'ALLOW',
    mode: 'enforce',
    action: 'label:downtime_event',
    resource: 'downtime_event:dt-ev-02',
    timestamp: '2026-11-11T08:52:05Z',
  },
  {
    id: 'dec-103',
    subject: 'OP-115',
    decision: 'DENY',
    mode: 'enforce',
    action: 'cancel:work_order',
    resource: 'work_order:WO-2026-101',
    reason: 'Policy rule pol-03 forbids cancellation for non-ADMIN',
    timestamp: '2026-11-11T07:30:12Z',
  },
  {
    id: 'dec-104',
    subject: 'SUP-042',
    decision: 'ALLOW',
    mode: 'enforce',
    action: 'refresh:telemetry',
    resource: 'telemetry:reconciliation',
    timestamp: '2026-11-11T06:14:00Z',
  },
];
