import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { sleep } from '../../../services/api/http/transport';
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
 *
 * E28 Batch A (FAT-227 MUT-01) — akar banner network-error palsu:
 * hook mutasi memanggil `loadAll()` DI DALAM try yang sama dengan mutasi,
 * dan `loadAll` men-set feedback error sendiri bila SALAH SATU dari tiga
 * GET gagal. Urutan di createClient bahkan `setFeedback(sukses)` DULU lalu
 * `loadAll()` — bila refetch gagal transien, feedback sukses TERTIMPA
 * banner "Koneksi jaringan terputus..." padahal mutasi SUDAH sukses di
 * server, dan list tetap basi (state lama dipertahankan) sampai remount.
 * Perbaikan:
 * - `loadAll` mengembalikan boolean sukses/gagal dan (kecuali `silent`)
 *   hanya men-set feedback error bila dipanggil sebagai pemuatan awal.
 * - `refreshAfterMutation` adalah SATU-SATUNYA jalur refetch pasca-mutasi:
 *   refetch senyap + SATU percobaan ulang (server baru menerapkan DynSec),
 *   lalu feedback JUJUR — sukses bila list termuat, atau "mutasi berhasil
 *   tapi daftar gagal dimuat ulang, tekan Refresh" bila refetch tetap gagal.
 *   Banner network-error TIDAK PERNAH lagi menimpa status mutasi yang sukses.
 */
export const useDynamicSecurityData = () => {
  const { reportForbidden } = useAuth();

  const [clients, setClients] = useState<MqttClient[]>([]);
  const [roles, setRoles] = useState<MqttRole[]>([]);
  const [groups, setGroups] = useState<MqttGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<DynSecFeedback | null>(null);

  const loadAll = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
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
      return true;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.dynsec.manage', undefined, err.message);
      }
      if (!opts?.silent) {
        setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal memuat data MQTT Dynamic Security.' });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [reportForbidden]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /**
   * Refetch pasca-mutasi (SATU-SATUNYA jalur yang dipakai hook mutasi).
   * Mutasi pemanggil SUDAH sukses saat ini dipanggil — kegagalan refetch
   * tidak boleh dilaporkan sebagai kegagalan mutasi. Satu percobaan ulang
   * setelah 600 ms (penerapan DynSec di server bisa sesaat belum terbaca
   * oleh GET berikutnya). `successMsg` null = tanpa banner sukses (dipakai
   * createClient saat secret sekali-tampil yang ditampilkan).
   */
  const refreshAfterMutation = useCallback(
    async (successMsg: string | null): Promise<boolean> => {
      const ok = await loadAll({ silent: true });
      if (ok) {
        if (successMsg) setFeedback({ type: 'success', msg: successMsg });
        return true;
      }
      await sleep(600);
      const retried = await loadAll({ silent: true });
      if (retried) {
        if (successMsg) setFeedback({ type: 'success', msg: successMsg });
        return true;
      }
      setFeedback({
        type: 'error',
        msg: `${successMsg ?? 'Mutasi berhasil di server,'} tetapi daftar gagal dimuat ulang — data di layar mungkin belum terbaru. Tekan Refresh untuk memuat ulang.`,
      });
      return false;
    },
    [loadAll],
  );

  return {
    clients,
    roles,
    groups,
    isLoading,
    feedback,
    setFeedback,
    loadAll,
    refreshAfterMutation,
    dismissFeedback: () => setFeedback(null),
  };
};
