import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { MqttClient } from '../../../types/mqtt';
import type { DynSecFeedback } from './useDynamicSecurityData';

/** Payload create client: HANYA mode roles eksplisit (E20 P20.2 — mode
 * deviceId+access dihapus; provisioning perangkat lewat Devices → Provision). */
export type CreateMqttClientPayload = { username: string; password?: string; roles: string[] };

interface UseMqttClientMutationsArgs {
  loadAll: () => Promise<void>;
  setFeedback: (feedback: DynSecFeedback | null) => void;
}

export const useMqttClientMutations = ({ loadAll, setFeedback }: UseMqttClientMutationsArgs) => {
  const [oneTimeSecret, setOneTimeSecret] = useState<{ username: string; secret: string } | null>(null);

  /** Wipe secret hasil generate — dipanggil SATU-SATUNYA lewat onClose modal secret. */
  const clearOneTimeSecret = () => setOneTimeSecret(null);

  const createClient = async (payload: CreateMqttClientPayload): Promise<boolean> => {
    setFeedback(null);
    try {
      const result = await apiClient.createMqttClient(payload);
      if (result.generatedPassword) {
        setOneTimeSecret({
          username: result.client.username,
          secret: result.generatedPassword,
        });
      } else {
        setFeedback({ type: 'success', msg: `MQTT Client "${result.client.username}" berhasil dibuat.` });
      }
      await loadAll();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat MQTT client.' });
      return false;
    }
  };

  const toggleClient = async (c: MqttClient) => {
    try {
      await apiClient.toggleMqttClient(c.username, !c.enabled);
      await loadAll();
      setFeedback({ type: 'success', msg: `Client ${c.username} di-${!c.enabled ? 'aktifkan' : 'nonaktifkan'}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal mengubah status client.' });
    }
  };

  const deleteClient = async (username: string) => {
    try {
      await apiClient.deleteMqttClient(username);
      await loadAll();
      setFeedback({ type: 'success', msg: `Client ${username} dihapus.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus client.' });
    }
  };

  // Sengaja TIDAK memanggil loadAll setelah rotasi (sama seperti versi lama):
  // rotasi password tidak mengubah list client yang ditampilkan.
  const rotatePassword = async (username: string, password: string): Promise<boolean> => {
    try {
      await apiClient.rotateMqttClientPassword(username, password);
      setFeedback({ type: 'success', msg: `Password MQTT untuk ${username} dirotasi.` });
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal merotasi password MQTT.' });
      return false;
    }
  };

  const attachRole = async (username: string, rolename: string): Promise<boolean> => {
    if (!rolename) return false;
    try {
      await apiClient.addMqttClientRole(username, rolename);
      await loadAll();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menambah role client.' });
      return false;
    }
  };

  const detachRole = async (username: string, rolename: string) => {
    try {
      await apiClient.removeMqttClientRole(username, rolename);
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal melepas role client.' });
    }
  };

  return {
    oneTimeSecret,
    clearOneTimeSecret,
    createClient,
    toggleClient,
    deleteClient,
    rotatePassword,
    attachRole,
    detachRole,
  };
};
