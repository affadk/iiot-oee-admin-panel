import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { MqttClient, MqttGroup, MqttRole } from '../../../types/mqtt';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';

export interface DynSecFeedback {
  type: 'success' | 'error';
  msg: string;
}

/**
 * Data + loading untuk DynamicSecurityPage.
 *
 * loadAll HANYA memuat ketiga list + feedback error. Default form
 * (attachRoleName, groupAddUsername, groupAddRolename) TIDAK lagi di-set di
 * sini: versi lama melakukannya di dalam useCallback ber-dep [reportForbidden],
 * sehingga closure menangkap nilai awal selamanya dan me-reset pilihan form di
 * modal yang sedang terbuka pada setiap reload (bug stale-closure, R9.5 §5a).
 * Default kini milik modal masing-masing (diinisialisasi saat modal dibuka).
 */
export const useDynamicSecurityData = () => {
  const { reportForbidden } = useAuth();

  const [clients, setClients] = useState<MqttClient[]>([]);
  const [roles, setRoles] = useState<MqttRole[]>([]);
  const [groups, setGroups] = useState<MqttGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<DynSecFeedback | null>(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cList, rList, gList] = await Promise.all([
        apiClient.getMqttClients(),
        apiClient.getMqttRoles(),
        apiClient.getMqttGroups(),
      ]);
      setClients(cList);
      setRoles(rList);
      setGroups(gList);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.dynsec.manage', undefined, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat data MQTT Dynamic Security.' });
    } finally {
      setIsLoading(false);
    }
  }, [reportForbidden]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    clients,
    roles,
    groups,
    isLoading,
    feedback,
    setFeedback,
    loadAll,
    dismissFeedback: () => setFeedback(null),
  };
};
