/**
 * Endpoint / WebSocket / identitas deployment (FAT-285, E32.4).
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku.
 */
import { readEnv } from './env';

export function resolveApiBaseUrl(): string {
  const envUrl = (readEnv('VITE_API_URL') ?? '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://localhost:3001/api/v1';
}

/** Base URL tanpa suffix `/api/v1` — untuk `/health` dan WS. */
export function resolveOriginBaseUrl(): string {
  const api = resolveApiBaseUrl();
  return api.endsWith('/api/v1') ? api.slice(0, -'/api/v1'.length) : api;
}

export function resolveWsUrl(): string {
  const envUrl = (readEnv('VITE_WS_URL') ?? '').trim();
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/telemetry`;
  }
  return 'ws://localhost/ws/telemetry';
}

/** Label plant yang tampil di Topbar (`Plant 01`). */
export function resolvePlantLabel(): string {
  return (readEnv('VITE_PLANT_LABEL') ?? '').trim() || 'Plant 01';
}
