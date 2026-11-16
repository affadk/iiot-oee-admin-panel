import { useState } from 'react';
import type { MqttAclType, MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import type { NewMqttAcl } from '../hooks/useMqttRoleMutations';

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rolename: string, description: string) => Promise<boolean>;
}

export const CreateRoleModal: React.FC<CreateRoleModalProps> = ({ open, onClose, onSubmit }) => {
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const submit = async () => {
    const ok = await onSubmit(newRoleName, newRoleDesc);
    if (ok) {
      onClose();
      setNewRoleName('');
      setNewRoleDesc('');
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Buat MQTT Role Baru"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void submit()}>Simpan Role</Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <Input label="Role Name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
        <Input label="Deskripsi" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} />
      </form>
    </Modal>
  );
};

interface AddAclModalProps {
  targetRole: MqttRole | null;
  onClose: () => void;
  onSubmit: (rolename: string, acl: NewMqttAcl) => Promise<boolean>;
}

export const AddAclModal: React.FC<AddAclModalProps> = ({ targetRole, onClose, onSubmit }) => {
  const [aclType, setAclType] = useState<MqttAclType>('publishClientSend');
  const [aclTopic, setAclTopic] = useState('oee/edge/+/telemetry');
  const [aclAllow, setAclAllow] = useState(true);

  const submit = async () => {
    if (!targetRole) return;
    const ok = await onSubmit(targetRole.rolename, {
      acltype: aclType,
      topic: aclTopic,
      allow: aclAllow,
    });
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen={Boolean(targetRole)}
      onClose={onClose}
      title={`Tambah ACL untuk Role ${targetRole?.rolename ?? ''}`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void submit()}>Tambah ACL</Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-xs font-semibold mb-1">ACL Type</label>
          <select
            value={aclType}
            onChange={(e) => setAclType(e.target.value as MqttAclType)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            <option value="publishClientSend">publishClientSend</option>
            <option value="publishClientReceive">publishClientReceive</option>
            <option value="subscribeLiteral">subscribeLiteral</option>
            <option value="subscribePattern">subscribePattern</option>
            <option value="unsubscribeLiteral">unsubscribeLiteral</option>
            <option value="unsubscribePattern">unsubscribePattern</option>
          </select>
        </div>
        <Input label="Topic Pattern" value={aclTopic} onChange={(e) => setAclTopic(e.target.value)} required />
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={aclAllow} onChange={(e) => setAclAllow(e.target.checked)} />
          <span>ALLOW (hilangkan centang untuk DENY eksplisit)</span>
        </label>
      </form>
    </Modal>
  );
};
