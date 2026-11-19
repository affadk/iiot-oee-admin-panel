import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { Operator } from '../../../types/production';
import { IamAssignment, IamRole } from '../../../types/iam';
import { ApiError, UserRole } from '../../../types/auth';
import { useAuth, useCapability } from '../../../context/AuthContext';

export const ALL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'];

/** Bentuk objek tunggal ala Machines/Devices — menggantikan errorMsg/successMsg. */
export interface FeedbackState {
  type: 'success' | 'error';
  msg: string;
}

export interface UseOperatorsOptions {
  detailOperatorId: string | null;
}

/**
 * Daftar operator + IAM (R9.5, dipindah dari OperatorsPage L37–40, 89–129, 344–366).
 * `operators` + `assignments` tetap satu hook: filter role mencocokkan via
 * assignments, bukan `op.role` (L347–349).
 */
export function useOperators({ detailOperatorId }: UseOperatorsOptions) {
  const { currentUser, reportForbidden, checkCapability, refreshCapabilities } = useAuth();
  const canRead = useCapability('operator.read');
  const canCreate = useCapability('operator.create');
  // Daftar role otoritatif dibaca via GET /access-control/roles (digate read).
  const canManageIam = useCapability('access_control.read');

  const [operators, setOperators] = useState<Operator[]>([]);
  const [iamRoles, setIamRoles] = useState<IamRole[]>([]);
  const [assignments, setAssignments] = useState<IamAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Filters (dipakai OperatorsToolbar + filteredOperators)
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  const loadOperators = useCallback(async () => {
    if (!canRead.canInteract) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    try {
      const list = await apiClient.getOperators();
      setOperators(list);
      if (canManageIam.canInteract) {
        const [rolesList, userRolesList] = await Promise.all([
          apiClient.getIamRoles(),
          apiClient.getIamUserRoles(),
        ]);
        setIamRoles(rolesList);
        setAssignments(userRolesList);
      } else {
        setIamRoles([]);
        setAssignments([]);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.read', undefined, err.message);
      }
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Gagal memuat daftar operator.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [canRead.canInteract, canManageIam.canInteract, reportForbidden]);

  useEffect(() => {
    void loadOperators();
  }, [loadOperators]);

  // Role string bebas (§H): daftar otoritatif dari GET /access-control/roles;
  // fallback 4 preset bila list kosong (mis. tanpa hak baca IAM).
  const assignableRoles = useMemo(
    () => (iamRoles.length > 0 ? iamRoles.map((r) => r.name) : [...ALL_ROLES]),
    [iamRoles],
  );

  const filteredOperators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return operators.filter((op) => {
      if (roleFilter !== 'ALL') {
        const hasAssigned = assignments.some((a) => a.operator_id === op.operator_id && a.role_name === roleFilter);
        if (op.role !== roleFilter && !hasAssigned) return false;
      }
      if (statusFilter === 'ACTIVE' && !op.is_active) return false;
      if (statusFilter === 'SUSPENDED' && op.is_active) return false;
      if (!q) return true;
      return (
        op.operator_id.toLowerCase().includes(q) ||
        op.name.toLowerCase().includes(q) ||
        op.line_id.toLowerCase().includes(q) ||
        op.role.toLowerCase().includes(q)
      );
    });
  }, [operators, assignments, searchQuery, roleFilter, statusFilter]);

  const detailOperator = useMemo(
    () => (detailOperatorId ? operators.find((o) => o.operator_id === detailOperatorId) ?? null : null),
    [detailOperatorId, operators]
  );

  return {
    operators,
    iamRoles,
    assignments,
    isLoading,
    feedback,
    setFeedback,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    loadOperators,
    assignableRoles,
    filteredOperators,
    detailOperator,
    currentUser,
    reportForbidden,
    refreshCapabilities,
    checkCapability,
    canRead,
    canCreate,
    canManageIam,
  };
}
