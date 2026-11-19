/**
 * BARREL — komposisi httpApiClient per domain + re-export mapper (tanpa logika transport).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { httpCore } from './http/transport';
import { httpAuth } from './http/auth';
import { httpHealth } from './http/health';
import { httpDevices } from './http/devices';
import { httpMachines } from './http/machines';
import { httpProducts } from './http/products';
import { httpOperators } from './http/operators';
import { httpProduction } from './http/production';
import { httpWorkOrders } from './http/workOrders';
import { httpMonitoring } from './http/monitoring';
import { httpTelemetry } from './http/telemetry';
import { httpIam } from './http/iam';
import { httpMqttDynsec } from './http/mqttDynsec';
import { httpMqttConfig } from './http/mqttConfig';
import { httpSystem } from './http/system';

export * from './http/mappers';

export const httpApiClient = {
  ...httpCore,
  ...httpAuth,
  ...httpHealth,
  ...httpDevices,
  ...httpMachines,
  ...httpProducts,
  ...httpOperators,
  ...httpProduction,
  ...httpWorkOrders,
  ...httpMonitoring,
  ...httpTelemetry,
  ...httpIam,
  ...httpMqttDynsec,
  ...httpMqttConfig,
  ...httpSystem,
};
