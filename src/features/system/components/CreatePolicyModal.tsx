import { useEffect, useState } from 'react';
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
 * Modal Tambah Aturan Kebijakan Baru. Field form milik modal; memilih
 * permission dari katalog mengikat action + mengisi resource pattern default
 * (`<resourceType>:*`). Role ADMIN memaksa effect ALLOW. Sukses hanya
 * membersihkan abacJson. Body tulis kanonis (§3.4): policy terikat pada
 * `permissionId` — action TIDAK bisa diisi bebas.
 */
export const CreatePolicyModal: React.FC<CreatePolicyModalProps> = ({
  isOpen,
  isSubmitting,
  roles,
  permissions,
  onClose,
  onSubmit,
}) => {
  const [polRoleId, setPolRoleId] = useState('');
  const [polPermId, setPolPermId] = useState('');
  const [polEffect, setPolEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [polResourcePattern, setPolResourcePattern] = useState('telemetry:*');
  const [polAbacJson, setPolAbacJson] = useState('');

  // Default hanya bila kosong: role pertama + permission pertama.
  useEffect(() => {
    if (!polRoleId && roles.length > 0) setPolRoleId(roles[0].id);
  }, [roles, polRoleId]);
  useEffect(() => {
    if (!polPermId && permissions.length > 0) {
      const first = permissions[0];
      setPolPermId(first.id);
      setPolResourcePattern(`${first.resourceType}:*`);
    }
  }, [permissions, polPermId]);

  const selectedRole = roles.find((r) => r.id === polRoleId);
  const selectedPerm = permissions.find((p) => p.id === polPermId);

  const submit = async () => {
    if (isSubmitting) return;
    if (!selectedRole || !selectedPerm) return;
    const ok = await onSubmit({
      roleId: selectedRole.id,
      roleName: selectedRole.name,
      permissionId: selectedPerm.id,
      effect: polEffect,
      resourcePattern: polResourcePattern,
      abacJson: polAbacJson,
    });
    if (ok) {
      setPolAbacJson('');
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
            Permission (Katalog)
          </label>
          <select
            value={polPermId}
            onChange={(e) => {
              const pid = e.target.value;
              setPolPermId(pid);
              const found = permissions.find((p) => p.id === pid);
              if (found) {
                setPolResourcePattern(`${found.resourceType}:*`);
              }
            }}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            {permissions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.action}:{p.resourceType} — {p.description}
              </option>
            ))}
          </select>
          {selectedPerm && (
            <p className="text-[11px] text-slate-500 mt-1">
              Action terikat: <code className="font-mono">{selectedPerm.action}</code> (tidak bisa diubah — ikatan permission).
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Role</label>
            <select
              value={polRoleId}
              onChange={(e) => {
                const nextRoleId = e.target.value;
                setPolRoleId(nextRoleId);
                const nextRole = roles.find((r) => r.id === nextRoleId);
                if (nextRole?.name === 'ADMIN') setPolEffect('ALLOW');
              }}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Jenis Aturan</label>
            <select
              value={polEffect}
              onChange={(e) => setPolEffect(e.target.value as 'ALLOW' | 'DENY')}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              <option value="ALLOW">ALLOW</option>
              <option value="DENY" disabled={selectedRole?.name === 'ADMIN'}>
                DENY {selectedRole?.name === 'ADMIN' ? '(Diblokir untuk ADMIN)' : ''}
              </option>
            </select>
          </div>
        </div>
        <Input label="Resource Pattern" value={polResourcePattern} onChange={(e) => setPolResourcePattern(e.target.value)} required />
        <div>
          <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
            <FileCode2 className="w-3.5 h-3.5" /> Syarat Kondisi Tambahan (Opsional)
          </label>
          <textarea
            rows={2}
            value={polAbacJson}
            onChange={(e) => setPolAbacJson(e.target.value)}
            placeholder='{"attr": "subject.line_id", "eq": "LINE-01"}'
            className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          />
        </div>
      </form>
    </Modal>
  );
};
