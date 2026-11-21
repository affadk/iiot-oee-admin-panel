import { apiClient } from '../../../services/api/client';
import type { DynSecFeedback } from './useDynamicSecurityData';

interface UseMqttGroupMutationsArgs {
  refreshAfterMutation: (successMsg: string | null) => Promise<boolean>;
  setFeedback: (feedback: DynSecFeedback | null) => void;
}

export const useMqttGroupMutations = ({ refreshAfterMutation, setFeedback }: UseMqttGroupMutationsArgs) => {
  const createGroup = async (groupname: string): Promise<boolean> => {
    try {
      await apiClient.createMqttGroup({
        groupname: groupname.trim(),
        clients: [],
        roles: [],
      });
      // E28 Batch A (FAT-227 MUT-01): lihat useMqttRoleMutations — sukses
      // mutasi dikonfirmasi lewat refreshAfterMutation, bukan loadAll mentah.
      await refreshAfterMutation(`MQTT Group "${groupname.trim()}" berhasil dibuat.`);
      return true;
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal membuat MQTT group.' });
      return false;
    }
  };

  // Sebelumnya inline di JSX (`.then(loadAll)`) tanpa try/catch dan tanpa
  // feedback — kegagalan diam-diam lalu reload data basi (R9.5 §5c).
  const deleteGroup = async (groupname: string) => {
    try {
      await apiClient.deleteMqttGroup(groupname);
      await refreshAfterMutation(`Group ${groupname} dihapus.`);
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menghapus MQTT group.' });
    }
  };

  // Sebelumnya inline di JSX tanpa try/catch dan tanpa feedback (R9.5 §5c).
  // Mengembalikan false saat gagal agar modal tetap terbuka.
  const addGroupClient = async (groupname: string, username: string): Promise<boolean> => {
    try {
      await apiClient.addMqttGroupClient(groupname, username);
      await refreshAfterMutation(`Client ${username} ditambahkan ke group ${groupname}.`);
      return true;
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menambah client ke group.' });
      return false;
    }
  };

  // Sebelumnya inline di JSX tanpa try/catch dan tanpa feedback (R9.5 §5c).
  const addGroupRole = async (groupname: string, rolename: string): Promise<boolean> => {
    try {
      await apiClient.addMqttGroupRole(groupname, rolename);
      await refreshAfterMutation(`Role ${rolename} ditambahkan ke group ${groupname}.`);
      return true;
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menambah role ke group.' });
      return false;
    }
  };

  return { createGroup, deleteGroup, addGroupClient, addGroupRole };
};
