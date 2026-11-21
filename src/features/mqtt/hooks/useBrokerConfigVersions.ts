/**
 * Alur versions konfigurasi broker (E31.2, FAT-265) — satu alur:
 * lihat diff versi + buang draft staged. Dipisah dari `useBrokerConfig`
 * (R4). State modal diff (`diffResult`) tinggal di sini, bukan di
 * komposisi — pemanggil tetap mendapatkannya lewat komposisi.
 */
import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import type { BrokerFeedback, BrokerDiffResult } from './brokerConfigTypes';

export interface BrokerConfigVersionsDeps {
  setFeedback: (feedback: BrokerFeedback | null) => void;
  loadConfigState: () => Promise<void>;
}

export function useBrokerConfigVersions(deps: BrokerConfigVersionsDeps) {
  const { setFeedback, loadConfigState } = deps;

  // Diff Viewer Modal
  const [diffResult, setDiffResult] = useState<BrokerDiffResult | null>(null);

  const handleViewDiff = async (versionId: string) => {
    try {
      const diff = await apiClient.getBrokerConfigDiff(versionId);
      setDiffResult(diff);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        msg: (err as { message?: string })?.message || 'Gagal mengambil diff versi.',
      });
    }
  };

  const handleDiscardStaged = async (versionId: string) => {
    try {
      await apiClient.deleteBrokerConfigVersion(versionId);
      setFeedback({ type: 'success', msg: `Draft staged ${versionId} dibuang.` });
      await loadConfigState();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        msg: (err as { message?: string })?.message || 'Gagal membuang draft staged.',
      });
    }
  };

  return { diffResult, setDiffResult, handleViewDiff, handleDiscardStaged };
}
