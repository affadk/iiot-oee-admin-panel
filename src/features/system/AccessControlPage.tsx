import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Key,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Edit3,
  X,
  Eye,
  Lock,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import {
  IamInfo,
  IamRole,
  IamPermission,
  IamAssignment,
  IamPolicyRule,
  IamAuditDecision,
  IamEffectivePermissions,
  ScopeLevel,
} from '../../types/iam';
import { Operator } from '../../types/production';
import { ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import {
  CUSTOM_ROLE_MAX_LEVEL,
  VALIDATION_PATTERNS,
  isReservedPermission,
  policyTargetsAdmin,
} from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';

type IamTab = 'roles' | 'assignments' | 'policies' | 'permissions' | 'inspector' | 'audit';

export const AccessControlPage: React.FC = () => {
  const { reportForbidden, refreshCapabilities } = useAuth();
  const canManage = useCapability('access_control.manage');
  const [searchParams] = useSearchParams();

  const initialTabParam = searchParams.get('tab') as IamTab | null;
  const initialOpParam = searchParams.get('operator');

  const [activeTab, setActiveTab] = useState<IamTab>(
    initialTabParam && ['roles', 'assignments', 'policies', 'permissions', 'inspector', 'audit'].includes(initialTabParam)
      ? initialTabParam
      : 'roles'
  );
  const [iamInfo, setIamInfo] = useState<IamInfo | null>(null);
  const [roles, setRoles] = useState<IamRole[]>([]);
  const [permissions, setPermissions] = useState<IamPermission[]>([]);
  const [assignments, setAssignments] = useState<IamAssignment[]>([]);
  const [policies, setPolicies] = useState<IamPolicyRule[]>([]);
  const [decisions, setDecisions] = useState<IamAuditDecision[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filters
  const [roleFilterQuery, setRoleFilterQuery] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [policySearch, setPolicySearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Role Detail Modal (Workflow A & B)
  const [detailRoleId, setDetailRoleId] = useState<string | null>(null);

  // Create & Edit Role Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleLevel, setRoleLevel] = useState(25);
  const [roleDesc, setRoleDesc] = useState('');
  const [roleFormErrors, setRoleFormErrors] = useState<Record<string, string>>({});
  const [editRoleTarget, setEditRoleTarget] = useState<IamRole | null>(null);
  const [editRoleLevel, setEditRoleLevel] = useState(25);
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [editRoleErrors, setEditRoleErrors] = useState<Record<string, string>>({});

  // Confirmation Dialog Targets
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<IamRole | null>(null);
  const [unbindTarget, setUnbindTarget] = useState<{ role: IamRole; permissionId: string; label: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IamAssignment | null>(null);
  const [deletePolicyTarget, setDeletePolicyTarget] = useState<IamPolicyRule | null>(null);

  // Assign / Bind Permission to Role Modal (shared from Role card, Role Detail, or Permission card)
  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [bindLockedMode, setBindLockedMode] = useState<'role' | 'permission' | null>(null);
  const [bindRoleId, setBindRoleId] = useState('');
  const [selectedPermId, setSelectedPermId] = useState('');
  const [bindResourcePattern, setBindResourcePattern] = useState('');
  const [bindEffect, setBindEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [bindAbacJson, setBindAbacJson] = useState('');
  const [bindReason, setBindReason] = useState('');

  // Permissions Catalog Filter & Search
  const [permDomainFilter, setPermDomainFilter] = useState<string>('ALL');
  const [permSearchQuery, setPermSearchQuery] = useState('');

  // Assign Role Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignOperatorId, setAssignOperatorId] = useState('');
  const [assignRoleName, setAssignRoleName] = useState('SUPERVISOR');
  const [assignScopeType, setAssignScopeType] = useState<ScopeLevel>('ORGANIZATION');
  const [assignScopeId, setAssignScopeId] = useState('');

  // Create & Edit Policy Modal
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [polTemplatePermId, setPolTemplatePermId] = useState('');
  const [polRole, setPolRole] = useState('SUPERVISOR');
  const [polEft, setPolEft] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [polAction, setPolAction] = useState('read');
  const [polResource, setPolResource] = useState('telemetry:*');
  const [polAbacJson, setPolAbacJson] = useState('');
  const [polReason, setPolReason] = useState('');
  const [editPolicyTarget, setEditPolicyTarget] = useState<IamPolicyRule | null>(null);
  const [editPolEft, setEditPolEft] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [editPolAction, setEditPolAction] = useState('');
  const [editPolResource, setEditPolResource] = useState('');
  const [editPolAbacJson, setEditPolAbacJson] = useState('');
  const [editPolReason, setEditPolReason] = useState('');

  // Debug Effective Permissions Inspector
  const [inspectOperatorId, setInspectOperatorId] = useState(initialOpParam || 'SUP-042');
  const [effectivePerms, setEffectivePerms] = useState<IamEffectivePermissions | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  const reportError = useCallback(
    (err: unknown, fallbackMsg: string, resourceId?: string) => {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('access_control.manage', resourceId, err.message);
      }
      const message = err instanceof Error ? err.message : fallbackMsg;
      setFeedback({ type: 'error', msg: message || fallbackMsg });
    },
    [reportForbidden]
  );

  const loadIamData = useCallback(async (): Promise<IamInfo | null> => {
    if (!canManage.canInteract) {
      setIsLoading(false);
      return null;
    }
    setIsLoading(true);
    try {
      const [info, rList, pList, aList, polList, decList, opList] = await Promise.all([
        apiClient.getIamInfo(),
        apiClient.getIamRoles(),
        apiClient.getIamPermissions(),
        apiClient.getIamUserRoles(),
        apiClient.getIamPolicies(),
        apiClient.getIamAuditDecisions(),
        apiClient.getOperators(),
      ]);
      setIamInfo(info);
      setRoles(rList);
      setPermissions(pList);
      setAssignments(aList);
      setPolicies(polList);
      setDecisions(decList);
      setOperators(opList);
      if (opList.length > 0) {
        setAssignOperatorId((prev) => prev || opList[0].operator_id);
      }
      if (pList.length > 0) {
        setSelectedPermId((prev) => prev || pList[0].id);
      }
      return info;
    } catch (err: unknown) {
      reportError(err, 'Gagal memuat data hak akses pengguna.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [canManage.canInteract, reportError]);

  useEffect(() => {
    void loadIamData();
  }, [loadIamData]);

  useEffect(() => {
    if (initialOpParam && activeTab === 'inspector' && canManage.canInteract && operators.length > 0) {
      setInspectOperatorId(initialOpParam);
      void apiClient
        .getSubjectEffectivePermissions(initialOpParam)
        .then(setEffectivePerms)
        .catch(() => undefined);
    }
  }, [initialOpParam, activeTab, canManage.canInteract, operators.length]);

  const handleAfterMutation = async (msg: string, bumpsAuthz = true) => {
    const info = await loadIamData();
    await refreshCapabilities();
    const advisory =
      bumpsAuthz && info
        ? ` Pembaruan kebijakan menaikkan authz_version ke #${info.authzVersion} — sesi lain dengan token lama akan berakhir (401) dan perlu login ulang.`
        : '';
    setFeedback({ type: 'success', msg: `${msg}${advisory}` });
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    const trimmedName = roleName.trim();
    const trimmedDesc = roleDesc.trim();

    if (!VALIDATION_PATTERNS.IAM_ROLE_NAME.test(trimmedName)) {
      errors.name = 'Nama role wajib diawali huruf, panjang 2–64 karakter (huruf, angka, "_", "-").';
    }
    if (!Number.isInteger(Number(roleLevel)) || Number(roleLevel) > CUSTOM_ROLE_MAX_LEVEL || Number(roleLevel) < 1) {
      errors.privilege_level = `Level custom role wajib bilangan bulat 1–${CUSTOM_ROLE_MAX_LEVEL}.`;
    }
    if (trimmedDesc.length < 3 || trimmedDesc.length > 256) {
      errors.description = 'Deskripsi wajib 3–256 karakter.';
    }
    if (Object.keys(errors).length > 0) {
      setRoleFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setRoleFormErrors({});
    try {
      const created = await apiClient.createIamRole({
        name: trimmedName,
        privilege_level: Number(roleLevel),
        description: trimmedDesc,
      });
      setIsRoleModalOpen(false);
      setRoleName('');
      setRoleDesc('');
      setRoleLevel(25);
      await handleAfterMutation(`Custom role "${created.name}" berhasil dibuat.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal membuat custom role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoleTarget || isSubmitting) return;
    if (editRoleTarget.is_system) {
      setFeedback({ type: 'error', msg: 'Role sistem dilindungi dan tidak dapat diubah.' });
      return;
    }
    const errors: Record<string, string> = {};
    if (!Number.isInteger(Number(editRoleLevel)) || Number(editRoleLevel) > CUSTOM_ROLE_MAX_LEVEL || Number(editRoleLevel) < 1) {
      errors.privilege_level = `Privilege level custom role wajib 1–${CUSTOM_ROLE_MAX_LEVEL}.`;
    }
    if (editRoleDesc.trim().length < 3 || editRoleDesc.trim().length > 256) {
      errors.description = 'Deskripsi wajib 3–256 karakter.';
    }
    if (Object.keys(errors).length > 0) {
      setEditRoleErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setEditRoleErrors({});
    try {
      const updated = await apiClient.updateIamRole(editRoleTarget.id, {
        description: editRoleDesc.trim(),
        privilege_level: Number(editRoleLevel),
      });
      setEditRoleTarget(null);
      await handleAfterMutation(`Role "${updated.name}" berhasil diperbarui.`, false);
    } catch (err: unknown) {
      reportError(err, 'Gagal memperbarui role.', editRoleTarget.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteRoleTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.deleteIamRole(deleteRoleTarget.id);
      const deletedName = deleteRoleTarget.name;
      if (detailRoleId === deleteRoleTarget.id) setDetailRoleId(null);
      setDeleteRoleTarget(null);
      await handleAfterMutation(`Role "${deletedName}" berhasil dihapus.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal menghapus role.', deleteRoleTarget.id);
      setDeleteRoleTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openBindFromRole = (role: IamRole, preselectedPerm?: IamPermission) => {
    const defaultPerm =
      preselectedPerm ||
      permissions.find((p) => role.is_system || !isReservedPermission(p.action, p.resource_type)) ||
      permissions[0];
    setBindLockedMode('role');
    setBindRoleId(role.id);
    setSelectedPermId(defaultPerm?.id ?? '');
    setBindResourcePattern(defaultPerm ? `${defaultPerm.resource_type}:*` : '*');
    setBindEffect('ALLOW');
    setBindAbacJson('');
    setBindReason('');
    setIsBindModalOpen(true);
  };

  const openAssignFromPermission = (perm: IamPermission) => {
    const reserved = isReservedPermission(perm.action, perm.resource_type);
    const defaultRole =
      (reserved
        ? roles.find((r) => r.name === 'SUPERVISOR') || roles.find((r) => r.is_system)
        : roles.find((r) => r.name === 'QUALITY_AUDITOR') || roles.find((r) => r.name !== 'ADMIN')) || roles[0];
    setBindLockedMode('permission');
    setSelectedPermId(perm.id);
    setBindRoleId(defaultRole?.id ?? '');
    setBindResourcePattern(`${perm.resource_type}:*`);
    setBindEffect('ALLOW');
    setBindAbacJson('');
    setBindReason('');
    setIsBindModalOpen(true);
  };

  const handleBindPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const role = roles.find((r) => r.id === bindRoleId);
    const perm = permissions.find((p) => p.id === selectedPermId);
    if (!role || !perm) {
      setFeedback({ type: 'error', msg: 'Pilih role dan permission terlebih dahulu.' });
      return;
    }
    if (!role.is_system && isReservedPermission(perm.action, perm.resource_type)) {
      setFeedback({
        type: 'error',
        msg: `Permission "${perm.action}:${perm.resource_type}" adalah reserved permission dan diblokir untuk custom role.`,
      });
      return;
    }
    if (role.name === 'ADMIN' && bindEffect === 'DENY') {
      setFeedback({
        type: 'error',
        msg: 'Anti-Lockout Guard: Policy DENY pada role ADMIN dilarang.',
      });
      return;
    }
    const pattern = bindResourcePattern.trim() || `${perm.resource_type}:*`;
    if (!role.is_system && bindEffect === 'ALLOW' && (pattern === '*' || pattern === 'org:*')) {
      setFeedback({
        type: 'error',
        msg: 'Custom role tidak boleh diberikan wildcard resource pattern (*).',
      });
      return;
    }
    let parsedAbac: Record<string, unknown> | null = null;
    if (bindAbacJson.trim()) {
      try {
        const parsed = JSON.parse(bindAbacJson.trim());
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setFeedback({ type: 'error', msg: 'abac_condition harus berupa objek JSON (mis. {"line_id": "LINE-01"}).' });
          return;
        }
        parsedAbac = parsed;
      } catch {
        setFeedback({ type: 'error', msg: 'abac_condition wajib berupa JSON valid atau kosong.' });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      await apiClient.addIamRolePermission(role.id, perm.id, {
        resourcePattern: pattern,
        effect: bindEffect,
        abacCondition: parsedAbac,
        reason: bindReason.trim() || undefined,
      });
      setIsBindModalOpen(false);
      await handleAfterMutation(
        `Permission ${perm.action}:${perm.resource_type} (${bindEffect} · ${pattern}) berhasil di-assign ke role ${role.name}.`
      );
    } catch (err: unknown) {
      reportError(err, 'Gagal meng-assign permission ke role.', role.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmUnbindPermission = async () => {
    if (!unbindTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.removeIamRolePermission(unbindTarget.role.id, unbindTarget.permissionId);
      const { role, label } = unbindTarget;
      setUnbindTarget(null);
      await handleAfterMutation(`Permission "${label}" dilepas dari role ${role.name}.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal melepas permission dari role.', unbindTarget.role.id);
      setUnbindTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (assignScopeType !== 'ORGANIZATION' && !assignScopeId.trim()) {
      setFeedback({ type: 'error', msg: 'Scope ID wajib diisi untuk scope selain ORGANIZATION.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.assignIamUserRole({
        operatorId: assignOperatorId,
        roleName: assignRoleName,
        scopeType: assignScopeType,
        scopeId: assignScopeType === 'ORGANIZATION' ? null : assignScopeId.trim(),
      });
      setIsAssignModalOpen(false);
      setAssignScopeId('');
      await handleAfterMutation(`Role ${assignRoleName} berhasil di-assign ke ${assignOperatorId}.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal assign user role.', assignOperatorId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmRevokeAssignment = async () => {
    if (!revokeTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.revokeIamUserRole({
        id: revokeTarget.id,
        operatorId: revokeTarget.operator_id,
        roleName: revokeTarget.role_name,
        scopeType: revokeTarget.scope_type,
        scopeId: revokeTarget.scope_id,
      });
      const revoked = revokeTarget;
      setRevokeTarget(null);
      await handleAfterMutation(`Assignment ${revoked.role_name} pada ${revoked.operator_id} berhasil dicabut.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal mencabut assignment.', revokeTarget.operator_id);
      setRevokeTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    let parsedCondition: Record<string, unknown> | null = null;
    if (polAbacJson.trim()) {
      try {
        const parsed = JSON.parse(polAbacJson.trim());
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setFeedback({ type: 'error', msg: 'abac_condition harus berupa objek JSON (mis. {"line_id": "LINE-01"}).' });
          return;
        }
        parsedCondition = parsed;
      } catch {
        setFeedback({ type: 'error', msg: 'abac_condition wajib berupa JSON valid atau kosong.' });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      await apiClient.createIamPolicy({
        role: polRole,
        eft: polEft,
        action: polAction.trim(),
        resource_pattern: polResource.trim(),
        abac_condition: parsedCondition,
        is_active: true,
        reason: polReason.trim() || undefined,
      });
      setIsPolicyModalOpen(false);
      setPolAbacJson('');
      setPolReason('');
      await handleAfterMutation(`Policy ${polEft} untuk ${polRole} berhasil ditambahkan.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal membuat aturan hak akses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPolicyModal = (pol: IamPolicyRule) => {
    setEditPolicyTarget(pol);
    setEditPolEft(pol.eft);
    setEditPolAction(pol.action);
    setEditPolResource(pol.resource_pattern);
    setEditPolAbacJson(
      pol.abac_condition
        ? typeof pol.abac_condition === 'string'
          ? pol.abac_condition
          : JSON.stringify(pol.abac_condition, null, 2)
        : ''
    );
    setEditPolReason(pol.reason ?? '');
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPolicyTarget || isSubmitting) return;
    let parsedCondition: Record<string, unknown> | null = null;
    if (editPolAbacJson.trim()) {
      try {
        const parsed = JSON.parse(editPolAbacJson.trim());
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setFeedback({ type: 'error', msg: 'abac_condition harus berupa objek JSON (mis. {"line_id": "LINE-01"}).' });
          return;
        }
        parsedCondition = parsed;
      } catch {
        setFeedback({ type: 'error', msg: 'abac_condition wajib berupa JSON valid atau kosong.' });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      await apiClient.updateIamPolicy(editPolicyTarget.id, {
        eft: editPolEft,
        action: editPolAction.trim(),
        resource_pattern: editPolResource.trim(),
        abac_condition: parsedCondition,
        reason: editPolReason.trim() || undefined,
      });
      const updatedId = editPolicyTarget.id;
      setEditPolicyTarget(null);
      await handleAfterMutation(`Policy ${updatedId} berhasil diperbarui.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal memperbarui aturan hak akses.', editPolicyTarget.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePolicy = async (pol: IamPolicyRule) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.updateIamPolicy(pol.id, { is_active: !pol.is_active });
      await handleAfterMutation(`Status policy ${pol.id} diubah menjadi ${!pol.is_active ? 'ACTIVE' : 'DISABLED'}.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal mengubah status policy.', pol.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeletePolicy = async () => {
    if (!deletePolicyTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiClient.deleteIamPolicy(deletePolicyTarget.id);
      const id = deletePolicyTarget.id;
      setDeletePolicyTarget(null);
      await handleAfterMutation(`Policy ${id} dihapus.`);
    } catch (err: unknown) {
      reportError(err, 'Gagal menghapus policy.', deletePolicyTarget.id);
      setDeletePolicyTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInspectSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectOperatorId) return;
    setIsInspecting(true);
    setFeedback(null);
    try {
      const res = await apiClient.getSubjectEffectivePermissions(inspectOperatorId);
      setEffectivePerms(res);
    } catch (err: unknown) {
      reportError(err, 'Gagal inspeksi effective permissions.', inspectOperatorId);
      setEffectivePerms(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const filteredRoles = useMemo(() => {
    const q = roleFilterQuery.trim().toLowerCase();
    return roles.filter((r) => {
      if (roleTypeFilter === 'SYSTEM' && !r.is_system) return false;
      if (roleTypeFilter === 'CUSTOM' && r.is_system) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    });
  }, [roles, roleFilterQuery, roleTypeFilter]);

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(
      (a) =>
        a.operator_id.toLowerCase().includes(q) ||
        a.operator_name.toLowerCase().includes(q) ||
        a.role_name.toLowerCase().includes(q) ||
        (a.scope_id ?? '').toLowerCase().includes(q)
    );
  }, [assignments, assignmentSearch]);

  const filteredPolicies = useMemo(() => {
    const q = policySearch.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter(
      (p) =>
        p.role.toLowerCase().includes(q) ||
        p.action.toLowerCase().includes(q) ||
        p.resource_pattern.toLowerCase().includes(q) ||
        (p.reason ?? '').toLowerCase().includes(q)
    );
  }, [policies, policySearch]);

  const filteredDecisions = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return decisions;
    return decisions.filter(
      (d) =>
        d.subject.toLowerCase().includes(q) ||
        d.action.toLowerCase().includes(q) ||
        d.resource.toLowerCase().includes(q) ||
        d.decision.toLowerCase().includes(q) ||
        (d.reason ?? '').toLowerCase().includes(q)
    );
  }, [decisions, auditSearch]);

  const detailRole = useMemo(
    () => (detailRoleId ? roles.find((r) => r.id === detailRoleId) ?? null : null),
    [detailRoleId, roles]
  );

  if (!canManage.canInteract) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses Pengaturan Hak Akses Terkunci</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {canManage.reason || 'Halaman pengaturan hak akses hanya tersedia untuk peran Admin dari jaringan lokal pabrik.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Pengaturan Hak Akses &amp; Kebijakan Pengguna
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pengaturan peran pengguna (tingkat peran tambahan maksimal {CUSTOM_ROLE_MAX_LEVEL}), penugasan area kerja, aturan izin, dan riwayat pemeriksaan akses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={iamInfo?.mode === 'enforce' ? 'success' : 'warning'}>
            Status Keamanan Akses: {iamInfo ? `${iamInfo.mode === 'enforce' ? 'AKTIF' : iamInfo.mode.toUpperCase()} · Pembaruan #${iamInfo.authzVersion}` : 'MEMUAT...'}
          </Badge>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(
          [
            ['roles', `Roles (${roles.length})`],
            ['assignments', `User Assignments (${assignments.length})`],
            ['policies', `Aturan Kebijakan (${policies.length})`],
            ['permissions', `Permissions (${permissions.length})`],
            ['inspector', 'Pemeriksa Izin Pengguna'],
            ['audit', `Riwayat Pemeriksaan (${decisions.length})`],
          ] as Array<[IamTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
              activeTab === key
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Memuat daftar hak akses...</div>
      ) : (
        <>
          {/* TAB 1: ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter tipe role"
                    value={roleTypeFilter}
                    onChange={(e) => setRoleTypeFilter(e.target.value as 'ALL' | 'SYSTEM' | 'CUSTOM')}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALL">Semua Tipe ({roles.length})</option>
                    <option value="SYSTEM">Role Sistem ({roles.filter((r) => r.is_system).length})</option>
                    <option value="CUSTOM">Custom Role ({roles.filter((r) => !r.is_system).length})</option>
                  </select>
                  <input
                    type="search"
                    aria-label="Cari role"
                    value={roleFilterQuery}
                    onChange={(e) => setRoleFilterQuery(e.target.value)}
                    placeholder="Cari nama atau deskripsi role..."
                    className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRoleFormErrors({});
                    setIsRoleModalOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Role</span>
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Role sistem (ADMIN, SUPERVISOR, OPERATOR, MAINTENANCE) dilindungi dan tidak dapat diubah atau dihapus. Custom role dibatasi maksimal level {CUSTOM_ROLE_MAX_LEVEL} dan hanya efektif dalam mode <code className="font-mono">enforce</code>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRoles.map((r) => {
                  const boundRules = policies.filter((p) => p.role_id === r.id && Boolean(p.permission_id));
                  const assignedUserCount = assignments.filter(
                    (a) => a.role_id === r.id || a.role_name === r.name
                  ).length;
                  return (
                    <div
                      key={r.id}
                      className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{r.name}</span>
                            <Badge variant={r.is_system ? 'info' : 'neutral'}>Level {r.privilege_level}</Badge>
                            {r.is_system && (
                              <Badge variant="warning">
                                <span className="inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> System
                                </span>
                              </Badge>
                            )}
                            {assignedUserCount > 0 && (
                              <Badge variant="success">{assignedUserCount} User</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Detail role ${r.name}`}
                            onClick={() => setDetailRoleId(r.id)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </Button>
                          {!r.is_system && (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Edit role ${r.name}`}
                              onClick={() => {
                                setEditRoleTarget(r);
                                setEditRoleLevel(r.privilege_level);
                                setEditRoleDesc(r.description);
                                setEditRoleErrors({});
                              }}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openBindFromRole(r)}>
                            <Key className="w-3.5 h-3.5" />
                            <span>Assign Perm</span>
                          </Button>
                          {!r.is_system && (
                            <Button
                              size="sm"
                              variant="danger"
                              aria-label={`Hapus role ${r.name}`}
                              onClick={() => setDeleteRoleTarget(r)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {boundRules.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Permission Terikat ({boundRules.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {boundRules.map((br) => {
                              const permObj = permissions.find((p) => p.id === br.permission_id);
                              const permLabel = permObj
                                ? `${permObj.action}:${permObj.resource_type}`
                                : `${br.action} (${br.resource_pattern})`;
                              const isDeny = br.eft === 'DENY';
                              const hasCustomScope =
                                permObj && br.resource_pattern !== `${permObj.resource_type}:*`;
                              return (
                                <span
                                  key={br.id}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono ${
                                    isDeny
                                      ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200'
                                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`font-sans text-[10px] font-bold uppercase ${
                                      isDeny
                                        ? 'text-red-700 dark:text-red-300'
                                        : 'text-emerald-700 dark:text-emerald-300'
                                    }`}
                                  >
                                    {br.eft}
                                  </span>
                                  <span>{permLabel}</span>
                                  {hasCustomScope && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                      ({br.resource_pattern})
                                    </span>
                                  )}
                                  {r.name !== 'ADMIN' && br.permission_id && (
                                    <button
                                      type="button"
                                      aria-label={`Lepas permission ${permLabel} dari ${r.name}`}
                                      onClick={() =>
                                        setUnbindTarget({ role: r, permissionId: br.permission_id!, label: permLabel })
                                      }
                                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: ASSIGNMENTS */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    aria-label="Cari user assignment"
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    placeholder="Cari operator, role, atau scope..."
                    className="w-64 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-xs text-slate-500">
                    Catatan: Hanya scope <code className="font-mono font-semibold">ORGANIZATION</code> yang memberi hak akses Admin Panel aktif saat ini.
                  </span>
                </div>
                <Button size="sm" onClick={() => setIsAssignModalOpen(true)}>
                  <Users className="w-3.5 h-3.5" />
                  <span>Assign User Role</span>
                </Button>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-2.5 px-4">Operator</th>
                      <th className="py-2.5 px-4">Assigned Role</th>
                      <th className="py-2.5 px-4">Scope Level &amp; Target</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          Tidak ada user assignment yang cocok.
                        </td>
                      </tr>
                    ) : (
                      filteredAssignments.map((a) => {
                        const targetOp = operators.find((o) => o.operator_id === a.operator_id);
                        const isProtectedAdminAssignment =
                          (Boolean(targetOp?.is_protected) || a.operator_id === 'ADM-001') && a.role_name === 'ADMIN';
                        const isOrgScope = a.scope_type === 'ORGANIZATION';
                        return (
                          <tr key={a.id}>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                                <span>{a.operator_name}</span>
                                {targetOp?.is_protected && <Badge variant="warning">Dilindungi</Badge>}
                                {targetOp && !targetOp.is_active && <Badge variant="danger">Nonaktif</Badge>}
                              </div>
                              <div className="text-[11px] font-tabular text-slate-500">{a.operator_id}</div>
                            </td>
                            <td className="py-2.5 px-4">
                              <Badge variant="info">{a.role_name}</Badge>
                            </td>
                            <td className="py-2.5 px-4 font-tabular">
                              <div className="flex items-center gap-1.5">
                                <span>
                                  {a.scope_type} {a.scope_id ? `(${a.scope_id})` : '(Global Plant)'}
                                </span>
                                <Badge variant={isOrgScope ? 'success' : 'neutral'}>
                                  {isOrgScope ? 'Efektif' : 'Persiapan'}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right space-x-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setInspectOperatorId(a.operator_id);
                                  setActiveTab('inspector');
                                  void apiClient
                                    .getSubjectEffectivePermissions(a.operator_id)
                                    .then(setEffectivePerms)
                                    .catch(() => undefined);
                                }}
                              >
                                <Search className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={isProtectedAdminAssignment || isSubmitting}
                                title={
                                  isProtectedAdminAssignment
                                    ? 'Anti-Lockout Guard: role ADMIN pada akun dilindungi tidak dapat dicabut.'
                                    : undefined
                                }
                                onClick={() => setRevokeTarget(a)}
                              >
                                Revoke
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: POLICIES */}
          {activeTab === 'policies' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    aria-label="Cari aturan kebijakan"
                    value={policySearch}
                    onChange={(e) => setPolicySearch(e.target.value)}
                    placeholder="Cari role, action, resource..."
                    className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-xs text-slate-500">
                    Aturan pemberian (ALLOW) atau pembatasan (DENY) akses beserta syarat area kerja.
                  </span>
                </div>
                <Button size="sm" onClick={() => setIsPolicyModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Aturan</span>
                </Button>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-2.5 px-4">Role &amp; Effect</th>
                      <th className="py-2.5 px-4">Action / Resource Pattern</th>
                      <th className="py-2.5 px-4">Syarat Tambahan</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPolicies.map((pol) => {
                      const isAdminProtected = policyTargetsAdmin(pol.role);
                      return (
                        <tr key={pol.id}>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{pol.role}</div>
                            <Badge variant={pol.eft === 'ALLOW' ? 'success' : 'danger'}>{pol.eft}</Badge>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px]">
                            <div>{pol.action}</div>
                            <div className="text-slate-500">{pol.resource_pattern}</div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {pol.abac_condition
                              ? typeof pol.abac_condition === 'string'
                                ? pol.abac_condition
                                : JSON.stringify(pol.abac_condition)
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge variant={pol.is_active ? 'success' : 'neutral'}>
                              {pol.is_active ? 'ACTIVE' : 'DISABLED'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right space-x-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Edit policy ${pol.id}`}
                              disabled={isAdminProtected || isSubmitting}
                              onClick={() => openEditPolicyModal(pol)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isAdminProtected || isSubmitting}
                              onClick={() => handleTogglePolicy(pol)}
                            >
                              {pol.is_active ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              aria-label={`Hapus policy ${pol.id}`}
                              disabled={isAdminProtected || isSubmitting}
                              onClick={() => setDeletePolicyTarget(pol)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PREDEFINED PERMISSIONS CATALOG (FIXED · READ-ONLY) */}
          {activeTab === 'permissions' && (() => {
            const domainTypes = Array.from(new Set(permissions.map((p) => p.resource_type))).sort();
            const q = permSearchQuery.trim().toLowerCase();
            const filteredPermissions = permissions.filter((p) => {
              if (permDomainFilter !== 'ALL' && p.resource_type !== permDomainFilter) return false;
              if (!q) return true;
              return (
                `${p.action}:${p.resource_type}`.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q)
              );
            });
            return (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                  <div className="font-semibold">
                    Katalog Permission Sistem (Fixed Master Data · Read-Only)
                  </div>
                  <p>
                    Daftar permission di bawah adalah master data tetap yang didefinisikan oleh guard API backend (<code className="font-mono">action:resource_type</code>). Penambahan, pengubahan, maupun penghapusan item katalog dilarang. Gunakan tombol <strong>Assign ke Role</strong> untuk menetapkan izin ke peran tertentu.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filter domain permission"
                      value={permDomainFilter}
                      onChange={(e) => setPermDomainFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                    >
                      <option value="ALL">Semua Domain ({permissions.length})</option>
                      {domainTypes.map((dt) => (
                        <option key={dt} value={dt}>
                          {dt}
                        </option>
                      ))}
                    </select>
                    <input
                      type="search"
                      aria-label="Cari permission"
                      value={permSearchQuery}
                      onChange={(e) => setPermSearchQuery(e.target.value)}
                      placeholder="Cari action atau deskripsi..."
                      className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Menampilkan {filteredPermissions.length} dari {permissions.length} permission sistem
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPermissions.map((p) => {
                    const reserved = isReservedPermission(p.action, p.resource_type);
                    const directBindings = policies.filter(
                      (pol) =>
                        pol.is_active &&
                        (pol.permission_id === p.id ||
                          (pol.action === p.action &&
                            (pol.resource_pattern === `${p.resource_type}:*` ||
                              pol.resource_pattern.startsWith(`${p.resource_type}:`))) ||
                          pol.action === `${p.action}:${p.resource_type}`)
                    );
                    return (
                      <div
                        key={p.id}
                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {p.action}:{p.resource_type}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="neutral">Sistem</Badge>
                              {reserved && <Badge variant="danger">RESERVED</Badge>}
                            </div>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{p.description}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-semibold uppercase text-slate-400 mr-1">
                              Aturan Aktif:
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-mono text-[10px]">
                              ADMIN (*:*)
                            </span>
                            {directBindings.map((pol) => (
                              <span
                                key={pol.id}
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                  pol.eft === 'DENY'
                                    ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {pol.eft} {pol.role}
                              </span>
                            ))}
                          </div>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignFromPermission(p)}
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Assign ke Role</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* TAB 5: DEBUG EFFECTIVE PERMISSIONS INSPECTOR */}
          {activeTab === 'inspector' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div>
                  <strong>Pemeriksa Izin Akun (Static Preview · ADMIN-only):</strong> Menampilkan ringkasan statis policy dari{' '}
                  <code className="font-mono">GET /access-control/subjects/:operatorId/effective-permissions</code>.
                </div>
                <p>
                  Catatan: endpoint ini <strong>tidak mengevaluasi scope maupun atribut ABAC runtime</strong> dan tidak digunakan sebagai gerbang UI. Keputusan izin UI sesi aktif selalu bersumber dari{' '}
                  <code className="font-mono">GET /api/v1/auth/me</code> (<code className="font-mono">capabilities[]</code>).
                </p>
              </div>
              <form onSubmit={handleInspectSubject} className="flex flex-wrap items-end gap-3">
                <div className="w-64">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pilih Operator / Subjek
                  </label>
                  <select
                    value={inspectOperatorId}
                    onChange={(e) => setInspectOperatorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    {operators.map((op) => (
                      <option key={op.operator_id} value={op.operator_id}>
                        {op.operator_id} · {op.name} ({op.role})
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm" isLoading={isInspecting}>
                  <Search className="w-3.5 h-3.5" />
                  <span>Periksa Izin Akun</span>
                </Button>
              </form>

              {effectivePerms && (
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-tabular">
                        {effectivePerms.operatorId}
                      </span>
                      <span className="ml-2 text-slate-500">Primary: {effectivePerms.primaryRole}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {effectivePerms.effectiveRoles.map((er, i) => (
                        <Badge key={i} variant="info">
                          {er.roleName} ({er.scopeType}{er.scopeId ? `: ${er.scopeId}` : ''})
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {effectivePerms.permissions.length === 0 ? (
                      <div className="text-slate-500 py-2">
                        Tidak ada aturan policy eksplisit untuk peran operator ini (menggunakan baseline sistem jika berlaku).
                      </div>
                    ) : (
                      effectivePerms.permissions.map((perm, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 font-mono">
                            <Badge variant={perm.effect === 'ALLOW' ? 'success' : 'danger'}>{perm.effect}</Badge>
                            <span>
                              {perm.action} → {perm.resourcePattern}
                            </span>
                          </div>
                          <span className="text-slate-500">Sumber Peran: {perm.sourceRole}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DECISIONS LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="search"
                  aria-label="Cari riwayat keputusan otorisasi"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Cari subjek, keputusan, action, atau resource..."
                  className="w-72 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
                <span className="text-[11px] text-slate-500">
                  Menampilkan {filteredDecisions.length} dari {decisions.length} keputusan
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-2.5 px-4">Waktu</th>
                      <th className="py-2.5 px-4">Subjek</th>
                      <th className="py-2.5 px-4">Keputusan</th>
                      <th className="py-2.5 px-4">Action &amp; Resource</th>
                      <th className="py-2.5 px-4">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDecisions.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2.5 px-4 font-tabular text-slate-500">
                          {new Date(d.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-tabular font-semibold text-slate-900 dark:text-slate-100">
                          {d.subject}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant={d.decision === 'ALLOW' ? 'success' : 'danger'}>
                            {d.decision} ({d.mode})
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px]">
                          <div>{d.action}</div>
                          <div className="text-slate-500">{d.resource}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{d.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Role Detail & Permission Matrix Modal (Workflow A & B) */}
      {detailRole && (() => {
        const boundRules = policies.filter((p) => p.role_id === detailRole.id && Boolean(p.permission_id));
        const boundPermIds = new Set(boundRules.map((b) => b.permission_id).filter(Boolean));
        const availablePerms = permissions.filter((p) => !boundPermIds.has(p.id));
        const roleAssignments = assignments.filter(
          (a) => a.role_id === detailRole.id || a.role_name === detailRole.name
        );

        return (
          <Modal
            isOpen={true}
            onClose={() => setDetailRoleId(null)}
            title={`Detail Role: ${detailRole.name}`}
            subtitle={`Level ${detailRole.privilege_level} · ${detailRole.is_system ? 'System Protected Role' : 'Custom Role'} · ID: ${detailRole.id}`}
            footer={
              <div className="flex items-center justify-between w-full">
                <div className="text-[11px] text-slate-500">
                  {roleAssignments.length} user terhubung · {boundRules.length} permission terhubung
                </div>
                <Button variant="ghost" onClick={() => setDetailRoleId(null)}>
                  Tutup
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-xs max-h-[65vh] overflow-y-auto pr-1">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={detailRole.is_system ? 'warning' : 'info'}>
                    {detailRole.is_system ? 'SYSTEM ROLE' : 'CUSTOM ROLE'}
                  </Badge>
                  <Badge variant="neutral">Level {detailRole.privilege_level}</Badge>
                  <Badge variant={roleAssignments.length > 0 ? 'success' : 'neutral'}>
                    {roleAssignments.length > 0 ? `Digunakan (${roleAssignments.length} user)` : 'Belum digunakan'}
                  </Badge>
                </div>
                <p className="text-slate-700 dark:text-slate-300">{detailRole.description}</p>
                {roleAssignments.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {roleAssignments.map((a) => (
                      <Badge key={a.id} variant="info">
                        {a.operator_id} · {a.scope_type}
                        {a.scope_id ? `:${a.scope_id}` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Permission Terhubung ({boundRules.length})
                </div>
                {boundRules.length === 0 ? (
                  <p className="text-slate-500 italic">Belum ada permission eksplisit yang terhubung ke role ini.</p>
                ) : (
                  <div className="space-y-1.5">
                    {boundRules.map((br) => {
                      const permObj = permissions.find((p) => p.id === br.permission_id);
                      const permLabel = permObj
                        ? `${permObj.action}:${permObj.resource_type}`
                        : `${br.action} (${br.resource_pattern})`;
                      return (
                        <div
                          key={br.id}
                          className="p-2 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-mono">
                              <Badge variant={br.eft === 'ALLOW' ? 'success' : 'danger'}>{br.eft}</Badge>
                              <span className="font-semibold">{permLabel}</span>
                              <span className="text-slate-500">({br.resource_pattern})</span>
                            </div>
                            {permObj && <div className="text-[11px] text-slate-500 mt-0.5">{permObj.description}</div>}
                          </div>
                          {detailRole.name !== 'ADMIN' && br.permission_id && (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={isSubmitting}
                              onClick={() =>
                                setUnbindTarget({
                                  role: detailRole,
                                  permissionId: br.permission_id!,
                                  label: permLabel,
                                })
                              }
                            >
                              Cabut
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Permission Tersedia dari Katalog ({availablePerms.length})
                </div>
                <div className="space-y-1.5">
                  {availablePerms.map((p) => {
                    const reservedBlocked = !detailRole.is_system && isReservedPermission(p.action, p.resource_type);
                    return (
                      <div
                        key={p.id}
                        className="p-2 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {p.action}:{p.resource_type}
                            </span>
                            {reservedBlocked && <Badge variant="danger">RESERVED</Badge>}
                          </div>
                          <div className="text-[11px] text-slate-500">{p.description}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reservedBlocked || isSubmitting}
                          title={reservedBlocked ? 'Reserved permission dilarang untuk custom role' : undefined}
                          onClick={() => openBindFromRole(detailRole, p)}
                        >
                          Assign
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Create Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => !isSubmitting && setIsRoleModalOpen(false)}
        title="Buat Custom Role Baru"
        subtitle={`Tingkat kewenangan peran tambahan dibatasi 1–${CUSTOM_ROLE_MAX_LEVEL} (ADMIN = 40, SUPERVISOR = 30). Custom role aktif pada mode enforce.`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsRoleModalOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleCreateRole} isLoading={isSubmitting}>
              Simpan Role
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          <Input
            label="Role Name"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value.toUpperCase())}
            placeholder="PRODUCTION_MANAGER"
            error={roleFormErrors.name}
            required
          />
          <Input
            label={`Tingkat Kewenangan (1–${CUSTOM_ROLE_MAX_LEVEL})`}
            type="number"
            min={1}
            max={CUSTOM_ROLE_MAX_LEVEL}
            value={roleLevel}
            onChange={(e) => setRoleLevel(Number(e.target.value))}
            error={roleFormErrors.privilege_level}
            required
          />
          <Input
            label="Deskripsi"
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
            placeholder="Pengelola operasional lini dan analitik produksi"
            error={roleFormErrors.description}
            required
          />
        </form>
      </Modal>

      {/* Edit Custom Role Modal */}
      <Modal
        isOpen={Boolean(editRoleTarget)}
        onClose={() => !isSubmitting && setEditRoleTarget(null)}
        title={`Edit Role ${editRoleTarget?.name ?? ''}`}
        subtitle={`Perbarui deskripsi atau tingkat kewenangan custom role (1–${CUSTOM_ROLE_MAX_LEVEL}).`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditRoleTarget(null)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleUpdateRole} isLoading={isSubmitting}>
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpdateRole} className="space-y-4">
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

      {/* Assign / Bind Permission to Role Modal */}
      {(() => {
        const selectedRole = roles.find((r) => r.id === bindRoleId) ?? null;
        const selectedPerm = permissions.find((p) => p.id === selectedPermId) ?? null;
        const isAdminRole = selectedRole?.name === 'ADMIN';
        return (
          <Modal
            isOpen={isBindModalOpen}
            onClose={() => !isSubmitting && setIsBindModalOpen(false)}
            title={
              bindLockedMode === 'permission' && selectedPerm
                ? `Assign Permission ${selectedPerm.action}:${selectedPerm.resource_type} ke Role`
                : `Assign Permission ke Role ${selectedRole?.name ?? ''}`
            }
            subtitle="Tetapkan izin dari katalog sistem ke peran target beserta pola resource dan syarat ABAC (opsional)."
            footer={
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setIsBindModalOpen(false)} disabled={isSubmitting}>
                  Batal
                </Button>
                <Button onClick={handleBindPermission} isLoading={isSubmitting}>
                  Assign Permission
                </Button>
              </div>
            }
          >
            <form onSubmit={handleBindPermission} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Role
                </label>
                <select
                  value={bindRoleId}
                  disabled={bindLockedMode === 'role'}
                  onChange={(e) => {
                    const nextRoleId = e.target.value;
                    setBindRoleId(nextRoleId);
                    const nextRole = roles.find((r) => r.id === nextRoleId);
                    if (nextRole?.name === 'ADMIN') {
                      setBindEffect('ALLOW');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  {roles.map((r) => {
                    const blocked =
                      selectedPerm && !r.is_system && isReservedPermission(selectedPerm.action, selectedPerm.resource_type);
                    return (
                      <option key={r.id} value={r.id} disabled={Boolean(blocked)}>
                        {r.name} (Level {r.privilege_level}) {blocked ? '(DIBLOKIR - RESERVED)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Permission Sistem (Fixed Catalog)
                </label>
                <select
                  value={selectedPermId}
                  disabled={bindLockedMode === 'permission'}
                  onChange={(e) => {
                    const nextPermId = e.target.value;
                    setSelectedPermId(nextPermId);
                    const nextPerm = permissions.find((p) => p.id === nextPermId);
                    if (nextPerm) {
                      setBindResourcePattern(`${nextPerm.resource_type}:*`);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  {permissions.map((p) => {
                    const blocked =
                      selectedRole && !selectedRole.is_system && isReservedPermission(p.action, p.resource_type);
                    return (
                      <option key={p.id} value={p.id} disabled={Boolean(blocked)}>
                        {p.action}:{p.resource_type} {blocked ? '(RESERVED - BLOCKED)' : `— ${p.description}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effect
                  </label>
                  <select
                    value={bindEffect}
                    onChange={(e) => setBindEffect(e.target.value as 'ALLOW' | 'DENY')}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY" disabled={isAdminRole}>
                      DENY {isAdminRole ? '(Diblokir untuk ADMIN)' : ''}
                    </option>
                  </select>
                </div>
                <Input
                  label="Resource Pattern"
                  value={bindResourcePattern}
                  onChange={(e) => setBindResourcePattern(e.target.value)}
                  placeholder={selectedPerm ? `${selectedPerm.resource_type}:*` : 'telemetry:*'}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <FileCode2 className="w-3.5 h-3.5" /> Syarat Kondisi ABAC JSON (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={bindAbacJson}
                  onChange={(e) => setBindAbacJson(e.target.value)}
                  placeholder='{"line_id": "LINE-01"}'
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <Input
                label="Alasan / Catatan Penetapan (Opsional)"
                value={bindReason}
                onChange={(e) => setBindReason(e.target.value)}
                placeholder="Contoh: Izinkan tim QA audit ekspor telemetri Line 01"
              />
            </form>
          </Modal>
        );
      })()}

      {/* Assign User Role Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => !isSubmitting && setIsAssignModalOpen(false)}
        title="Tetapkan Peran ke Operator"
        subtitle="Pilih operator, peran, dan area tugas yang diberikan."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleAssignUserRole} isLoading={isSubmitting}>
              Simpan Assignment
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAssignUserRole} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Operator</label>
            <select
              value={assignOperatorId}
              onChange={(e) => setAssignOperatorId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              {operators.map((op) => (
                <option key={op.operator_id} value={op.operator_id}>
                  {op.operator_id} · {op.name} ({op.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Role</label>
            <select
              value={assignRoleName}
              onChange={(e) => setAssignRoleName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name} (Level {r.privilege_level})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Scope Type</label>
            <select
              value={assignScopeType}
              onChange={(e) => setAssignScopeType(e.target.value as ScopeLevel)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
            >
              <option value="ORGANIZATION">ORGANIZATION (Global — Efektif di Admin Panel)</option>
              <option value="SITE">SITE (Persiapan)</option>
              <option value="AREA">AREA (Persiapan)</option>
              <option value="LINE">LINE (Persiapan)</option>
              <option value="MACHINE">MACHINE (Persiapan)</option>
              <option value="DEVICE">DEVICE (Persiapan)</option>
            </select>
          </div>
          {assignScopeType !== 'ORGANIZATION' && (
            <Input
              label="Scope ID"
              value={assignScopeId}
              onChange={(e) => setAssignScopeId(e.target.value)}
              placeholder="Contoh: LINE-01 atau CNC-MILLING-01"
              required
            />
          )}
        </form>
      </Modal>

      {/* Create Policy Modal */}
      <Modal
        isOpen={isPolicyModalOpen}
        onClose={() => !isSubmitting && setIsPolicyModalOpen(false)}
        title="Tambah Aturan Kebijakan Baru"
        subtitle="Buat aturan izin atau pembatasan baru untuk peran tertentu."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsPolicyModalOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleCreatePolicy} isLoading={isSubmitting}>
              Simpan Aturan
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreatePolicy} className="space-y-3">
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

      {/* Edit Policy Modal */}
      <Modal
        isOpen={Boolean(editPolicyTarget)}
        onClose={() => !isSubmitting && setEditPolicyTarget(null)}
        title={`Edit Aturan ${editPolicyTarget?.id ?? ''}`}
        subtitle={`Perbarui aturan Casbin ABAC untuk peran ${editPolicyTarget?.role ?? ''}.`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditPolicyTarget(null)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button onClick={handleUpdatePolicy} isLoading={isSubmitting}>
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpdatePolicy} className="space-y-3">
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

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={Boolean(deleteRoleTarget)}
        onClose={() => !isSubmitting && setDeleteRoleTarget(null)}
        onConfirm={confirmDeleteRole}
        title={`Hapus Custom Role ${deleteRoleTarget?.name ?? ''}?`}
        variant="destructive"
        description={`Menghapus custom role "${deleteRoleTarget?.name ?? ''}" akan menghapus seluruh binding policy yang terkait dengan role tersebut.`}
        impacts={[
          'Penghapusan ditolak (409 ROLE_IN_USE) jika role masih ditugaskan ke operator.',
          'authz_version dinaikkan secara otomatis.',
        ]}
        confirmLabel="Ya, Hapus Role"
        isLoading={isSubmitting}
      />

      <ConfirmationDialog
        isOpen={Boolean(unbindTarget)}
        onClose={() => !isSubmitting && setUnbindTarget(null)}
        onConfirm={confirmUnbindPermission}
        title={`Cabut Permission ${unbindTarget?.label ?? ''}?`}
        variant="destructive"
        description={`Permission "${unbindTarget?.label ?? ''}" akan dilepas dari role "${unbindTarget?.role.name ?? ''}".`}
        impacts={[
          'Operator dengan role ini segera kehilangan akses terkait dalam mode enforce.',
          'authz_version dinaikkan dan sesi token lama dapat berakhir (401).',
        ]}
        confirmLabel="Ya, Cabut Permission"
        isLoading={isSubmitting}
      />

      <ConfirmationDialog
        isOpen={Boolean(revokeTarget)}
        onClose={() => !isSubmitting && setRevokeTarget(null)}
        onConfirm={confirmRevokeAssignment}
        title={`Cabut Role ${revokeTarget?.role_name ?? ''} dari ${revokeTarget?.operator_id ?? ''}?`}
        variant="destructive"
        description={`Penugasan role ${revokeTarget?.role_name ?? ''} (scope ${revokeTarget?.scope_type ?? ''}) pada ${revokeTarget?.operator_name ?? ''} akan dicabut.`}
        impacts={[
          'Operator akan kembali menggunakan primary role atau sisa assignment yang masih aktif.',
          'authz_version dinaikkan secara otomatis.',
        ]}
        confirmLabel="Ya, Cabut Assignment"
        isLoading={isSubmitting}
      />

      <ConfirmationDialog
        isOpen={Boolean(deletePolicyTarget)}
        onClose={() => !isSubmitting && setDeletePolicyTarget(null)}
        onConfirm={confirmDeletePolicy}
        title={`Hapus Policy ${deletePolicyTarget?.id ?? ''}?`}
        variant="destructive"
        description={`Aturan ${deletePolicyTarget?.eft ?? ''} (${deletePolicyTarget?.action ?? ''} → ${deletePolicyTarget?.resource_pattern ?? ''}) untuk role ${deletePolicyTarget?.role ?? ''} akan dihapus permanen.`}
        impacts={['authz_version dinaikkan setelah policy dihapus.']}
        confirmLabel="Ya, Hapus Policy"
        isLoading={isSubmitting}
      />
    </div>
  );
};
