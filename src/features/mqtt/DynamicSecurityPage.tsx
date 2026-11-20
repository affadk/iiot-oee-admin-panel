import React, { useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import type { MqttClient, MqttGroup, MqttRole } from '../../types/mqtt';
import { useCapability } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { useDynamicSecurityData } from './hooks/useDynamicSecurityData';
import { useMqttClientMutations } from './hooks/useMqttClientMutations';
import { useMqttRoleMutations } from './hooks/useMqttRoleMutations';
import { useMqttGroupMutations } from './hooks/useMqttGroupMutations';
import { DynSecClientsTab } from './components/DynSecClientsTab';
import { DynSecRolesTab } from './components/DynSecRolesTab';
import { DynSecGroupsTab } from './components/DynSecGroupsTab';
import { CreateMqttClientModal } from './components/CreateMqttClientModal';
import { OneTimeSecretModal } from './components/OneTimeSecretModal';
import { AttachRoleModal } from './components/AttachRoleModal';
import { RotatePasswordModal } from './components/RotatePasswordModal';
import { AddAclModal } from './components/AddAclModal';
import { CreateRoleModal } from './components/CreateRoleModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { ManageGroupMembersModal } from './components/ManageGroupMembersModal';

type DynTab = 'clients' | 'roles' | 'groups';

export const DynamicSecurityPage: React.FC = () => {
  const canManage = useCapability('mqtt.dynsec.manage');

  const [activeTab, setActiveTab] = useState<DynTab>('clients');

  const data = useDynamicSecurityData();
  const { clients, roles, groups, isLoading, feedback } = data;

  // SATU instansi refreshAfterMutation dipakai bersama data + semua hook
  // mutasi (E28 Batch A, FAT-227 MUT-01 — ganti loadAll mentah).
  const clientMutations = useMqttClientMutations({ refreshAfterMutation: data.refreshAfterMutation, setFeedback: data.setFeedback });
  const roleMutations = useMqttRoleMutations({ refreshAfterMutation: data.refreshAfterMutation, setFeedback: data.setFeedback });
  const groupMutations = useMqttGroupMutations({ refreshAfterMutation: data.refreshAfterMutation, setFeedback: data.setFeedback });

  // Page hanya menyimpan flag buka + target; form state milik modal masing-masing.
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [pwdClient, setPwdClient] = useState<MqttClient | null>(null);
  const [roleClient, setRoleClient] = useState<MqttClient | null>(null);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [aclTargetRole, setAclTargetRole] = useState<MqttRole | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupManageTarget, setGroupManageTarget] = useState<MqttGroup | null>(null);

  if (!canManage.canInteract && clients.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses MQTT Dynamic Security Terkunci</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {canManage.reason || 'Halaman manajemen MQTT Dynamic Security hanya tersedia untuk ADMIN.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            MQTT Dynamic Security (Clients, Roles, ACLs &amp; Groups)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Setiap perangkat baru wajib diberi peran akses atau dipilih langsung ID Perangkat serta jenis izin komunikasinya.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'clients' && (
            <Button
              size="sm"
              disabled={!canManage.canInteract}
              title={!canManage.canInteract ? canManage.reason : 'Buat MQTT Client'}
              onClick={() => setIsCreateClientOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Create MQTT Client</span>
            </Button>
          )}
          {activeTab === 'roles' && (
            <Button size="sm" disabled={!canManage.canInteract} onClick={() => setIsCreateRoleOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Create MQTT Role</span>
            </Button>
          )}
          {activeTab === 'groups' && (
            <Button size="sm" disabled={!canManage.canInteract} onClick={() => setIsCreateGroupOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Create MQTT Group</span>
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={data.dismissFeedback} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(
          [
            ['clients', `Clients (${clients.length})`],
            ['roles', `Roles & ACLs (${roles.length})`],
            ['groups', `Groups (${groups.length})`],
          ] as Array<[DynTab, string]>
        ).map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setActiveTab(k)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
              activeTab === k
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Memuat Dynamic Security...</div>
      ) : (
        <>
          {activeTab === 'clients' && (
            <DynSecClientsTab
              clients={clients}
              canManage={canManage}
              onToggleClient={clientMutations.toggleClient}
              onDeleteClient={clientMutations.deleteClient}
              onDetachRole={clientMutations.detachRole}
              onOpenAttachRole={setRoleClient}
              onOpenRotatePassword={setPwdClient}
            />
          )}

          {activeTab === 'roles' && (
            <DynSecRolesTab
              roles={roles}
              canManage={canManage}
              onOpenAddAcl={setAclTargetRole}
              onDeleteRole={roleMutations.deleteRole}
              onRemoveAcl={roleMutations.removeAcl}
            />
          )}

          {activeTab === 'groups' && (
            <DynSecGroupsTab
              groups={groups}
              canManage={canManage}
              onOpenManage={setGroupManageTarget}
              onDeleteGroup={groupMutations.deleteGroup}
            />
          )}
        </>
      )}

      <CreateMqttClientModal
        open={isCreateClientOpen}
        onClose={() => setIsCreateClientOpen(false)}
        roles={roles}
        onSubmit={clientMutations.createClient}
      />

      <OneTimeSecretModal secret={clientMutations.oneTimeSecret} onClose={clientMutations.clearOneTimeSecret} />

      <RotatePasswordModal
        client={pwdClient}
        onClose={() => setPwdClient(null)}
        onSubmit={clientMutations.rotatePassword}
      />

      <AttachRoleModal
        client={roleClient}
        roles={roles}
        onClose={() => setRoleClient(null)}
        onSubmit={clientMutations.attachRole}
      />

      <CreateRoleModal
        open={isCreateRoleOpen}
        onClose={() => setIsCreateRoleOpen(false)}
        onSubmit={roleMutations.createRole}
      />

      <AddAclModal targetRole={aclTargetRole} onClose={() => setAclTargetRole(null)} onSubmit={roleMutations.addAcl} />

      <CreateGroupModal
        open={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSubmit={groupMutations.createGroup}
      />

      <ManageGroupMembersModal
        targetGroup={groupManageTarget}
        clients={clients}
        roles={roles}
        onClose={() => setGroupManageTarget(null)}
        onAddClient={groupMutations.addGroupClient}
        onAddRole={groupMutations.addGroupRole}
      />
    </div>
  );
};
