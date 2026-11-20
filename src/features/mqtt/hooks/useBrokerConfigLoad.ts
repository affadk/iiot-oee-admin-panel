/**
 * Alur muat state konfigurasi broker (E31.2, FAT-265) — satu alur:
 * `loadConfigState` memuat draft + status + versions + operations +
 * backups (+ raw bila ber-capability) saat mount. Dipisah dari
 * `useBrokerConfig` (R4).
 */
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { ApiError } from '../../../types/auth';
import type {
  BrokerBackup,
  BrokerConfigSchema,
  BrokerConfigRawResult,
  BrokerConfigVersion,
  BrokerOperation,
} from '../../../types/mqtt';
import type { CapabilityKey } from '../../../utils/capabilities/specs';
import type { BrokerFeedback, BrokerSyncStatus } from './brokerConfigTypes';

export interface BrokerConfigLoadDeps {
  canReadInteract: boolean;
  canReadRawInteract: boolean;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  setFeedback: (feedback: BrokerFeedback | null) => void;
}

export function useBrokerConfigLoad(deps: BrokerConfigLoadDeps) {
  const { canReadInteract, canReadRawInteract, reportForbidden, setFeedback } = deps;

  const [draftConfig, setDraftConfig] = useState<BrokerConfigSchema | null>(null);
  // E23 Batch 3 (FAT-199, N-30): raw = {text, metadata} (spec live),
  // bukan string mentah.
  const [rawConf, setRawConf] = useState<BrokerConfigRawResult | null>(null);
  const [versions, setVersions] = useState<BrokerConfigVersion[]>([]);
  const [operations, setOperations] = useState<BrokerOperation[]>([]);
  const [backups, setBackups] = useState<BrokerBackup[]>([]);
  const [syncStatus, setSyncStatus] = useState<BrokerSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConfigState = useCallback(async () => {
    if (!canReadInteract) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [cfg, status, verList, opsList, bakList] = await Promise.all([
        apiClient.getBrokerConfig(),
        apiClient.getBrokerConfigStatus(),
        apiClient.getBrokerConfigVersions(100),
        apiClient.getBrokerConfigOperations(50),
        apiClient.getBrokerConfigBackups(),
      ]);
      setDraftConfig(cfg);
      setSyncStatus(status);
      setVersions(verList);
      setOperations(opsList);
      setBackups(bakList);

      // Hanya panggil /raw jika subjek punya capability mqtt.config.read_raw (SUPERVISOR tidak memiliki izin ini)
      if (canReadRawInteract) {
        try {
          const raw = await apiClient.getBrokerConfigRaw();
          setRawConf(raw);
        } catch {
          setRawConf(null);
        }
      } else {
        setRawConf(null);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.config.read', undefined, err.message);
      }
      setFeedback({
        type: 'error',
        msg: (err as { message?: string })?.message || 'Gagal memuat pengaturan koneksi mesin.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [canReadInteract, canReadRawInteract, reportForbidden, setFeedback]);

  useEffect(() => {
    loadConfigState();
  }, [loadConfigState]);

  return {
    draftConfig,
    setDraftConfig,
    rawConf,
    versions,
    operations,
    backups,
    syncStatus,
    isLoading,
    loadConfigState,
  };
}
