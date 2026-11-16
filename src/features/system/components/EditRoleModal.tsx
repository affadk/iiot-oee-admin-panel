import { useEffect, useState } from 'react';
import type { IamRole } from '../../../types/iam';
import { CUSTOM_ROLE_MAX_LEVEL } from '../../../utils/capabilities';
import { validateRoleLevelDesc } from '../iamValidation';
import type { UpdateRolePayload } from '../hooks/useRoles';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface EditRoleModalProps {
  target: IamRole | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: UpdateRolePayload) => Promise<boolean>;
}

/**
 * Modal Edit Custom Role. Target ganda sebagai open flag DAN target mutasi
 * (isOpen = Boolean(target)). Field diinisialisasi dari target saat target
 * berubah; sukses TIDAK me-reset field — modal menutup via target null.
 */
export const EditRoleModal: React.FC<EditRoleModalProps> = ({
  target,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [editRoleLevel, setEditRoleLevel] = useState(25);
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [editRoleErrors, setEditRoleErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (target) {
      setEditRoleLevel(target.privilege_level);
      setEditRoleDesc(target.description);
      setEditRoleErrors({});
    }
  }, [target]);

  const submit = async () => {
    if (isSubmitting) return;
    const errors = validateRoleLevelDesc(editRoleLevel, editRoleDesc, 'update');
    if (Object.keys(errors).length > 0) {
      setEditRoleErrors(errors);
      return;
    }
    setEditRoleErrors({});
    await onSubmit({ level: Number(editRoleLevel), description: editRoleDesc.trim() });
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Edit Role ${target?.name ?? ''}`}
      subtitle={`Perbarui deskripsi atau tingkat kewenangan custom role (1–${CUSTOM_ROLE_MAX_LEVEL}).`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void submit()} isLoading={isSubmitting}>
            Simpan Perubahan
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
          label={`Tingkat Kewenangan (1–${CUSTOM_ROLE_MAX_LEVEL})`}
          type="number"
          min={1}
          max={CUSTOM_ROLE_MAX_LEVEL}
          value={editRoleLevel}
          onChange={(e) => setEditRoleLevel(Number(e.target.value))}
          error={editRoleErrors.privilege_level}
          required
        />
        <Input
          label="Deskripsi"
          value={editRoleDesc}
          onChange={(e) => setEditRoleDesc(e.target.value)}
          error={editRoleErrors.description}
          required
        />
      </form>
    </Modal>
  );
};
