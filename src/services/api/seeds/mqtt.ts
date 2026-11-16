/**
 * Seed data demo — domain mqtt.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MqttClient, MqttRole, MqttGroup, BrokerConfigSchema, BrokerConfigVersion, BrokerOperation, BrokerBackup } from '../../../types/mqtt';

export const INITIAL_MQTT_CLIENTS: MqttClient[] = [
  {
    username: 'edge_stm32_01',
    clientid: 'STM32-OEE-01',
    textname: 'Edge Controller CNC-01',
    textdescription: 'CNC Milling Center Alpha telemetry publisher',
    enabled: true,
    roles: ['edge_publisher', 'telemetry_sender'],
    groups: ['machining_floor'],
    created_at: '2026-01-10T08:00:00Z',
    last_seen: new Date(Date.now() - 12_000).toISOString(),
  },
  {
    username: 'edge_stm32_02',
    clientid: 'STM32-OEE-02',
    textname: 'Edge Controller Lathe-02',
    textdescription: 'High Precision Lathe Bravo telemetry publisher',
    enabled: true,
    roles: ['edge_publisher', 'telemetry_sender'],
    groups: ['machining_floor'],
    created_at: '2026-01-10T08:00:00Z',
    last_seen: new Date(Date.now() - 18_000).toISOString(),
  },
  {
    username: 'edge_stm32_03',
    clientid: 'STM32-OEE-03',
    textname: 'Edge Controller Press-03',
    textdescription: 'Hydraulic Stamping Press Charlie telemetry publisher',
    enabled: true,
    roles: ['edge_publisher', 'telemetry_sender'],
    groups: ['stamping_floor'],
    created_at: '2026-01-12T08:00:00Z',
    last_seen: new Date(Date.now() - 25_000).toISOString(),
  },
  {
    username: 'fastify_ingestion_service',
    clientid: 'FASTIFY_CORE_INGEST_01',
    textname: 'Backend Fastify Ingestion',
    enabled: true,
    roles: ['backend_ingestor', 'admin_controller'],
    groups: ['backend_services'],
    created_at: '2025-11-01T00:00:00Z',
    last_seen: new Date(Date.now() - 3_000).toISOString(),
  },
  {
    username: 'websocket_telemetry_relay',
    clientid: 'WS_RELAY_BRIDGE',
    textname: 'WebSocket Live Relay',
    enabled: true,
    roles: ['telemetry_listener'],
    groups: ['backend_services'],
    created_at: '2025-11-01T00:00:00Z',
    last_seen: new Date(Date.now() - 3_000).toISOString(),
  },
];

export const INITIAL_MQTT_ROLES: MqttRole[] = [
  {
    rolename: 'edge_publisher',
    textname: 'Edge STM32 Publisher',
    textdescription: 'Publish telemetry/health/status and subscribe device config/command',
    acls: [
      { acltype: 'publishClientSend', topic: 'oee/device/+/telemetry', allow: true, priority: 1 },
      { acltype: 'publishClientSend', topic: 'oee/device/+/health', allow: true, priority: 1 },
      { acltype: 'subscribePattern', topic: 'oee/device/%c/command', allow: true, priority: 1 },
      { acltype: 'subscribePattern', topic: 'oee/device/%c/config', allow: true, priority: 1 },
    ],
  },
  {
    rolename: 'telemetry_sender',
    textname: 'Telemetry Stream Sender',
    acls: [
      { acltype: 'publishClientSend', topic: 'oee/device/+/status', allow: true, priority: 1 },
    ],
  },
  {
    rolename: 'backend_ingestor',
    textname: 'Fastify Core Ingestor',
    acls: [
      { acltype: 'subscribePattern', topic: 'oee/#', allow: true, priority: 10 },
      { acltype: 'publishClientSend', topic: 'oee/device/+/command', allow: true, priority: 10 },
      { acltype: 'publishClientSend', topic: 'oee/device/+/config', allow: true, priority: 10 },
    ],
  },
  {
    rolename: 'telemetry_listener',
    textname: 'Read-Only Telemetry Subscriber',
    acls: [
      { acltype: 'subscribePattern', topic: 'oee/device/+/telemetry', allow: true, priority: 5 },
      { acltype: 'subscribePattern', topic: 'oee/device/+/health', allow: true, priority: 5 },
    ],
  },
];

export const INITIAL_MQTT_GROUPS: MqttGroup[] = [
  {
    groupname: 'machining_floor',
    textname: 'Machining Floor Controllers',
    clients: ['edge_stm32_01', 'edge_stm32_02'],
    roles: ['edge_publisher'],
  },
  {
    groupname: 'stamping_floor',
    textname: 'Stamping Floor Controllers',
    clients: ['edge_stm32_03'],
    roles: ['edge_publisher'],
  },
  {
    groupname: 'backend_services',
    textname: 'Core Platform Services',
    clients: ['fastify_ingestion_service', 'websocket_telemetry_relay'],
    roles: ['backend_ingestor', 'telemetry_listener'],
  },
];

export const INITIAL_BROKER_CONFIG: BrokerConfigSchema = {
  version: '2.0.18-rel-4',
  general: {
    per_listener_settings: true,
    allow_anonymous: false,
    autosave_interval_seconds: 1800,
    persistence: true,
    persistence_location: '/var/lib/mosquitto/',
    log_dest: ['stdout', 'file /var/log/mosquitto/mosquitto.log'],
    log_type: ['error', 'warning', 'notice', 'information'],
    connection_messages: true,
  },
  limits: {
    max_connections: 500,
    max_packet_size_bytes: 262144,
    max_queued_messages: 10000,
    max_queued_bytes: 104857600,
    max_inflight_messages: 20,
  },
  listeners: [
    {
      id: 'listener-tcp-1883',
      port: 1883,
      bind_address: '0.0.0.0',
      protocol: 'mqtt',
      enabled: true,
      tls_enabled: false,
      max_connections: 300,
    },
    {
      id: 'listener-ws-9001',
      port: 9001,
      bind_address: '0.0.0.0',
      protocol: 'websockets',
      enabled: true,
      tls_enabled: false,
      max_connections: 150,
    },
    {
      id: 'listener-tls-8883',
      port: 8883,
      bind_address: '0.0.0.0',
      protocol: 'mqtt',
      enabled: true,
      tls_enabled: true,
      max_connections: 100,
    },
  ],
  tls_profiles: [
    {
      id: 'tls-factory-ca',
      name: 'Factory Internal CA v2',
      certfile_ref: '/etc/mosquitto/certs/server.crt',
      cafile_ref: '/etc/mosquitto/ca/ca.crt',
      tls_version: 'tlsv1.3',
      require_certificate: true,
      expires_at: '2028-06-30T00:00:00Z',
      status: 'VALID',
    },
  ],
  bridges: [
    {
      id: 'bridge-mes-cloud',
      name: 'Corporate MES Cloud Sync',
      remote_address: 'broker.corporate-mes.internal',
      remote_port: 8883,
      remote_client_id: 'factory_plant01_bridge',
      protocol_version: 'mqttv5',
      topics: [
        {
          pattern: 'factory/plant01/oee/summary',
          direction: 'out',
          qos: 1,
        },
      ],
      status: 'CONNECTED',
      tls_enabled: true,
    },
  ],
};

export const INITIAL_CONFIG_VERSIONS: BrokerConfigVersion[] = [
  {
    version_id: 'cfg-v2.0.18-rel-4',
    parent_version_id: 'cfg-v2.0.18-rel-3',
    applied_at: '2026-11-08T14:20:00Z',
    applied_by: 'Alexandria Vance',
    summary: 'Adjusted WebSocket max connections from 100 to 150 and activated TLS listener 8883',
    operation_type: 'RELOAD',
    status: 'ACTIVE',
    config: INITIAL_BROKER_CONFIG,
  },
  {
    version_id: 'cfg-v2.0.18-rel-3',
    parent_version_id: null,
    applied_at: '2026-10-15T09:00:00Z',
    applied_by: 'Alexandria Vance',
    summary: 'Enabled persistence autosave to 1800s and increased queued bytes to 100MB',
    operation_type: 'RESTART',
    status: 'APPLIED',
    config: INITIAL_BROKER_CONFIG,
  },
];

export const INITIAL_BROKER_OPERATIONS: BrokerOperation[] = [
  {
    operation_id: 'op-cfg-001',
    type: 'APPLY',
    version_id: 'cfg-v2.0.18-rel-4',
    status: 'SUCCEEDED',
    reason: 'Aktivasi listener TLS 8883 dan penyesuaian kapasitas WebSocket',
    steps: [
      { step: 'VALIDATE_SCHEMA', status: 'SUCCEEDED', message: 'Zod & mosquitto -t passed' },
      { step: 'WRITE_BACKUP', status: 'SUCCEEDED', message: 'Backup mosquitto.conf tersimpan' },
      { step: 'RELOAD_BROKER', status: 'SUCCEEDED', message: 'SIGHUP broker reload OK' },
    ],
    timestamp: '2026-11-08T14:20:00Z',
    completed_at: '2026-11-08T14:20:02Z',
  },
];

export const INITIAL_BROKER_BACKUPS: BrokerBackup[] = [
  {
    backup_id: 'bak-001',
    filename: 'mosquitto-2026-11-08T14-20-00Z.conf.bak',
    version_id: 'cfg-v2.0.18-rel-4',
    created_at: '2026-11-08T14:20:00Z',
    size_bytes: 2840,
  },
  {
    backup_id: 'bak-002',
    filename: 'mosquitto-2026-10-15T09-00-00Z.conf.bak',
    version_id: 'cfg-v2.0.18-rel-3',
    created_at: '2026-10-15T09:00:00Z',
    size_bytes: 2612,
  },
];
