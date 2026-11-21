import { useEffect, useState } from 'react';
import { VALIDATION_PATTERNS } from '../../../utils/capabilities';
import { validateRoleDesc } from '../iamValidation';
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
 * modal; sukses me-reset nama/deskripsi. Tanpa field level (E20 P20.3).
 */
export const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [roleName, setRoleName] = useState('');
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
    Object.assign(errors, validateRoleDesc(trimmedDesc));
    if (Object.keys(errors).length > 0) {
      setRoleFormErrors(errors);
      return;
    }
    setRoleFormErrors({});
    const ok = await onSubmit({ name: trimmedName, description: trimmedDesc });
    if (ok) {
      setRoleName('');
      setRoleDesc('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Buat Custom Role Baru"
      subtitle="Custom role aktif pada mode enforce. Hanya ADMIN yang immutable." 
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
