import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  Users,
  Lock,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { MqttClient, MqttRole, MqttGroup, MqttAcl } from '../../types/mqtt';
import { ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

type DynTab = 'clients' | 'roles' | 'groups';

export const DynamicSecurityPage: React.FC = () => {
  const { reportForbidden } = useAuth();
  const canManage = useCapability('mqtt.dynsec.manage');

  const [activeTab, setActiveTab] = useState<DynTab>('clients');
  const [clients, setClients] = useState<MqttClient[]>([]);
  const [roles, setRoles] = useState<MqttRole[]>([]);
  const [groups, setGroups] = useState<MqttGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Create Client Modal (Mode 1: explicit roles[], Mode 2: deviceId + access)
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'device' | 'roles'>('device');
  const [cUsername, setCUsername] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cDeviceId, setCDeviceId] = useState('STM32-OEE-06');
  const [cAccess, setCAccess] = useState<'publish' | 'subscribe' | 'readwrite'>('publish');
  const [cRoles, setCRoles] = useState<string[]>(['edge_publisher']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time Generated Password Modal (cleared on close)
  const [oneTimeSecret, setOneTimeSecret] = useState<{ username: string; secret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Client Password Rotation Modal
  const [pwdClient, setPwdClient] = useState<MqttClient | null>(null);
  const [newClientPwd, setNewClientPwd] = useState('');

  // Client Attach Role Modal
  const [roleClient, setRoleClient] = useState<MqttClient | null>(null);
  const [attachRoleName, setAttachRoleName] = useState('edge_publisher');

  // Create Role & ACL Modals
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [aclTargetRole, setAclTargetRole] = useState<MqttRole | null>(null);
  const [aclType, setAclType] = useState<MqttAcl['acltype']>('publishClientSend');
  const [aclTopic, setAclTopic] = useState('oee/edge/+/telemetry');
  const [aclAllow, setAclAllow] = useState(true);

  // Create Group & Manage Group Modals
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupManageTarget, setGroupManageTarget] = useState<MqttGroup | null>(null);
  const [groupAddUsername, setGroupAddUsername] = useState('');
  const [groupAddRolename, setGroupAddRolename] = useState('');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cList, rList, gList] = await Promise.all([
        apiClient.getMqttClients(),
        apiClient.getMqttRoles(),
        apiClient.getMqttGroups(),
      ]);
      setClients(cList);
      setRoles(rList);
      setGroups(gList);
      if (rList.length > 0) {
        setAttachRoleName(rList[0].rolename);
        setGroupAddRolename(rList[0].rolename);
      }
      if (cList.length > 0 && !groupAddUsername) {
        setGroupAddUsername(cList[0].username);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.dynsec.manage', undefined, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat data MQTT Dynamic Security.' });
    } finally {
      setIsLoading(false);
    }
  }, [reportForbidden]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const result = await apiClient.createMqttClient({
        username: cUsername.trim(),
        password: cPassword.trim() || undefined,
        ...(createMode === 'device'
          ? { deviceId: cDeviceId.trim(), access: cAccess }
          : { roles: cRoles }),
      });
      setIsCreateClientOpen(false);
      setCUsername('');
      setCPassword('');
      if (result.generatedPassword) {
        setOneTimeSecret({
          username: result.client.username,
          secret: result.generatedPassword,
        });
        setCopiedSecret(false);
      } else {
        setFeedback({ type: 'success', msg: `MQTT Client "${result.client.username}" berhasil dibuat.` });
      }
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat MQTT client.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleClient = async (c: MqttClient) => {
    try {
      await apiClient.toggleMqttClient(c.username, !c.enabled);
      await loadAll();
      setFeedback({ type: 'success', msg: `Client ${c.username} di-${!c.enabled ? 'aktifkan' : 'nonaktifkan'}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal mengubah status client.' });
    }
  };

  const handleDeleteClient = async (username: string) => {
    try {
      await apiClient.deleteMqttClient(username);
      await loadAll();
      setFeedback({ type: 'success', msg: `Client ${username} dihapus.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus client.' });
    }
  };

  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdClient) return;
    try {
      await apiClient.rotateMqttClientPassword(pwdClient.username, newClientPwd);
      setFeedback({ type: 'success', msg: `Password MQTT untuk ${pwdClient.username} dirotasi.` });
      setPwdClient(null);
      setNewClientPwd('');
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal merotasi password MQTT.' });
    }
  };

  const handleAttachRoleToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleClient || !attachRoleName) return;
    try {
      await apiClient.addMqttClientRole(roleClient.username, attachRoleName);
      setRoleClient(null);
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menambah role client.' });
    }
  };

  const handleDetachRoleFromClient = async (username: string, rolename: string) => {
    try {
      await apiClient.removeMqttClientRole(username, rolename);
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal melepas role client.' });
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createMqttRole({
        rolename: newRoleName.trim(),
        textdescription: newRoleDesc.trim(),
        acls: [],
      });
      setIsCreateRoleOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat MQTT role.' });
    }
  };

  const handleAddAcl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aclTargetRole) return;
    try {
      await apiClient.addMqttRoleAcl(aclTargetRole.rolename, {
        acltype: aclType,
        topic: aclTopic.trim(),
        allow: aclAllow,
      });
      setAclTargetRole(null);
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menambahkan ACL.' });
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createMqttGroup({
        groupname: newGroupName.trim(),
        clients: [],
        roles: [],
      });
      setIsCreateGroupOpen(false);
      setNewGroupName('');
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat MQTT group.' });
    }
  };

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
          <button type="button" onClick={() => setFeedback(null)} className="font-bold px-1.5 cursor-pointer">
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
          {/* CLIENTS TAB */}
          {activeTab === 'clients' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="py-3 px-4">Username / Client ID</th>
                    <th className="py-3 px-4">Roles (Attach / Detach)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clients.map((c) => (
                    <tr key={c.username}>
                      <td className="py-3 px-4 font-tabular">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{c.username}</div>
                        <div className="text-[11px] text-slate-500">{c.clientid || c.textname || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.roles.map((r) => (
                            <span
                              key={r}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[11px] font-mono"
                            >
                              {r}
                              {canManage.canInteract && (
                                <button
                                  type="button"
                                  aria-label={`Detach role ${r}`}
                                  onClick={() => handleDetachRoleFromClient(c.username, r)}
                                  className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                          {canManage.canInteract && (
                            <button
                              type="button"
                              onClick={() => setRoleClient(c)}
                              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
                            >
                              + Role
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={c.enabled ? 'success' : 'danger'}>
                          {c.enabled ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canManage.canInteract}
                          onClick={() => handleToggleClient(c)}
                        >
                          {c.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canManage.canInteract}
                          onClick={() => {
                            setPwdClient(c);
                            setNewClientPwd('');
                          }}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!canManage.canInteract}
                          onClick={() => handleDeleteClient(c.username)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ROLES TAB */}
          {activeTab === 'roles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((r) => (
                <div
                  key={r.rolename}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-sky-500" />
                        <span>{r.rolename}</span>
                      </div>
                      <p className="text-slate-500 mt-0.5">{r.textdescription || r.textname || 'MQTT Role'}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" disabled={!canManage.canInteract} onClick={() => setAclTargetRole(r)}>
                        + ACL
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canManage.canInteract}
                        onClick={() => apiClient.deleteMqttRole(r.rolename).then(loadAll)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {r.acls.length === 0 ? (
                      <div className="text-slate-400 italic">Belum ada aturan topik komunikasi (akses dibatasi secara bawaan).</div>
                    ) : (
                      r.acls.map((a, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-800/50 font-mono text-[11px]">
                          <div>
                            <Badge variant={a.allow ? 'success' : 'danger'}>{a.allow ? 'ALLOW' : 'DENY'}</Badge>{' '}
                            <span className="ml-1 text-slate-500">{a.acltype}</span>{' '}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{a.topic}</span>
                          </div>
                          {canManage.canInteract && (
                            <button
                              type="button"
                              onClick={() => apiClient.removeMqttRoleAcl(r.rolename, a.acltype, a.topic).then(loadAll)}
                              className="text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GROUPS TAB */}
          {activeTab === 'groups' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((g) => (
                <div
                  key={g.groupname}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-sky-500" />
                      <span>{g.groupname}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" disabled={!canManage.canInteract} onClick={() => setGroupManageTarget(g)}>
                        Kelola Anggota
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canManage.canInteract}
                        onClick={() => apiClient.deleteMqttGroup(g.groupname).then(loadAll)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[11px] space-y-1">
                    <div>
                      <span className="text-slate-400">Clients: </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {g.clients.length > 0 ? g.clients.join(', ') : '(kosong)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Roles: </span>
                      <span className="font-mono text-sky-600 dark:text-sky-400">
                        {g.roles.length > 0 ? g.roles.join(', ') : '(kosong)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Client Modal */}
      <Modal
        isOpen={isCreateClientOpen}
        onClose={() => setIsCreateClientOpen(false)}
        title="Buat Akun Akses Perangkat MQTT Baru"
        subtitle="Kosongkan kata sandi jika ingin sistem membuatkan kata sandi acak otomatis (hanya tampil satu kali)."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsCreateClientOpen(false)}>Batal</Button>
            <Button onClick={handleCreateClient} isLoading={isSubmitting}>Buat Client</Button>
          </div>
        }
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <Input
            label="MQTT Username"
            value={cUsername}
            onChange={(e) => setCUsername(e.target.value)}
            placeholder="edge-stm32-06"
            required
          />
          <Input
            label="Kata Sandi Kustom (Opsional — kosongkan untuk buat otomatis)"
            type="password"
            value={cPassword}
            onChange={(e) => setCPassword(e.target.value)}
            placeholder="Kosongkan agar sistem membuat kata sandi otomatis"
          />
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setCreateMode('device')}
              className={`px-3 py-1.5 rounded border font-semibold cursor-pointer ${
                createMode === 'device' ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              Mode: Device ID + Access
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('roles')}
              className={`px-3 py-1.5 rounded border font-semibold cursor-pointer ${
                createMode === 'roles' ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              Mode: Pilih Roles Eksplisit
            </button>
          </div>
          {createMode === 'device' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Device ID" value={cDeviceId} onChange={(e) => setCDeviceId(e.target.value)} required />
              <div>
                <label className="block text-xs font-semibold mb-1">Access Scope</label>
                <select
                  value={cAccess}
                  onChange={(e) => setCAccess(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                >
                  <option value="publish">publish</option>
                  <option value="subscribe">subscribe</option>
                  <option value="readwrite">readwrite</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">Roles (Min. 1)</label>
              {roles.map((r) => (
                <label key={r.rolename} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cRoles.includes(r.rolename)}
                    onChange={(e) =>
                      setCRoles((prev) =>
                        e.target.checked ? [...prev, r.rolename] : prev.filter((x) => x !== r.rolename)
                      )
                    }
                  />
                  <span className="font-mono">{r.rolename}</span>
                </label>
              ))}
            </div>
          )}
        </form>
      </Modal>

      {/* One-Time Generated Password Modal (strictly wiped on close) */}
      <Modal
        isOpen={Boolean(oneTimeSecret)}
        onClose={() => {
          setOneTimeSecret(null);
          setCopiedSecret(false);
        }}
        title="Kata Sandi Akses Sekali Tampil"
        subtitle={`Kata sandi untuk perangkat "${oneTimeSecret?.username ?? ''}" hanya ditampilkan satu kali dan tidak dapat dilihat kembali setelah ditutup.`}
        footer={
          <Button
            onClick={() => {
              setOneTimeSecret(null);
              setCopiedSecret(false);
            }}
          >
            Tutup &amp; Hapus dari Layar
          </Button>
        }
      >
        {oneTimeSecret && (
          <div className="space-y-3">
            <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>Salin kata sandi di bawah ini ke pengaturan perangkat sekarang. Setelah dialog ditutup, kata sandi tidak akan ditampilkan kembali.</span>
            </div>
            <div className="p-3 rounded bg-slate-950 text-emerald-400 font-mono text-xs flex items-center justify-between gap-2 border border-slate-800">
              <span className="flex items-center gap-2 break-all">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                {oneTimeSecret.secret}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(oneTimeSecret.secret);
                  setCopiedSecret(true);
                }}
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSecret ? 'Disalin' : 'Salin'}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Rotate Password Modal */}
      <Modal
        isOpen={Boolean(pwdClient)}
        onClose={() => setPwdClient(null)}
        title={`Rotasi Password MQTT: ${pwdClient?.username ?? ''}`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPwdClient(null)}>Batal</Button>
            <Button onClick={handleRotatePassword}>Simpan Password</Button>
          </div>
        }
      >
        <form onSubmit={handleRotatePassword}>
          <Input
            label="Password MQTT Baru (min. 8 karakter)"
            type="password"
            value={newClientPwd}
            onChange={(e) => setNewClientPwd(e.target.value)}
            required
          />
        </form>
      </Modal>

      {/* Attach Role to Client Modal */}
      <Modal
        isOpen={Boolean(roleClient)}
        onClose={() => setRoleClient(null)}
        title={`Attach Role ke ${roleClient?.username ?? ''}`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setRoleClient(null)}>Batal</Button>
            <Button onClick={handleAttachRoleToClient}>Attach</Button>
          </div>
        }
      >
        <form onSubmit={handleAttachRoleToClient}>
          <select
            value={attachRoleName}
            onChange={(e) => setAttachRoleName(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
          >
            {roles.map((r) => (
              <option key={r.rolename} value={r.rolename}>
                {r.rolename}
              </option>
            ))}
          </select>
        </form>
      </Modal>

      {/* Create Role Modal */}
      <Modal
        isOpen={isCreateRoleOpen}
        onClose={() => setIsCreateRoleOpen(false)}
        title="Buat MQTT Role Baru"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsCreateRoleOpen(false)}>Batal</Button>
            <Button onClick={handleCreateRole}>Simpan Role</Button>
          </div>
        }
      >
        <form onSubmit={handleCreateRole} className="space-y-3">
          <Input label="Role Name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
          <Input label="Deskripsi" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} />
        </form>
      </Modal>

      {/* Add ACL Modal */}
      <Modal
        isOpen={Boolean(aclTargetRole)}
        onClose={() => setAclTargetRole(null)}
        title={`Tambah ACL untuk Role ${aclTargetRole?.rolename ?? ''}`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setAclTargetRole(null)}>Batal</Button>
            <Button onClick={handleAddAcl}>Tambah ACL</Button>
          </div>
        }
      >
        <form onSubmit={handleAddAcl} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">ACL Type</label>
            <select
              value={aclType}
              onChange={(e) => setAclType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              <option value="publishClientSend">publishClientSend</option>
              <option value="publishClientReceive">publishClientReceive</option>
              <option value="subscribeLiteral">subscribeLiteral</option>
              <option value="subscribePattern">subscribePattern</option>
              <option value="unsubscribeLiteral">unsubscribeLiteral</option>
              <option value="unsubscribePattern">unsubscribePattern</option>
            </select>
          </div>
          <Input label="Topic Pattern" value={aclTopic} onChange={(e) => setAclTopic(e.target.value)} required />
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={aclAllow} onChange={(e) => setAclAllow(e.target.checked)} />
            <span>ALLOW (hilangkan centang untuk DENY eksplisit)</span>
          </label>
        </form>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        title="Buat MQTT Group Baru"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsCreateGroupOpen(false)}>Batal</Button>
            <Button onClick={handleCreateGroup}>Buat Group</Button>
          </div>
        }
      >
        <form onSubmit={handleCreateGroup}>
          <Input label="Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />
        </form>
      </Modal>

      {/* Manage Group Members Modal */}
      <Modal
        isOpen={Boolean(groupManageTarget)}
        onClose={() => setGroupManageTarget(null)}
        title={`Anggota Group ${groupManageTarget?.groupname ?? ''}`}
        footer={
          <Button variant="ghost" onClick={() => setGroupManageTarget(null)}>Tutup</Button>
        }
      >
        {groupManageTarget && (
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
                  await apiClient.addMqttGroupClient(groupManageTarget.groupname, groupAddUsername);
                  await loadAll();
                  setGroupManageTarget(null);
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
                  await apiClient.addMqttGroupRole(groupManageTarget.groupname, groupAddRolename);
                  await loadAll();
                  setGroupManageTarget(null);
                }}
              >
                + Role
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
