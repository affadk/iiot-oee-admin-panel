import React from 'react';
import { Users } from 'lucide-react';
import type { IamAssignment } from '../../../types/iam';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface OperatorRoleAssignmentsProps {
  operatorRole: string;
  userAssignments: IamAssignment[];
  isProtectedRoot: boolean;
  isRevokingRole: boolean;
  onRevokeRequest: (assignment: IamAssignment) => void;
}

/**
 * Daftar penugasan role IAM di modal detail operator (E31.14, FAT-277 —
 * diekstrak dari OperatorDetailModal). Murni render; state tetap di modal.
 */
export const OperatorRoleAssignments: React.FC<OperatorRoleAssignmentsProps> = ({
  operatorRole,
  userAssignments,
  isProtectedRoot,
  isRevokingRole,
  onRevokeRequest,
}) => {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
        <Users className="w-4 h-4 text-sky-600" />
        <span>Penugasan Role IAM ({userAssignments.length})</span>
      </div>
      {userAssignments.length === 0 ? (
        <p className="text-slate-500 italic">
          Belum ada penugasan eksplisit; memakai primary role ({operatorRole}) pada scope ORGANIZATION.
        </p>
      ) : (
        <div className="space-y-1.5">
          {userAssignments.map((a) => {
            const isProtectedAdminAsg = isProtectedRoot && a.role_name === 'ADMIN';
            return (
              <div
                key={a.id}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="info">{a.role_name}</Badge>
                  <span className="font-mono">
                    {a.scope_type}
                    {a.scope_id ? ` (${a.scope_id})` : ' (Global Plant)'}
                  </span>
                  <Badge variant={a.scope_type === 'ORGANIZATION' ? 'success' : 'neutral'}>
                    {a.scope_type === 'ORGANIZATION' ? 'Efektif' : 'Persiapan'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={isProtectedAdminAsg || isRevokingRole}
                  onClick={() => onRevokeRequest(a)}
                >
                  Revoke
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
