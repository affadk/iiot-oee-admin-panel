import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { CUSTOM_ROLE_MAX_LEVEL } from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import type { IamMutationDeps, IamTab } from './accessControlTypes';
import { useIamData } from './hooks/useIamData';
import { useRoles } from './hooks/useRoles';
import { useRolePermissions } from './hooks/useRolePermissions';
import { useAssignments } from './hooks/useAssignments';
import { usePolicies } from './hooks/usePolicies';
import { useInspector } from './hooks/useInspector';
import { RolesTab } from './components/RolesTab';
import { AssignmentsTab } from './components/AssignmentsTab';
import { PoliciesTab } from './components/PoliciesTab';
import { PermissionsTab } from './components/PermissionsTab';
import { InspectorTab } from './components/InspectorTab';
import { AuditTab } from './components/AuditTab';
import { RoleDetailModal } from './components/RoleDetailModal';
import { CreateRoleModal } from './components/CreateRoleModal';
import { EditRoleModal } from './components/EditRoleModal';
import { BindPermissionModal } from './components/BindPermissionModal';
import { AssignUserRoleModal } from './components/AssignUserRoleModal';
import { CreatePolicyModal } from './components/CreatePolicyModal';
import { EditPolicyModal } from './components/EditPolicyModal';
import { AccessControlConfirmDialogs } from './components/AccessControlConfirmDialogs';

const VALID_TABS: IamTab[] = ['roles', 'assignments', 'policies', 'permissions', 'inspector', 'audit'];

/**
 * Pengaturan Hak Akses & Kebijakan Pengguna — orkestrasi saja.
 * Data + corong mutasi di useIamData; alur per domain di useRoles /
 * useRolePermissions / useAssignments / usePolicies / useInspector; tab di
 * components/*Tab, modal di components/*Modal, konfirmasi di
 * AccessControlConfirmDialogs. Form state milik modal (pengecualian: 8
 * state Bind tinggal di useRolePermissions — satu state machine
 * dual-entry), filter state + memo tinggal di tab masing-masing.
 */
export const AccessControlPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const initialTabParam = searchParams.get('tab') as IamTab | null;
  const initialOpParam = searchParams.get('operator');

  const [activeTab, setActiveTab] = useState<IamTab>(
    initialTabParam && VALID_TABS.includes(initialTabParam) ? initialTabParam : 'roles',
  );

  const iam = useIamData();
  const mutationDeps: IamMutationDeps = {
    afterMutation: iam.afterMutation,
    reportError: iam.reportError,
    isSubmitting: iam.isSubmitting,
    setIsSubmitting: iam.setIsSubmitting,
    setFeedback: iam.setFeedback,
  };
  const rolesApi = useRoles({ roles: iam.roles, deps: mutationDeps });
  const bindApi = useRolePermissions({ roles: iam.roles, permissions: iam.permissions, deps: mutationDeps });
  const assignApi = useAssignments({ operators: iam.operators, deps: mutationDeps });
  const policiesApi = usePolicies({ deps: mutationDeps });
  const inspector = useInspector({
    activeTab,
    initialOpParam,
    canInteract: iam.canManage.canInteract,
    operatorsLength: iam.operators.length,
    reportError: iam.reportError,
    setFeedback: iam.setFeedback,
  });

  if (!iam.canManage.canInteract) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses Pengaturan Hak Akses Terkunci</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {iam.canManage.reason || 'Halaman pengaturan hak akses hanya tersedia untuk peran Admin dari jaringan lokal pabrik.'}
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
          <Badge variant={iam.iamInfo?.mode === 'enforce' ? 'success' : 'warning'}>
            Status Keamanan Akses: {iam.iamInfo ? `${iam.iamInfo.mode === 'enforce' ? 'AKTIF' : iam.iamInfo.mode.toUpperCase()} · Pembaruan #${iam.iamInfo.authzVersion}` : 'MEMUAT...'}
          </Badge>
        </div>
      </div>

      {iam.feedback && (
        <div
          role={iam.feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            iam.feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {iam.feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{iam.feedback.msg}</span>
          </div>
          <button type="button" onClick={() => iam.setFeedback(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(
          [
            ['roles', `Roles (${iam.roles.length})`],
            ['assignments', `User Assignments (${iam.assignments.length})`],
            ['policies', `Aturan Kebijakan (${iam.policies.length})`],
            ['permissions', `Permissions (${iam.permissions.length})`],
            ['inspector', 'Pemeriksa Izin Pengguna'],
            ['audit', `Riwayat Pemeriksaan (${iam.decisions.length})`],
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

      {iam.isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Memuat daftar hak akses...</div>
      ) : (
        <>
          {activeTab === 'roles' && (
            <RolesTab
              roles={iam.roles}
              policies={iam.policies}
              assignments={iam.assignments}
              permissions={iam.permissions}
              onOpenCreateRole={rolesApi.openCreateRole}
              onOpenDetail={rolesApi.openDetail}
              onOpenEditRole={rolesApi.openEditRole}
              onOpenBind={bindApi.openBindFromRole}
              onDeleteRole={rolesApi.requestDeleteRole}
              onUnbind={bindApi.requestUnbind}
            />
          )}

          {activeTab === 'assignments' && (
            <AssignmentsTab
              assignments={iam.assignments}
              operators={iam.operators}
              isSubmitting={iam.isSubmitting}
              onOpenAssign={assignApi.openAssignModal}
              onRevoke={assignApi.requestRevoke}
              onInspect={(operatorId) => {
                inspector.inspectOperator(operatorId);
                setActiveTab('inspector');
              }}
            />
          )}

          {activeTab === 'policies' && (
            <PoliciesTab
              policies={iam.policies}
              isSubmitting={iam.isSubmitting}
              onOpenCreatePolicy={policiesApi.openCreatePolicyModal}
              onEditPolicy={policiesApi.openEditPolicyModal}
              onTogglePolicy={policiesApi.handleTogglePolicy}
              onDeletePolicy={policiesApi.requestDeletePolicy}
            />
          )}

          {activeTab === 'permissions' && (
            <PermissionsTab
              permissions={iam.permissions}
              policies={iam.policies}
              onAssignFromPermission={bindApi.openAssignFromPermission}
            />
          )}

          {activeTab === 'inspector' && (
            <InspectorTab
              operators={iam.operators}
              inspectOperatorId={inspector.inspectOperatorId}
              effectivePerms={inspector.effectivePerms}
              isInspecting={inspector.isInspecting}
              onOperatorChange={inspector.setInspectOperatorId}
              onInspect={inspector.handleInspectSubject}
            />
          )}

          {activeTab === 'audit' && <AuditTab decisions={iam.decisions} />}
        </>
      )}

      <RoleDetailModal
        role={rolesApi.detailRole}
        policies={iam.policies}
        permissions={iam.permissions}
        assignments={iam.assignments}
        isSubmitting={iam.isSubmitting}
        onClose={rolesApi.closeDetail}
        onUnbind={bindApi.requestUnbind}
        onBind={bindApi.openBindFromRole}
      />

      <CreateRoleModal
        isOpen={rolesApi.isRoleModalOpen}
        isSubmitting={iam.isSubmitting}
        onClose={() => !iam.isSubmitting && rolesApi.closeCreateRole()}
        onSubmit={rolesApi.createRole}
      />

      <EditRoleModal
        target={rolesApi.editRoleTarget}
        isSubmitting={iam.isSubmitting}
        onClose={() => !iam.isSubmitting && rolesApi.closeEditRole()}
        onSubmit={rolesApi.updateRole}
      />

      <BindPermissionModal
        isOpen={bindApi.isBindModalOpen}
        isSubmitting={iam.isSubmitting}
        roles={iam.roles}
        permissions={iam.permissions}
        bindLockedMode={bindApi.bindLockedMode}
        bindRoleId={bindApi.bindRoleId}
        selectedPermId={bindApi.selectedPermId}
        bindResourcePattern={bindApi.bindResourcePattern}
        bindEffect={bindApi.bindEffect}
        bindAbacJson={bindApi.bindAbacJson}
        bindReason={bindApi.bindReason}
        onClose={() => !iam.isSubmitting && bindApi.closeBindModal()}
        onRoleIdChange={bindApi.changeBindRoleId}
        onPermIdChange={bindApi.changeSelectedPermId}
        onResourcePatternChange={bindApi.setBindResourcePattern}
        onEffectChange={bindApi.setBindEffect}
        onAbacJsonChange={bindApi.setBindAbacJson}
        onReasonChange={bindApi.setBindReason}
        onSubmit={bindApi.handleBindPermission}
      />

      <AssignUserRoleModal
        isOpen={assignApi.isAssignModalOpen}
        isSubmitting={iam.isSubmitting}
        operators={iam.operators}
        roles={iam.roles}
        defaultOperatorId={assignApi.defaultOperatorId}
        onClose={() => !iam.isSubmitting && assignApi.closeAssignModal()}
        onSubmit={assignApi.assignUserRole}
      />

      <CreatePolicyModal
        isOpen={policiesApi.isPolicyModalOpen}
        isSubmitting={iam.isSubmitting}
        roles={iam.roles}
        permissions={iam.permissions}
        onClose={() => !iam.isSubmitting && policiesApi.closeCreatePolicyModal()}
        onSubmit={policiesApi.createPolicy}
      />

      <EditPolicyModal
        target={policiesApi.editPolicyTarget}
        isSubmitting={iam.isSubmitting}
        onClose={() => !iam.isSubmitting && policiesApi.closeEditPolicyModal()}
        onSubmit={policiesApi.updatePolicy}
      />

      <AccessControlConfirmDialogs
        deleteRoleTarget={rolesApi.deleteRoleTarget}
        unbindTarget={bindApi.unbindTarget}
        revokeTarget={assignApi.revokeTarget}
        deletePolicyTarget={policiesApi.deletePolicyTarget}
        isSubmitting={iam.isSubmitting}
        onCloseDeleteRole={() => !iam.isSubmitting && rolesApi.closeDeleteRole()}
        onCloseUnbind={() => !iam.isSubmitting && bindApi.closeUnbind()}
        onCloseRevoke={() => !iam.isSubmitting && assignApi.closeRevoke()}
        onCloseDeletePolicy={() => !iam.isSubmitting && policiesApi.closeDeletePolicy()}
        onConfirmDeleteRole={rolesApi.confirmDeleteRole}
        onConfirmUnbind={bindApi.confirmUnbindPermission}
        onConfirmRevoke={assignApi.confirmRevokeAssignment}
        onConfirmDeletePolicy={policiesApi.confirmDeletePolicy}
      />
    </div>
  );
};
