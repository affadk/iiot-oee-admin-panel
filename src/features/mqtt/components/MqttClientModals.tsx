import { useEffect, useState } from 'react';
import type { MqttClient, MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

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
  const [attachRoleName, setAttachRoleName] = useState('edge_publisher');

  // Default milik form, diinisialisasi saat modal dibuka dari daftar roles —
  // bukan dari loader (perbaikan bug stale-closure loadAll, R9.5 §5a).
  useEffect(() => {
    if (client) setAttachRoleName(roles[0]?.rolename ?? 'edge_publisher');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const submit = async () => {
    if (!client) return;
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
        <select
          value={attachRoleName}
          onChange={(e) => setAttachRoleName(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
        >
          {roles.map((r) => (
            <option key={r.rolename} value={r.rolename}>
              {r.rolename}
            </option>
          ))}
        </select>
      </form>
    </Modal>
  );
};
