import { useState } from 'react';
import { FileCode2 } from 'lucide-react';
import type { IamPermission, IamRole } from '../../../types/iam';
import type { CreatePolicyPayload } from '../hooks/usePolicies';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface CreatePolicyModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  roles: IamRole[];
  permissions: IamPermission[];
  onClose: () => void;
  onSubmit: (payload: CreatePolicyPayload) => Promise<boolean>;
}

/**
 * Modal Tambah Aturan Kebijakan Baru. Field form milik modal; select
 * template `polTemplatePermId` adalah controlled value yang live — memilih
 * template mengisi action/resource dari permission katalog. Role ADMIN
 * memaksa eft ALLOW. Sukses hanya membersihkan abacJson/reason.
 */
export const CreatePolicyModal: React.FC<CreatePolicyModalProps> = ({
  isOpen,
  isSubmitting,
  roles,
  permissions,
  onClose,
  onSubmit,
}) => {
  const [polTemplatePermId, setPolTemplatePermId] = useState('');
  const [polRole, setPolRole] = useState('SUPERVISOR');
  const [polEft, setPolEft] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [polAction, setPolAction] = useState('read');
  const [polResource, setPolResource] = useState('telemetry:*');
  const [polAbacJson, setPolAbacJson] = useState('');
  const [polReason, setPolReason] = useState('');

  const submit = async () => {
    if (isSubmitting) return;
    const ok = await onSubmit({
      role: polRole,
      eft: polEft,
      action: polAction,
      resource: polResource,
      abacJson: polAbacJson,
      reason: polReason,
    });
    if (ok) {
      setPolAbacJson('');
      setPolReason('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Aturan Kebijakan Baru"
      subtitle="Buat aturan izin atau pembatasan baru untuk peran tertentu."
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void submit()} isLoading={isSubmitting}>
            Simpan Aturan
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
          <label className="block text-xs font-semibold mb-1">
            Template dari Katalog Permission (Opsional)
          </label>
          <select
            value={polTemplatePermId}
            onChange={(e) => {
              const pid = e.target.value;
              setPolTemplatePermId(pid);
              const found = permissions.find((p) => p.id === pid);
              if (found) {
                setPolAction(found.action);
                setPolResource(`${found.resource_type}:*`);
              }
            }}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            <option value="">Custom / Wildcard (*)</option>
            {permissions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.action}:{p.resource_type} — {p.description}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Role</label>
            <select
              value={polRole}
              onChange={(e) => {
                const nextRole = e.target.value;
                setPolRole(nextRole);
                if (nextRole === 'ADMIN') setPolEft('ALLOW');
              }}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Jenis Aturan</label>
            <select
              value={polEft}
              onChange={(e) => setPolEft(e.target.value as 'ALLOW' | 'DENY')}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              <option value="ALLOW">ALLOW</option>
              <option value="DENY" disabled={polRole === 'ADMIN'}>
                DENY {polRole === 'ADMIN' ? '(Diblokir untuk ADMIN)' : ''}
              </option>
            </select>
          </div>
        </div>
        <Input label="Action" value={polAction} onChange={(e) => setPolAction(e.target.value)} required />
        <Input label="Resource Pattern" value={polResource} onChange={(e) => setPolResource(e.target.value)} required />
        <div>
          <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
            <FileCode2 className="w-3.5 h-3.5" /> Syarat Kondisi Tambahan (Opsional)
          </label>
          <textarea
            rows={2}
            value={polAbacJson}
            onChange={(e) => setPolAbacJson(e.target.value)}
            placeholder='{"line_id": "LINE-01"}'
            className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          />
        </div>
        <Input label="Alasan / Keterangan" value={polReason} onChange={(e) => setPolReason(e.target.value)} />
      </form>
    </Modal>
  );
};
