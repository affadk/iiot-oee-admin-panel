import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (groupname: string) => Promise<boolean>;
}

/**
 * Buat MQTT group baru (E31.14, FAT-277 — diekstrak dari
 * MqttGroupModals.tsx; satu file = satu modal, prinsip 3).
 */
export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ open, onClose, onSubmit }) => {
  const [newGroupName, setNewGroupName] = useState('');

  const submit = async () => {
    const ok = await onSubmit(newGroupName);
    if (ok) {
      onClose();
      setNewGroupName('');
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Buat MQTT Group Baru"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void submit()}>Buat Group</Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />
      </form>
    </Modal>
  );
};
