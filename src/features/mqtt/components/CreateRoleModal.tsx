import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rolename: string, description: string) => Promise<boolean>;
}

/**
 * Buat MQTT role baru (E31.14, FAT-277 — diekstrak dari
 * MqttRoleModals.tsx; satu file = satu modal, prinsip 3).
 * Nama sama dengan modal IAM di features/system/components/ — keduanya
 * domain berbeda, import selalu lewat path eksplisit.
 */
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
