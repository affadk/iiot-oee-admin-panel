import { useState } from 'react';
import type { MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import type { CreateMqttClientPayload } from '../hooks/useMqttClientMutations';

interface CreateMqttClientModalProps {
  open: boolean;
  onClose: () => void;
  roles: MqttRole[];
  onSubmit: (payload: CreateMqttClientPayload) => Promise<boolean>;
}

export const CreateMqttClientModal: React.FC<CreateMqttClientModalProps> = ({
  open,
  onClose,
  roles,
  onSubmit,
}) => {
  const [createMode, setCreateMode] = useState<'device' | 'roles'>('device');
  const [cUsername, setCUsername] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cDeviceId, setCDeviceId] = useState('STM32-OEE-06');
  const [cAccess, setCAccess] = useState<'publish' | 'subscribe' | 'readwrite'>('publish');
  const [cRoles, setCRoles] = useState<string[]>(['edge_publisher']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const payload: CreateMqttClientPayload =
        createMode === 'device'
          ? {
              username: cUsername.trim(),
              password: cPassword.trim() || undefined,
              deviceId: cDeviceId.trim(),
              access: cAccess,
            }
          : {
              username: cUsername.trim(),
              password: cPassword.trim() || undefined,
              roles: cRoles,
            };
      const ok = await onSubmit(payload);
      if (ok) {
        onClose();
        // Sama seperti versi lama: hanya username + password yang dibersihkan.
        setCUsername('');
        setCPassword('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Buat Akun Akses Perangkat MQTT Baru"
      subtitle="Kosongkan kata sandi jika ingin sistem membuatkan kata sandi acak otomatis (hanya tampil satu kali)."
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void submit()} isLoading={isSubmitting}>Buat Client</Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <Input
          label="MQTT Username"
          value={cUsername}
          onChange={(e) => setCUsername(e.target.value)}
          placeholder="edge-stm32-06"
          required
        />
        <Input
          label="Kata Sandi Kustom (Opsional — kosongkan untuk buat otomatis)"
          type="password"
          value={cPassword}
          onChange={(e) => setCPassword(e.target.value)}
          placeholder="Kosongkan agar sistem membuat kata sandi otomatis"
        />
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setCreateMode('device')}
            className={`px-3 py-1.5 rounded border font-semibold cursor-pointer ${
              createMode === 'device' ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            Mode: Device ID + Access
          </button>
          <button
            type="button"
            onClick={() => setCreateMode('roles')}
            className={`px-3 py-1.5 rounded border font-semibold cursor-pointer ${
              createMode === 'roles' ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            Mode: Pilih Roles Eksplisit
          </button>
        </div>
        {createMode === 'device' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Device ID" value={cDeviceId} onChange={(e) => setCDeviceId(e.target.value)} required />
            <div>
              <label className="block text-xs font-semibold mb-1">Access Scope</label>
              <select
                value={cAccess}
                onChange={(e) => setCAccess(e.target.value as 'publish' | 'subscribe' | 'readwrite')}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
              >
                <option value="publish">publish</option>
                <option value="subscribe">subscribe</option>
                <option value="readwrite">readwrite</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold">Roles (Min. 1)</label>
            {roles.map((r) => (
              <label key={r.rolename} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={cRoles.includes(r.rolename)}
                  onChange={(e) =>
                    setCRoles((prev) =>
                      e.target.checked ? [...prev, r.rolename] : prev.filter((x) => x !== r.rolename)
                    )
                  }
                />
                <span className="font-mono">{r.rolename}</span>
              </label>
            ))}
          </div>
        )}
      </form>
    </Modal>
  );
};
