import { apiClient } from '../../../services/api/client';
import type { MqttAclType } from '../../../types/mqtt';
import type { DynSecFeedback } from './useDynamicSecurityData';

interface UseMqttRoleMutationsArgs {
  loadAll: () => Promise<void>;
  setFeedback: (feedback: DynSecFeedback | null) => void;
}

export interface NewMqttAcl {
  acltype: MqttAclType;
  topic: string;
  allow: boolean;
}

export const useMqttRoleMutations = ({ loadAll, setFeedback }: UseMqttRoleMutationsArgs) => {
  const createRole = async (rolename: string, textdescription: string): Promise<boolean> => {
    try {
      await apiClient.createMqttRole({
        rolename: rolename.trim(),
        textdescription: textdescription.trim(),
        acls: [],
      });
      await loadAll();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat MQTT role.' });
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
      await loadAll();
      return true;
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menambahkan ACL.' });
      return false;
    }
  };

  // Sebelumnya inline di JSX (`.then(loadAll)`) tanpa try/catch dan tanpa
  // feedback — kegagalan diam-diam lalu reload data basi (R9.5 §5c).
  const deleteRole = async (rolename: string) => {
    try {
      await apiClient.deleteMqttRole(rolename);
      await loadAll();
      setFeedback({ type: 'success', msg: `Role ${rolename} dihapus.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus MQTT role.' });
    }
  };

  // Sebelumnya inline di JSX (`.then(loadAll)`) tanpa try/catch dan tanpa
  // feedback — lihat deleteRole di atas (R9.5 §5c).
  const removeAcl = async (rolename: string, acltype: MqttAclType, topic: string) => {
    try {
      await apiClient.removeMqttRoleAcl(rolename, acltype, topic);
      await loadAll();
      setFeedback({ type: 'success', msg: `ACL ${topic} dihapus dari role ${rolename}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus ACL.' });
    }
  };

  return { createRole, addAcl, deleteRole, removeAcl };
};
