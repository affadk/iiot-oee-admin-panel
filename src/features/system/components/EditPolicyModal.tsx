import { useEffect, useState } from 'react';
import { FileCode2 } from 'lucide-react';
import type { IamPolicyRule } from '../../../types/iam';
import type { UpdatePolicyPayload } from '../hooks/usePolicies';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface EditPolicyModalProps {
  target: IamPolicyRule | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: UpdatePolicyPayload) => Promise<boolean>;
}

/**
 * Modal Edit Aturan Kebijakan. Target ganda sebagai open flag DAN target
 * mutasi. Field diinisialisasi dari target saat target berubah; serialisasi
 * abacCondition (string passthrough atau JSON.stringify 2-spasi) pindah
 * ke sini dari openEditPolicyModal. Action TIDAK bisa diubah (ikatan
 * permission — §3.4).
 */
export const EditPolicyModal: React.FC<EditPolicyModalProps> = ({
  target,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [editPolEffect, setEditPolEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [editPolResource, setEditPolResource] = useState('');
  const [editPolAbacJson, setEditPolAbacJson] = useState('');

  useEffect(() => {
    if (target) {
      setEditPolEffect(target.effect);
      setEditPolResource(target.resourcePattern);
      setEditPolAbacJson(
        target.abacCondition
          ? typeof target.abacCondition === 'string'
            ? target.abacCondition
            : JSON.stringify(target.abacCondition, null, 2)
          : '',
      );
    }
  }, [target]);

  const submit = async () => {
    if (isSubmitting) return;
    await onSubmit({
      effect: editPolEffect,
      resourcePattern: editPolResource,
      abacJson: editPolAbacJson,
    });
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Edit Aturan ${target?.id ?? ''}`}
      subtitle={`Perbarui aturan Casbin ABAC untuk peran ${target?.roleName ?? ''}.`}
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
        className="space-y-3"
      >
        <div>
          <label className="block text-xs font-semibold mb-1">Jenis Aturan</label>
          <select
            value={editPolEffect}
            onChange={(e) => setEditPolEffect(e.target.value as 'ALLOW' | 'DENY')}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            <option value="ALLOW">ALLOW</option>
            <option value="DENY">DENY</option>
          </select>
        </div>
        <Input label="Action (terikat permission — tidak bisa diubah)" value={target?.action ?? ''} disabled />
        <Input label="Resource Pattern" value={editPolResource} onChange={(e) => setEditPolResource(e.target.value)} required />
        <div>
          <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
            <FileCode2 className="w-3.5 h-3.5" /> Syarat Kondisi ABAC JSON (Opsional)
          </label>
          <textarea
            rows={3}
            value={editPolAbacJson}
            onChange={(e) => setEditPolAbacJson(e.target.value)}
            placeholder='{"attr": "subject.line_id", "eq": "LINE-01"}'
            className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          />
        </div>
      </form>
    </Modal>
  );
};
