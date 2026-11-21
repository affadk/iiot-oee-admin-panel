import React from 'react';
import { Search } from 'lucide-react';
import { Operator } from '../../../types/production';
import { IamAssignment, IamRole } from '../../../types/iam';
import { isProtectedOperator } from '../../../utils/capabilities';
import { formatDateTime } from '../../../utils/formatDate';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { AssignRoleInput } from '../hooks/useOperatorRoleAssignment';
import { OperatorQuickAssignForm } from './OperatorQuickAssignForm';
import { OperatorRoleAssignments } from './OperatorRoleAssignments';

export interface OperatorDetailModalProps {
  operator: Operator;
  assignments: IamAssignment[];
  iamRoles: IamRole[];
  canManageIam: boolean;
  isRevokingRole: boolean;
  onClose: () => void;
  onRevokeRequest: (assignment: IamAssignment) => void;
  onAssignRole: (input: AssignRoleInput) => Promise<void>;
  /** Page pemilik routing — modal TIDAK memakai useNavigate. */
  onInspectPermissions: () => void;
}

/**
 * Modal detail & multi-role assignment (R9.5, diurai dari IIFE OperatorsPage L650–822).
 * Form quick-assign tinggal di dalam modal; koreksi default role (dulu
 * loadOperators L107–111) ikut pindah: default = role terakhir di `iamRoles`
 * bila nilai saat ini tidak ada di daftar.
 */
export const OperatorDetailModal: React.FC<OperatorDetailModalProps> = ({
  operator,
  assignments,
  iamRoles,
  canManageIam,
  isRevokingRole,
  onClose,
  onRevokeRequest,
  onAssignRole,
  onInspectPermissions,
}) => {
  const userAssignments = assignments.filter((a) => a.operator_id === operator.operator_id);
  const isProtectedRoot = isProtectedOperator(operator);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Detail Operator: ${operator.operator_id}`}
      subtitle={`${operator.name} · Primary Role: ${operator.role} · Line: ${operator.line_id}`}
      footer={
        <div className="flex items-center justify-between w-full">
          {canManageIam ? (
            <Button size="sm" variant="outline" onClick={onInspectPermissions}>
              <Search className="w-3.5 h-3.5" />
              <span>Inspeksi Izin Efektif</span>
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-500">Operator ID:</span>{' '}
            <span className="font-mono font-semibold">{operator.operator_id}</span>
          </div>
          <div>
            <span className="text-slate-500">Status:</span>{' '}
            <Badge variant={operator.is_active ? 'success' : 'danger'}>
              {operator.is_active ? 'ACTIVE' : 'SUSPENDED'}
            </Badge>
          </div>
          <div>
            <span className="text-slate-500">Primary Role:</span>{' '}
            <Badge variant="info">{operator.role}</Badge>
          </div>
          <div>
            <span className="text-slate-500">Line ID:</span>{' '}
            <span className="font-mono">{operator.line_id}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">Dibuat:</span>{' '}
            <span>{formatDateTime(operator.created_at)}</span>
            {isProtectedRoot && (
              <span className="ml-2">
                <Badge variant="warning">Akun Root Dilindungi</Badge>
              </span>
            )}
          </div>
        </div>

        {canManageIam && (
          <>
            <OperatorRoleAssignments
              operatorRole={operator.role}
              userAssignments={userAssignments}
              isProtectedRoot={isProtectedRoot}
              isRevokingRole={isRevokingRole}
              onRevokeRequest={onRevokeRequest}
            />
            <OperatorQuickAssignForm
              operatorId={operator.operator_id}
              iamRoles={iamRoles}
              onAssignRole={onAssignRole}
            />
          </>
        )}
      </div>
    </Modal>
  );
};
