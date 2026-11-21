/**
 * WebSocket: heartbeat, reconnect, simulasi demo — FAT-285, E32.4.
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku.
 */
import { readEnvInt } from './env';

/** Interval heartbeat WS mode Real (Guide: 25s). */
export function resolveWsHeartbeatMs(): number {
  return readEnvInt('VITE_WS_HEARTBEAT_MS', 25000);
}

/** Batas atas backoff reconnect WS (30s). */
export function resolveWsReconnectMaxMs(): number {
  return readEnvInt('VITE_WS_RECONNECT_MAX_MS', 30000);
}

/** Interval emisi simulasi telemetri mode Demo (5s). */
export function resolveDemoSimIntervalMs(): number {
  return readEnvInt('VITE_DEMO_SIM_INTERVAL_MS', 5000);
}
