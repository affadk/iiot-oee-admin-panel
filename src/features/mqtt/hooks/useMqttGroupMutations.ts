import { apiClient } from '../../../services/api/client';
import type { DynSecFeedback } from './useDynamicSecurityData';

interface UseMqttGroupMutationsArgs {
  loadAll: () => Promise<void>;
  setFeedback: (feedback: DynSecFeedback | null) => void;
}

export const useMqttGroupMutations = ({ loadAll, setFeedback }: UseMqttGroupMutationsArgs) => {
  const createGroup = async (groupname: string): Promise<boolean> => {
    try {
      await apiClient.createMqttGroup({
        groupname: groupname.trim(),
        clients: [],
        roles: [],
      });
      await loadAll();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat MQTT group.' });
      return false;
    }
  };

  // Sebelumnya inline di JSX (`.then(loadAll)`) tanpa try/catch dan tanpa
  // feedback — kegagalan diam-diam lalu reload data basi (R9.5 §5c).
  const deleteGroup = async (groupname: string) => {
    try {
      await apiClient.deleteMqttGroup(groupname);
      await loadAll();
      setFeedback({ type: 'success', msg: `Group ${groupname} dihapus.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus MQTT group.' });
    }
  };

  // Sebelumnya inline di JSX tanpa try/catch dan tanpa feedback (R9.5 §5c).
  // Mengembalikan false saat gagal agar modal tetap terbuka.
  const addGroupClient = async (groupname: string, username: string): Promise<boolean> => {
    try {
      await apiClient.addMqttGroupClient(groupname, username);
      await loadAll();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menambah client ke group.' });
      return false;
    }
  };

  // Sebelumnya inline di JSX tanpa try/catch dan tanpa feedback (R9.5 §5c).
  const addGroupRole = async (groupname: string, rolename: string): Promise<boolean> => {
    try {
      await apiClient.addMqttGroupRole(groupname, rolename);
      await loadAll();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menambah role ke group.' });
      return false;
    }
  };

  return { createGroup, deleteGroup, addGroupClient, addGroupRole };
};
