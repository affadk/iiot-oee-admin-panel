export interface SystemHealth {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  /** Detik sejak backend start (alias numerik dari `uptime`). */
  uptime_seconds: number;
  timestamp: string;
  ws_clients: number;
  db_connected: boolean;
  buffer_pending: number;
  buffer_dropped: number;
  backend: {
    status: 'UP' | 'DOWN';
    label: string;
    environment: string;
    latency_ms: number;
  };
  database: {
    engine: string;
    latency_ms: number;
  };
  mqtt: {
    status: 'UP' | 'DOWN';
    connected_clients: number;
    dynamic_security: string;
  };
  websocket: {
    status: 'UP' | 'DOWN';
  };
  metrics: {
    totalReceived: number;
    validIngested: number;
    invalidDiscarded: number;
    lastIngestedAt: string | null;
  } | null;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  device_id: string | null;
  machine_id: string | null;
  machine_name: string;
  operator_id: string | null;
  operator_name: string;
  event_type: string;
  action: string;
  resource_type:
    | 'WORK_ORDER'
    | 'MACHINE'
    | 'DEVICE'
    | 'PRODUCT'
    | 'OPERATOR'
    | 'PRODUCTION_LINE'
    | 'SHIFT'
    | 'SHIFT_SCHEDULE'
    | 'MQTT_SECURITY'
    | 'BROKER_CONFIG'
    | 'IAM'
    | 'SYSTEM';
  resource_id: string;
  details: string;
  client_ip: string;
  access_mode: 'LAN' | 'REMOTE_TUNNEL';
}
