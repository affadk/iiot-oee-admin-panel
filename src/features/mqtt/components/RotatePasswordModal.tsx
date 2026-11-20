import { useEffect, useState } from 'react';
import type { MqttClient } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface RotatePasswordModalProps {
  client: MqttClient | null;
  onClose: () => void;
  onSubmit: (username: string, password: string) => Promise<boolean>;
}

/**
 * Rotasi password klien MQTT (E31.14, FAT-277 — diekstrak dari
 * MqttClientModals.tsx; satu file = satu modal, prinsip 3).
 */
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
