/**
 * Method demo — domain quality.
 *
 * Dipisah dari demo/telemetry.ts pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu domain.
 * Barrel penggabung ada di file induknya (../telemetry.ts).
 *
 * Pareto reject: satu keranjang UNCLASSIFIED per device
 * (AUDIT.md §12 — tanpa kategori alasan).
 */

import { store } from '../store';
import { checkAbort, REJECT_PARETO_BY_DEVICE } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { RejectParetoItem } from '../../../../types/analytics';

export const demoTelemetryQuality = {
  async getRejectParetoGlobal(signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbort(signal);
    store.recordEndpoint('QUALITY_REJECTS_GLOBAL', ADMIN_ENDPOINTS.QUALITY_REJECTS_GLOBAL.buildPath());
    const map = new Map<string, number>();
    Object.values(REJECT_PARETO_BY_DEVICE)
      .flat()
      .forEach((item) => {
        map.set(item.reason, (map.get(item.reason) ?? 0) + item.count);
      });
    const total = Array.from(map.values()).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    let cumulative = 0;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => {
        const percentage = Number(((count / total) * 100).toFixed(1));
        cumulative = Math.min(100, Number((cumulative + percentage).toFixed(1)));
        return { reason, count, percentage, cumulative_percentage: cumulative };
      });
  },

  async getRejectPareto(deviceId: string, signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbort(signal);
    if (!deviceId) {
      return demoTelemetryQuality.getRejectParetoGlobal(signal);
    }
    store.recordEndpoint('QUALITY_REJECTS_BY_DEVICE', ADMIN_ENDPOINTS.QUALITY_REJECTS_BY_DEVICE.buildPath(deviceId));
    return [...(REJECT_PARETO_BY_DEVICE[deviceId] ?? [])];
  },
};
