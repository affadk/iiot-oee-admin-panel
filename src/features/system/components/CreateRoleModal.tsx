import { useEffect, useState } from 'react';
import { CUSTOM_ROLE_MAX_LEVEL, VALIDATION_PATTERNS } from '../../../utils/capabilities';
import { validateRoleLevelDesc } from '../iamValidation';
import type { CreateRolePayload } from '../hooks/useRoles';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface CreateRoleModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateRolePayload) => Promise<boolean>;
}

/**
 * Modal Buat Custom Role Baru. Field form + error validasi field milik
 * modal; sukses me-reset nama/deskripsi/level (25) seperti versi lama.
 */
export const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [roleName, setRoleName] = useState('');
  const [roleLevel, setRoleLevel] = useState(25);
  const [roleDesc, setRoleDesc] = useState('');
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) setRoleFormErrors({});
  }, [isOpen]);

  const submit = async () => {
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    const trimmedName = roleName.trim();
    const trimmedDesc = roleDesc.trim();
    if (!VALIDATION_PATTERNS.IAM_ROLE_NAME.test(trimmedName)) {
      errors.name = 'Nama role wajib diawali huruf, panjang 2–64 karakter (huruf, angka, "_", "-").';
    }
    Object.assign(errors, validateRoleLevelDesc(roleLevel, trimmedDesc, 'create'));
    if (Object.keys(errors).length > 0) {
      setRoleFormErrors(errors);
      return;
    }
    setRoleFormErrors({});
    const ok = await onSubmit({ name: trimmedName, level: Number(roleLevel), description: trimmedDesc });
    if (ok) {
      setRoleName('');
      setRoleDesc('');
      setRoleLevel(25);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Buat Custom Role Baru"
      subtitle={`Tingkat kewenangan peran tambahan dibatasi 1–${CUSTOM_ROLE_MAX_LEVEL} (ADMIN = 40, SUPERVISOR = 30). Custom role aktif pada mode enforce.`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void submit()} isLoading={isSubmitting}>
            Simpan Role
          </Button>
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
          label="Role Name"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value.toUpperCase())}
          placeholder="PRODUCTION_MANAGER"
          error={roleFormErrors.name}
          required
        />
        <Input
          label={`Tingkat Kewenangan (1–${CUSTOM_ROLE_MAX_LEVEL})`}
          type="number"
          min={1}
          max={CUSTOM_ROLE_MAX_LEVEL}
          value={roleLevel}
          onChange={(e) => setRoleLevel(Number(e.target.value))}
          error={roleFormErrors.privilege_level}
          required
        />
        <Input
          label="Deskripsi"
          value={roleDesc}
          onChange={(e) => setRoleDesc(e.target.value)}
          placeholder="Pengelola operasional lini dan analitik produksi"
          error={roleFormErrors.description}
          required
        />
      </form>
    </Modal>
  );
};
