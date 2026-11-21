/**
 * Konfigurasi sistem — SATU sumber kebenaran: environment build (`VITE_*`).
 * BARREL (FAT-285, E32.4).
 *
 * Dipisah dari satu file 453 baris menjadi modul per tanggung jawab di
 * `mode/` — tanpa mengubah perilaku apa pun:
 *
 *   - `mode/env.ts` ......... pembaca env mentah (`readEnv`, `readEnvBool`,
 *     `readEnvInt`) — satu-satunya tempat baca `import.meta.env` /
 *     `process.env`
 *   - `mode/apiMode.ts` ..... mode API demo/real + switch terkunci
 *   - `mode/demoPreset.ts` ... preset login demo (hanya hidup bila env demo)
 *   - `mode/endpoints.ts` .... endpoint / WS / label plant
 *   - `mode/timeouts.ts` ..... timeout & retry & TTL sesi (Guide §4.2)
 *   - `mode/network.ts` ...... akses jaringan dual-vhost D1
 *   - `mode/accessMode.ts` ... mode akses Private/Public + akses efektif
 *   - `mode/websocket.ts` .... heartbeat / reconnect / simulasi demo WS
 *
 * Semua impor lama (`./mode`) tetap jalan lewat re-export di bawah ini.
 *
 * Build Guide §4.1 + API_DOCUMENTATION.md §1. Semua switch & nilai sistem
 * yang menentukan perilaku deployment tinggal di sini dan dibaca dari env,
 * BUKAN dari hardcoded value di halaman atau dari tombol di UI:
 *
 *   - Mode API demo/real ............ `VITE_API_MODE` (default `demo`)
 *   - Boleh tidaknya mode diubah dari UI/query (`?api=` / localStorage)
 *     .............................. `VITE_ALLOW_API_MODE_SWITCH` (default `false` = TERKUNCI di env)
 *   - Preset login demo ............ `VITE_DEMO_PRESET_LOGIN` (default `true`,
 *     tapi OTOMATIS MATI bila `VITE_API_MODE=real` — lihat `isDemoPresetLoginEnabled`)
 *   - Endpoint / WS ................ `VITE_API_URL`, `VITE_WS_URL`
 *   - Timeout & retry (§4.2) ....... `VITE_REQUEST_TIMEOUT_MS` (10s),
 *     `VITE_MUTATION_TIMEOUT_MS` (15s), `VITE_EXPORT_TIMEOUT_MS` (120s),
 *     `VITE_HTTP_RETRY_MAX_ATTEMPTS` (3)
 *   - Sesi ......................... `VITE_AUTH_TTL_FALLBACK_SEC` (900)
 *   - Akses jaringan (D1 dual-vhost) `VITE_NETWORK_MODE` (`LAN`|`REMOTE_TUNNEL`,
 *     kosong = deteksi dari port), `VITE_TUNNEL_PORT` (8080),
 *     `VITE_ALLOW_NETWORK_MODE_SIMULATION` (default `false`)
 *   - Mode akses Private/Public ... `VITE_ACCESS_MODE` (`private`|`public`,
 *     default `private`), `VITE_ALLOW_ACCESS_MODE_SWITCH` (default `false`).
 *     Private = akses penuh HANYA dari LAN pabrik, via internet read-only.
 *     Public = akses penuh diizinkan juga via internet publik (tunnel).
 *     Penegakan ada di `assertLanAccess` (demo) & `assertLanForMutation`
 *     (HTTP) + `evaluateCapability` — lihat § "Mode akses" di bawah.
 *   - WebSocket .................... `VITE_WS_HEARTBEAT_MS` (25s),
 *     `VITE_WS_RECONNECT_MAX_MS` (30s), `VITE_DEMO_SIM_INTERVAL_MS` (5s)
 *   - Throttle login ............... DIHAPUS (E20 P20.3): server 5/60s
 *     (§L) satu-satunya throttle; panel TIDAK lockout paralel. Respons 429
 *     membawa header `Retry-After` yang ditampilkan ke pengguna.
 *   - Identitas deployment ......... `VITE_PLANT_LABEL` (`Plant 01`).
 *     (E29: `VITE_DEFAULT_STATION_ID` dihapus — login admin tidak lagi
 *     memakai station_id.)
 *
 * `VITE_*` adalah build-time: nilainya dibakar ke bundle saat `vite build`
 * dan BUKAN tempat rahasia — jangan taruh password/token di sini.
 * Token sesi tetap hanya di memori (Guide D5), tidak pernah di env.
 */

export {
  resolveEnvApiMode,
  isApiModeSwitchAllowed,
  resolveApiMode,
  setApiMode,
  API_MODE_STORAGE_KEY,
} from './mode/apiMode';
export type { ApiMode } from './mode/apiMode';

export { DEMO_PRESETS, DEMO_PRESET_PASSWORD, isDemoPresetLoginEnabled } from './mode/demoPreset';

export {
  resolveApiBaseUrl,
  resolveOriginBaseUrl,
  resolveWsUrl,
  resolvePlantLabel,
} from './mode/endpoints';

export {
  resolveRequestTimeoutMs,
  resolveMutationTimeoutMs,
  resolveExportTimeoutMs,
  resolveHttpRetryMaxAttempts,
  resolveAuthTtlFallbackSec,
} from './mode/timeouts';

export {
  resolveTunnelPort,
  resolveNetworkMode,
  isNetworkModeSimulationAllowed,
} from './mode/network';

export {
  ACCESS_MODE_STORAGE_KEY,
  resolveEnvAccessMode,
  isAccessModeSwitchAllowed,
  resolveAccessMode,
  setAccessMode,
  LAN_GATE_DENY_REASON,
  resolveEffectiveAccess,
  isMutationAllowed,
} from './mode/accessMode';
export type { AccessMode, EffectiveAccess } from './mode/accessMode';

export {
  resolveWsHeartbeatMs,
  resolveWsReconnectMaxMs,
  resolveDemoSimIntervalMs,
} from './mode/websocket';
