/**
 * BARREL — komposisi demoMonitoring per sub-domain (tanpa logika bisnis).
 *
 * Dipisah dari file 445 baris pada E32.5 (FAT-286), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Urutan method sama seperti
 * sebelumnya: liveState → downtime → operationalEvents → audit.
 */
import { demoMonitoringLiveState } from './monitoring/liveState';
import { demoMonitoringDowntime } from './monitoring/downtime';
import { demoMonitoringOperationalEvents } from './monitoring/operationalEvents';
import { demoMonitoringAudit } from './monitoring/audit';

export const demoMonitoring = {
  ...demoMonitoringLiveState,
  ...demoMonitoringDowntime,
  ...demoMonitoringOperationalEvents,
  ...demoMonitoringAudit,
};
