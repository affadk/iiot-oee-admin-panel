import { apiClient } from '../../../services/api/client';
import type { MqttAclType } from '../../../types/mqtt';
import type { DynSecFeedback } from './useDynamicSecurityData';

interface UseMqttRoleMutationsArgs {
  refreshAfterMutation: (successMsg: string | null) => Promise<boolean>;
  setFeedback: (feedback: DynSecFeedback | null) => void;
}

export interface NewMqttAcl {
  acltype: MqttAclType;
  topic: string;
  allow: boolean;
}

export const useMqttRoleMutations = ({ refreshAfterMutation, setFeedback }: UseMqttRoleMutationsArgs) => {
  const createRole = async (rolename: string, textdescription: string): Promise<boolean> => {
    try {
      await apiClient.createMqttRole({
        rolename: rolename.trim(),
        textdescription: textdescription.trim(),
        acls: [],
      });
      // E28 Batch A (FAT-227 MUT-01): sukses mutasi dikonfirmasi lewat
      // refreshAfterMutation — bukan loadAll mentah yang bisa menimpa
      // feedback dengan banner network-error bila refetch gagal transien.
      await refreshAfterMutation(`MQTT Role "${rolename.trim()}" berhasil dibuat.`);
      return true;
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal membuat MQTT role.' });
      return false;
    }
  };

  const addAcl = async (rolename: string, acl: NewMqttAcl): Promise<boolean> => {
    try {
      await apiClient.addMqttRoleAcl(rolename, {
        acltype: acl.acltype,
        topic: acl.topic.trim(),
        allow: acl.allow,
      });
      await refreshAfterMutation(`ACL ${acl.topic.trim()} ditambahkan ke role ${rolename}.`);
      return true;
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menambahkan ACL.' });
      return false;
    }
  };

  // Sebelumnya inline di JSX (`.then(loadAll)`) tanpa try/catch dan tanpa
  // feedback — kegagalan diam-diam lalu reload data basi (R9.5 §5c).
  const deleteRole = async (rolename: string) => {
    try {
      await apiClient.deleteMqttRole(rolename);
      await refreshAfterMutation(`Role ${rolename} dihapus.`);
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menghapus MQTT role.' });
    }
  };

  // Sebelumnya inline di JSX (`.then(loadAll)`) tanpa try/catch dan tanpa
  // feedback — lihat deleteRole di atas (R9.5 §5c).
  const removeAcl = async (rolename: string, acltype: MqttAclType, topic: string) => {
    try {
      await apiClient.removeMqttRoleAcl(rolename, acltype, topic);
      await refreshAfterMutation(`ACL ${topic} dihapus dari role ${rolename}.`);
    } catch (err: unknown) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal menghapus ACL.' });
    }
  };

  return { createRole, addAcl, deleteRole, removeAcl };
};
