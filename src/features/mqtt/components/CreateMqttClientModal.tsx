import { useEffect, useState } from 'react';
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
  const [cUsername, setCUsername] = useState('');
  const [cPassword, setCPassword] = useState('');
  // FAT-228 (MUT-02): JANGAN hardcode nama role. `edge_publisher` tidak ada di
  // broker → mosquitto "Role not found" dan client-create selalu gagal. Pilih
  // role nyata dari daftar `GET /mqtt/roles` (prop `roles`); default = role
  // pertama yang tersedia. Disinkronkan saat modal dibuka / roles tiba.
  const [cRoles, setCRoles] = useState<string[]>([]);
  const [cPasswordError, setCPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCRoles((prev) => {
      const valid = prev.filter((name) => roles.some((r) => r.rolename === name));
      if (valid.length > 0) return valid;
      return roles[0] ? [roles[0].rolename] : [];
    });
  }, [open, roles]);

  const submit = async () => {
    // K-06 (B33): API §M + Guide §7.2 — password wajib (min 8, maks 128);
    // backend tidak menjanjikan auto-generate. Footer memanggil submit()
    // langsung (bypass validasi HTML5 form), jadi guard di sini.
    const pw = cPassword.trim();
    if (pw.length < 8 || pw.length > 128) {
      setCPasswordError('Kata sandi wajib diisi, minimal 8 karakter (maksimal 128).');
      return;
    }
    if (cRoles.length === 0) {
      setCPasswordError('');
      return;
    }
    setCPasswordError('');
    setIsSubmitting(true);
    try {
      const ok = await onSubmit({
        username: cUsername.trim(),
        password: pw,
        roles: cRoles,
      });
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
      title="Buat Akun Akses MQTT Baru"
      subtitle="Kata sandi wajib diisi (minimal 8 karakter) — password dikembalikan sekali dan hanya tampil satu kali."
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
        <div className="p-2.5 rounded border border-sky-300 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200">
          Provisioning perangkat (broker identity + registry) bukan di sini — gunakan menu Devices → Provision Device.
          Modal ini hanya membuat client MQTT dengan roles eksplisit.
        </div>
        <Input
          label="MQTT Username"
          value={cUsername}
          onChange={(e) => setCUsername(e.target.value)}
          placeholder="edge-stm32-06"
          required
        />
        <Input
          label="Kata Sandi (wajib, minimal 8 karakter)"
          type="password"
          value={cPassword}
          onChange={(e) => setCPassword(e.target.value)}
          placeholder="Minimal 8 karakter"
          required
          minLength={8}
          maxLength={128}
        />
        {cPasswordError ? <p className="text-xs text-red-600 dark:text-red-400">{cPasswordError}</p> : null}
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
          {cRoles.length === 0 ? (
            <p className="text-xs text-red-600 dark:text-red-400">Minimal 1 role wajib dipilih.</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
};
