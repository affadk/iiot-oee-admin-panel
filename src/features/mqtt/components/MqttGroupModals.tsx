import { useEffect, useState } from 'react';
import type { MqttClient, MqttGroup, MqttRole } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

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
            <Select
              label="Tambah Client ke Group"
              value={groupAddUsername}
              onChange={(e) => setGroupAddUsername(e.target.value)}
              options={clients.map((c) => ({ value: c.username, label: c.username }))}
            />
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
            <Select
              label="Tambah Role ke Group"
              value={groupAddRolename}
              onChange={(e) => setGroupAddRolename(e.target.value)}
              options={roles.map((r) => ({ value: r.rolename, label: r.rolename }))}
            />
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
