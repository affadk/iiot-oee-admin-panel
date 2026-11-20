import { useEffect, useState } from 'react';
import type { MqttClient, MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

interface RotatePasswordModalProps {
  client: MqttClient | null;
  onClose: () => void;
  onSubmit: (username: string, password: string) => Promise<boolean>;
}

export const RotatePasswordModal: React.FC<RotatePasswordModalProps> = ({ client, onClose, onSubmit }) => {
  const [newClientPwd, setNewClientPwd] = useState('');

  // Field dibersihkan setiap kali modal dibuka untuk client (baru).
  useEffect(() => {
    if (client) setNewClientPwd('');
  }, [client]);

  const submit = async () => {
    if (!client) return;
    const ok = await onSubmit(client.username, newClientPwd);
    if (ok) {
      setNewClientPwd('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={Boolean(client)}
      onClose={onClose}
      title={`Rotasi Password MQTT: ${client?.username ?? ''}`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void submit()}>Simpan Password</Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          label="Password MQTT Baru (min. 8 karakter)"
          type="password"
          value={newClientPwd}
          onChange={(e) => setNewClientPwd(e.target.value)}
          required
        />
      </form>
    </Modal>
  );
};

interface AttachRoleModalProps {
  client: MqttClient | null;
  roles: MqttRole[];
  onClose: () => void;
  onSubmit: (username: string, rolename: string) => Promise<boolean>;
}

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
