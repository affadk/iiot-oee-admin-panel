/**
 * Alur konfirmasi apply/rollback konfigurasi broker (E31.2, FAT-265)
 * — satu alur: modal konfirmasi (action + checkbox + reason) →
 * eksekusi → polling status operasi. Dipisah dari `useBrokerConfig`
 * (R4). `isWorking` dimiliki komposisi dan diteruskan sebagai setter
 * supaya stage + confirm berbagi flag yang sama seperti sebelumnya.
 */
import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { ApiError } from '../../../types/auth';
import type { CapabilityKey } from '../../../utils/capabilities/specs';
import type { BrokerConfirmAction, BrokerFeedback } from './brokerConfigTypes';

// E28 Batch A (B41): versi belum tervalidasi → acknowledgeUnvalidated=true; status tak diketahui → omit.
const ackUnvalidated = (v: BrokerConfirmAction['version']): boolean | undefined =>
  v.validation && v.validation.status !== 'passed' ? true : undefined;

export interface BrokerConfigConfirmDeps {
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  setFeedback: (feedback: BrokerFeedback | null) => void;
  loadConfigState: () => Promise<void>;
  setIsWorking: (working: boolean) => void;
}

export function useBrokerConfigConfirm(deps: BrokerConfigConfirmDeps) {
  const { reportForbidden, setFeedback, loadConfigState, setIsWorking } = deps;

  // Apply / Rollback Confirmation Modal (confirm=true + reason <= 500 + operation polling)
  const [confirmAction, setConfirmAction] = useState<BrokerConfirmAction | null>(null);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [confirmReason, setConfirmReason] = useState('');

  const handleConfirmExecute = async () => {
    if (!confirmAction || !confirmCheckbox) return;
    setIsWorking(true);
    setFeedback(null);
    try {
      const res =
        confirmAction.type === 'APPLY'
          ? await apiClient.applyBrokerConfigVersion(confirmAction.version.version_id, {
              confirm: true,
              reason: confirmReason.trim() || undefined,
              acknowledgeUnvalidated: ackUnvalidated(confirmAction.version),
            })
          : await apiClient.rollbackBrokerConfig(confirmAction.version.version_id, {
              confirm: true,
              reason: confirmReason.trim() || undefined,
              acknowledgeUnvalidated: ackUnvalidated(confirmAction.version),
            });

      // Poll operation status via GET /operations/:id
      const polledOp = await apiClient.getBrokerConfigOperation(res.operation.operation_id);
      const finalStatus = polledOp?.status ?? res.operation.status;

      setConfirmAction(null);
      setConfirmCheckbox(false);
      setConfirmReason('');
      setFeedback({
        type: finalStatus === 'SUCCEEDED' ? 'success' : 'error',
        msg: `${confirmAction.type} ${res.version.version_id} selesai (Operation ${res.operation.operation_id}: ${finalStatus}).`,
      });
      await loadConfigState();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.config.manage', confirmAction.version.version_id, err.message);
      }
      setFeedback({
        type: 'error',
        msg: (err as { message?: string })?.message || 'Gagal mengeksekusi operasi konfigurasi.',
      });
    } finally {
      setIsWorking(false);
    }
  };

  return {
    confirmAction,
    setConfirmAction,
    confirmCheckbox,
    setConfirmCheckbox,
    confirmReason,
    setConfirmReason,
    handleConfirmExecute,
  };
}
