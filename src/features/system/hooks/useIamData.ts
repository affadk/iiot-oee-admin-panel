import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type {
  IamAssignment,
  IamAuditDecision,
  IamInfo,
  IamPermission,
  IamPolicyRule,
  IamRole,
} from '../../../types/iam';
import type { Operator } from '../../../types/production';
import { ApiError } from '../../../types/auth';
import { useAuth, useCapability } from '../../../context/AuthContext';
import type { IamFeedback } from '../accessControlTypes';

/**
 * Data + loading + corong mutasi AccessControlPage.
 *
 * Memuat ketujuh list sekaligus (Promise.all) dan memuat ulang semuanya
 * setelah setiap mutasi via afterMutation: reload → refreshCapabilities →
 * banner sukses + advisory authz_version. Urutan ini load-bearing: mutasi
 * bisa mengunci admin itu sendiri di tengah sesi bila capabilities stale.
 *
 * Catatan default form: loader versi lama juga men-default-kan
 * assignOperatorId / selectedPermId dari item pertama (prev || first).
 * Default itu TIDAK lagi di sini — assignOperatorId dihitung hook
 * useAssignments (defaultOperatorId) dan selectedPermId di-default-kan
 * useRolePermissions via useEffect atas permissions, keduanya dengan
 * semantik "hanya bila kosong" yang sama.
 */
export const useIamData = () => {
  const { reportForbidden, refreshCapabilities } = useAuth();
  // §3.4: baca IAM digate `access_control.read`, tulis `access_control.manage`.
  const canRead = useCapability('access_control.read');
  const canManage = useCapability('access_control.manage');

  const [iamInfo, setIamInfo] = useState<IamInfo | null>(null);
  const [roles, setRoles] = useState<IamRole[]>([]);
  const [permissions, setPermissions] = useState<IamPermission[]>([]);
  const [assignments, setAssignments] = useState<IamAssignment[]>([]);
  const [policies, setPolicies] = useState<IamPolicyRule[]>([]);
  const [decisions, setDecisions] = useState<IamAuditDecision[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feedback, setFeedback] = useState<IamFeedback | null>(null);

  const reportError = useCallback(
    (err: unknown, fallbackMsg: string, resourceId?: string) => {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('access_control.manage', resourceId, err.message);
      }
      const message = err instanceof Error ? err.message : fallbackMsg;
      setFeedback({ type: 'error', msg: message || fallbackMsg });
    },
    [reportForbidden],
  );

  const loadIamData = useCallback(async (): Promise<IamInfo | null> => {
    if (!canRead.canInteract) {
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
      return info;
    } catch (err: unknown) {
      reportError(err, 'Gagal memuat data hak akses pengguna.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [canRead.canInteract, reportError]);

  useEffect(() => {
    void loadIamData();
  }, [loadIamData]);

  /**
   * Muat ulang keputusan audit dengan filter server (§3.4:
   * subject/decision/mode/from/to).
   */
  const reloadDecisions = useCallback(
    async (filters: import('../../../types/iam').IamAuditFilters): Promise<void> => {
      try {
        const decList = await apiClient.getIamAuditDecisions(filters);
        setDecisions(decList);
      } catch (err: unknown) {
        reportError(err, 'Gagal memuat keputusan audit IAM.');
      }
    },
    [reportError],
  );

  const handleAfterMutation = useCallback(
    async (msg: string, bumpsAuthz = true) => {
      const info = await loadIamData();
      await refreshCapabilities();
      const advisory =
        bumpsAuthz && info
          ? ` Pembaruan kebijakan menaikkan authz_version ke #${info.authzVersion} — sesi lain dengan token lama akan berakhir (401) dan perlu login ulang.`
          : '';
      setFeedback({ type: 'success', msg: `${msg}${advisory}` });
    },
    [loadIamData, refreshCapabilities],
  );

  return {
    iamInfo,
    roles,
    permissions,
    assignments,
    policies,
    decisions,
    operators,
    isLoading,
    isSubmitting,
    setIsSubmitting,
    feedback,
    setFeedback,
    reload: loadIamData,
    reloadDecisions,
    afterMutation: handleAfterMutation,
    reportError,
    canRead,
    canManage,
  };
};
