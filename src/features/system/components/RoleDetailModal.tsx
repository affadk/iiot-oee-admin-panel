import { useMemo } from 'react';
import type { IamAssignment, IamPermission, IamPolicyRule, IamRole } from '../../../types/iam';
import { isReservedPermission } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

interface RoleDetailModalProps {
  role: IamRole | null;
  policies: IamPolicyRule[];
  permissions: IamPermission[];
  assignments: IamAssignment[];
  isSubmitting: boolean;
  onClose: () => void;
  onUnbind: (role: IamRole, permissionId: string, label: string) => void;
  onBind: (role: IamRole, permission: IamPermission) => void;
}

/** Modal Detail Role & Permission Matrix (Workflow A & B). Locals IIFE dulu kini useMemo. */
export const RoleDetailModal: React.FC<RoleDetailModalProps> = ({
  role,
  policies,
  permissions,
  assignments,
  isSubmitting,
  onClose,
  onUnbind,
  onBind,
}) => {
  const boundRules = useMemo(
    () => (role ? policies.filter((p) => p.roleId === role.id && Boolean(p.permissionId)) : []),
    [role, policies],
  );
  const boundPermIds = useMemo(() => new Set(boundRules.map((b) => b.permissionId).filter(Boolean)), [boundRules]);
  const availablePerms = useMemo(
    () => permissions.filter((p) => !boundPermIds.has(p.id)),
    [permissions, boundPermIds],
  );
  const roleAssignments = useMemo(
    () =>
      role
        ? assignments.filter((a) => a.role_id === role.id || a.role_name === role.name)
        : [],
    [role, assignments],
  );

  if (!role) return null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Detail Role: ${role.name}`}
      subtitle={`${role.is_system ? 'System Protected Role' : 'Custom Role'} · ID: ${role.id}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-slate-500">
            {roleAssignments.length} user terhubung · {boundRules.length} permission terhubung
          </div>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs max-h-[65vh] overflow-y-auto pr-1">
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={role.is_system ? 'warning' : 'info'}>
              {role.is_system ? 'SYSTEM ROLE' : 'CUSTOM ROLE'}
            </Badge>
            <Badge variant={roleAssignments.length > 0 ? 'success' : 'neutral'}>
              {roleAssignments.length > 0 ? `Digunakan (${roleAssignments.length} user)` : 'Belum digunakan'}
            </Badge>
          </div>
          <p className="text-slate-700 dark:text-slate-300">{role.description}</p>
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
                const permObj = permissions.find((p) => p.id === br.permissionId);
                const permLabel = permObj
                  ? `${permObj.action}:${permObj.resourceType}`
                  : `${br.action} (${br.resourcePattern})`;
                return (
                  <div
                    key={br.id}
                    className="p-2 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <Badge variant={br.effect === 'ALLOW' ? 'success' : 'danger'}>{br.effect}</Badge>
                        <span className="font-semibold">{permLabel}</span>
                        <span className="text-slate-500">({br.resourcePattern})</span>
                      </div>
                      {permObj && <div className="text-[11px] text-slate-500 mt-0.5">{permObj.description}</div>}
                    </div>
                    {role.name !== 'ADMIN' && br.permissionId && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isSubmitting}
                        onClick={() => onUnbind(role, br.permissionId!, permLabel)}
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
              const reservedBlocked = !role.is_system && isReservedPermission(p.action, p.resourceType);
              return (
                <div
                  key={p.id}
                  className="p-2 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {p.action}:{p.resourceType}
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
                    onClick={() => onBind(role, p)}
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
};
