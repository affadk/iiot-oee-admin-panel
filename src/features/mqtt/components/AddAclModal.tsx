import { useState } from 'react';
import type { MqttAclType, MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { NewMqttAcl } from '../hooks/useMqttRoleMutations';

interface AddAclModalProps {
  targetRole: MqttRole | null;
  onClose: () => void;
  onSubmit: (rolename: string, acl: NewMqttAcl) => Promise<boolean>;
}

/**
 * Tambah ACL ke role MQTT (E31.14, FAT-277 — diekstrak dari
 * MqttRoleModals.tsx; satu file = satu modal, prinsip 3).
 */
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
        <Select
          label="ACL Type"
          value={aclType}
          onChange={(e) => setAclType(e.target.value as MqttAclType)}
          options={[{ value: 'publishClientSend', label: 'publishClientSend' }, { value: 'publishClientReceive', label: 'publishClientReceive' }, { value: 'subscribeLiteral', label: 'subscribeLiteral' }, { value: 'subscribePattern', label: 'subscribePattern' }, { value: 'unsubscribeLiteral', label: 'unsubscribeLiteral' }, { value: 'unsubscribePattern', label: 'unsubscribePattern' }]}
        />
        <Input label="Topic Pattern" value={aclTopic} onChange={(e) => setAclTopic(e.target.value)} required />
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={aclAllow} onChange={(e) => setAclAllow(e.target.checked)} />
          <span>ALLOW (hilangkan centang untuk DENY eksplisit)</span>
        </label>
      </form>
    </Modal>
  );
};
