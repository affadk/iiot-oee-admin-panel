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
 * abac_condition (string passthrough atau JSON.stringify 2-spasi) pindah
 * ke sini dari openEditPolicyModal.
 */
export const EditPolicyModal: React.FC<EditPolicyModalProps> = ({
  target,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [editPolEft, setEditPolEft] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [editPolAction, setEditPolAction] = useState('');
  const [editPolResource, setEditPolResource] = useState('');
  const [editPolAbacJson, setEditPolAbacJson] = useState('');
  const [editPolReason, setEditPolReason] = useState('');

  useEffect(() => {
    if (target) {
      setEditPolEft(target.eft);
      setEditPolAction(target.action);
      setEditPolResource(target.resource_pattern);
      setEditPolAbacJson(
        target.abac_condition
          ? typeof target.abac_condition === 'string'
            ? target.abac_condition
            : JSON.stringify(target.abac_condition, null, 2)
          : '',
      );
      setEditPolReason(target.reason ?? '');
    }
  }, [target]);

  const submit = async () => {
    if (isSubmitting) return;
    await onSubmit({
      eft: editPolEft,
      action: editPolAction,
      resource: editPolResource,
      abacJson: editPolAbacJson,
      reason: editPolReason,
    });
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Edit Aturan ${target?.id ?? ''}`}
      subtitle={`Perbarui aturan Casbin ABAC untuk peran ${target?.role ?? ''}.`}
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
            value={editPolEft}
            onChange={(e) => setEditPolEft(e.target.value as 'ALLOW' | 'DENY')}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            <option value="ALLOW">ALLOW</option>
            <option value="DENY">DENY</option>
          </select>
        </div>
        <Input label="Action" value={editPolAction} onChange={(e) => setEditPolAction(e.target.value)} required />
        <Input label="Resource Pattern" value={editPolResource} onChange={(e) => setEditPolResource(e.target.value)} required />
        <div>
          <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
            <FileCode2 className="w-3.5 h-3.5" /> Syarat Kondisi ABAC JSON (Opsional)
          </label>
          <textarea
            rows={3}
            value={editPolAbacJson}
            onChange={(e) => setEditPolAbacJson(e.target.value)}
            placeholder='{"line_id": "LINE-01"}'
            className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          />
        </div>
        <Input label="Alasan / Keterangan" value={editPolReason} onChange={(e) => setEditPolReason(e.target.value)} />
      </form>
    </Modal>
  );
};
