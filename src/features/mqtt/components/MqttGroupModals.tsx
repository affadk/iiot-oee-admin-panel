import { useEffect, useState } from 'react';
import type { MqttClient, MqttGroup, MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (groupname: string) => Promise<boolean>;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ open, onClose, onSubmit }) => {
  const [newGroupName, setNewGroupName] = useState('');

  const submit = async () => {
    const ok = await onSubmit(newGroupName);
    if (ok) {
      onClose();
      setNewGroupName('');
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Buat MQTT Group Baru"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void submit()}>Buat Group</Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />
      </form>
    </Modal>
  );
};

interface ManageGroupMembersModalProps {
  targetGroup: MqttGroup | null;
  clients: MqttClient[];
  roles: MqttRole[];
  onClose: () => void;
  onAddClient: (groupname: string, username: string) => Promise<boolean>;
  onAddRole: (groupname: string, rolename: string) => Promise<boolean>;
}

export const ManageGroupMembersModal: React.FC<ManageGroupMembersModalProps> = ({
  targetGroup,
  clients,
  roles,
  onClose,
  onAddClient,
  onAddRole,
}) => {
  const [groupAddUsername, setGroupAddUsername] = useState('');
  const [groupAddRolename, setGroupAddRolename] = useState('');

  // Default milik form, diinisialisasi saat modal dibuka dari daftar clients/
  // roles — bukan dari loader (perbaikan bug stale-closure loadAll, R9.5 §5a).
  useEffect(() => {
    if (targetGroup) {
      setGroupAddUsername(clients[0]?.username ?? '');
      setGroupAddRolename(roles[0]?.rolename ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetGroup]);

  return (
    <Modal
      isOpen={Boolean(targetGroup)}
      onClose={onClose}
      title={`Anggota Group ${targetGroup?.groupname ?? ''}`}
      footer={
        <Button variant="ghost" onClick={onClose}>Tutup</Button>
      }
    >
      {targetGroup && (
        <div className="space-y-4 text-xs">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block font-semibold mb-1">Tambah Client ke Group</label>
              <select
                value={groupAddUsername}
                onChange={(e) => setGroupAddUsername(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
              >
                {clients.map((c) => (
                  <option key={c.username} value={c.username}>
                    {c.username}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const ok = await onAddClient(targetGroup.groupname, groupAddUsername);
                if (ok) onClose();
              }}
            >
              + Client
            </Button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block font-semibold mb-1">Tambah Role ke Group</label>
              <select
                value={groupAddRolename}
                onChange={(e) => setGroupAddRolename(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
              >
                {roles.map((r) => (
                  <option key={r.rolename} value={r.rolename}>
                    {r.rolename}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const ok = await onAddRole(targetGroup.groupname, groupAddRolename);
                if (ok) onClose();
              }}
            >
              + Role
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
