/**
 * BARREL — komposisi demoApiClient per domain + selector apiClient (tanpa logika bisnis).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { demoCore } from './demo/core';
import { demoAuth } from './demo/auth';
import { demoHealth } from './demo/health';
import { demoDevices } from './demo/devices';
import { demoMachines } from './demo/machines';
import { demoProducts } from './demo/products';
import { demoProduction } from './demo/production';
import { demoOperators } from './demo/operators';
import { demoWorkOrders } from './demo/workOrders';
import { demoMonitoring } from './demo/monitoring';
import { demoTelemetry } from './demo/telemetry';
import { demoMqttDynsec } from './demo/mqttDynsec';
import { demoMqttConfig } from './demo/mqttConfig';
import { demoIam } from './demo/iam';
import { httpApiClient } from './httpClient';
import { resolveApiMode } from './mode';

export { store } from './demo/store';

export const demoApiClient = {
  ...demoCore,
  ...demoAuth,
  ...demoHealth,
  ...demoDevices,
  ...demoMachines,
  ...demoProducts,
  ...demoProduction,
  ...demoOperators,
  ...demoWorkOrders,
  ...demoMonitoring,
  ...demoTelemetry,
  ...demoMqttDynsec,
  ...demoMqttConfig,
  ...demoIam,
};

/**
 * Selector transport (Build Guide §4.1): mode Demo memakai store in-memory;
 * mode Real memakai HTTP client ke backend (./httpClient). Mode berasal dari
 * env (VITE_API_MODE, default demo) dan TERKUNCI di sana kecuali
 * VITE_ALLOW_API_MODE_SWITCH=true (dev lokal) — lihat ./mode.
 */
export const apiClient = resolveApiMode() === 'real' ? httpApiClient : demoApiClient;
