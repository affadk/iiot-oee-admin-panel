import { useEffect, useState } from 'react';
import type { MqttClient, MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

interface AttachRoleModalProps {
  client: MqttClient | null;
  roles: MqttRole[];
  onClose: () => void;
  onSubmit: (username: string, rolename: string) => Promise<boolean>;
}

/**
 * Attach role ke klien MQTT (E31.14, FAT-277 — diekstrak dari
 * MqttClientModals.tsx; satu file = satu modal, prinsip 3).
 */
export const AttachRoleModal: React.FC<AttachRoleModalProps> = ({ client, roles, onClose, onSubmit }) => {
  const [attachRoleName, setAttachRoleName] = useState('');

  // Default milik form, diinisialisasi saat modal dibuka dari daftar roles —
  // bukan dari loader (perbaikan bug stale-closure loadAll, R9.5 §5a).
  // FAT-228 (MUT-02): tanpa fallback hardcode `edge_publisher` (role fiktif).
  useEffect(() => {
    if (client) setAttachRoleName(roles[0]?.rolename ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const submit = async () => {
    if (!client || !attachRoleName) return;
    const ok = await onSubmit(client.username, attachRoleName);
    if (ok) onClose();
  };

  return (
    <Modal
      isOpen={Boolean(client)}
      onClose={onClose}
      title={`Attach Role ke ${client?.username ?? ''}`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void submit()}>Attach</Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Select
          wrapperClassName="shrink-0"
          value={attachRoleName}
          onChange={(e) => setAttachRoleName(e.target.value)}
          className="w-full"
          options={roles.map((r) => ({ value: r.rolename, label: r.rolename }))}
        />
      </form>
    </Modal>
  );
};
