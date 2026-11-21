import { useEffect, useState } from 'react';
import type { IamRole } from '../../../types/iam';
import { validateRoleDesc } from '../iamValidation';
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
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [editRoleErrors, setEditRoleErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (target) {
      setEditRoleDesc(target.description);
      setEditRoleErrors({});
    }
  }, [target]);

  const submit = async () => {
    if (isSubmitting) return;
    const errors = validateRoleDesc(editRoleDesc);
    if (Object.keys(errors).length > 0) {
      setEditRoleErrors(errors);
      return;
    }
    setEditRoleErrors({});
    await onSubmit({ description: editRoleDesc.trim() });
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Edit Role ${target?.name ?? ''}`}
      subtitle="Perbarui deskripsi custom role." 
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
