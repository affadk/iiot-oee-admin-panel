import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { IamEffectivePermissions } from '../../../types/iam';
import type { IamFeedback, IamTab } from '../accessControlTypes';

interface UseInspectorOptions {
  activeTab: IamTab;
  initialOpParam: string | null;
  canInteract: boolean;
  operatorsLength: number;
  reportError: (err: unknown, fallbackMsg: string, resourceId?: string) => void;
  setFeedback: (feedback: IamFeedback | null) => void;
}

/**
 * Debug Effective Permissions Inspector.
 *
 * Deep-link `?operator=` (useEffect #2) sengaja fire-and-forget dengan
 * `.catch(() => undefined)`: tanpa feedback error, tanpa isInspecting.
 * Perbedaan swallow-vs-report ini dipertahankan dengan sengaja — JANGAN
 * "memperbaiki" jadi reportError. handleInspectSubject (submit form)
 * sebaliknya melaporkan error via reportError.
 */
export const useInspector = ({
  activeTab,
  initialOpParam,
  canInteract,
  operatorsLength,
  reportError,
  setFeedback,
}: UseInspectorOptions) => {
  const [inspectOperatorId, setInspectOperatorId] = useState(initialOpParam || 'SUP-042');
  const [effectivePerms, setEffectivePerms] = useState<IamEffectivePermissions | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  useEffect(() => {
    if (initialOpParam && activeTab === 'inspector' && canInteract && operatorsLength > 0) {
      setInspectOperatorId(initialOpParam);
      void apiClient
        .getSubjectEffectivePermissions(initialOpParam)
        .then(setEffectivePerms)
        .catch(() => undefined);
    }
  }, [initialOpParam, activeTab, canInteract, operatorsLength]);

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

  // Tombol Inspect di tab Assignments: fire-and-forget yang sama seperti
  // deep-link (tanpa isInspecting, error di-swallow).
  const inspectOperator = (operatorId: string) => {
    setInspectOperatorId(operatorId);
    void apiClient
      .getSubjectEffectivePermissions(operatorId)
      .then(setEffectivePerms)
      .catch(() => undefined);
  };

  return {
    inspectOperatorId,
    setInspectOperatorId,
    effectivePerms,
    isInspecting,
    handleInspectSubject,
    inspectOperator,
  };
};
