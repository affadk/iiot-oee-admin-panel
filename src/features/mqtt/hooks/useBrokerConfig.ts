/**
 * Komposisi alur konfigurasi broker (E31.2, FAT-265).
 *
 * Dulu satu hook 249 baris (tepat di batas keras) yang melayani 5 alur
 * sekaligus; kini tiap alur tinggal di hook-nya sendiri (R4) dan file
 * ini hanya menggabungkan mereka + `isWorking` yang dipakai bersama
 * stage + confirm. Bentuk kembalian IDENTIK dengan sebelumnya — satu
 * pemanggil (`BrokerConfigManagerPage`) tidak berubah sama sekali.
 *
 * - Load (draft/status/versions/operations/backups/raw): `useBrokerConfigLoad`
 * - Feedback + issue validasi: `useBrokerConfigFeedback`
 * - Stage draft: `useBrokerConfigStage`
 * - Diff + buang draft staged: `useBrokerConfigVersions`
 * - Konfirmasi apply/rollback: `useBrokerConfigConfirm`
 *
 * Semua state + logika BrokerConfigManagerPage KECUALI navigasi tab
 * (`activeTab` tetap di page — stage→versions dilakukan page setelah
 * `handleStageConfig` mengembalikan true).
 */
import { useState } from 'react';
import { useAuth, useCapability } from '../../../context/AuthContext';
import { useBrokerConfigFeedback } from './useBrokerConfigFeedback';
import { useBrokerConfigLoad } from './useBrokerConfigLoad';
import { useBrokerConfigStage } from './useBrokerConfigStage';
import { useBrokerConfigVersions } from './useBrokerConfigVersions';
import { useBrokerConfigConfirm } from './useBrokerConfigConfirm';

export type {
  BrokerConfirmAction,
  BrokerDiffResult,
  BrokerFeedback,
  BrokerSyncStatus,
  BrokerValidationIssue,
} from './brokerConfigTypes';

export const useBrokerConfig = () => {
  const { reportForbidden } = useAuth();
  const canRead = useCapability('mqtt.config.read');
  const canReadRaw = useCapability('mqtt.config.read_raw');
  const canManage = useCapability('mqtt.config.manage');

  // Dibagi stage + confirm (satu flag seperti sebelumnya).
  const [isWorking, setIsWorking] = useState(false);

  const { validationIssues, setValidationIssues, feedback, setFeedback } = useBrokerConfigFeedback();

  const {
    draftConfig,
    setDraftConfig,
    rawConf,
    versions,
    operations,
    backups,
    syncStatus,
    isLoading,
    loadConfigState,
  } = useBrokerConfigLoad({
    canReadInteract: canRead.canInteract,
    canReadRawInteract: canReadRaw.canInteract,
    reportForbidden,
    setFeedback,
  });

  const { stageSummary, setStageSummary, handleStageConfig } = useBrokerConfigStage({
    draftConfig,
    setValidationIssues,
    setFeedback,
    loadConfigState,
    setIsWorking,
    reportForbidden,
  });

  const { diffResult, setDiffResult, handleViewDiff, handleDiscardStaged } = useBrokerConfigVersions({
    setFeedback,
    loadConfigState,
  });

  const {
    confirmAction,
    setConfirmAction,
    confirmCheckbox,
    setConfirmCheckbox,
    confirmReason,
    setConfirmReason,
    handleConfirmExecute,
  } = useBrokerConfigConfirm({
    reportForbidden,
    setFeedback,
    loadConfigState,
    setIsWorking,
  });

  return {
    canRead,
    canReadRaw,
    canManage,
    draftConfig,
    setDraftConfig,
    stageSummary,
    setStageSummary,
    rawConf,
    versions,
    operations,
    backups,
    syncStatus,
    isLoading,
    isWorking,
    validationIssues,
    feedback,
    setFeedback,
    diffResult,
    setDiffResult,
    confirmAction,
    setConfirmAction,
    confirmCheckbox,
    setConfirmCheckbox,
    confirmReason,
    setConfirmReason,
    loadConfigState,
    handleStageConfig,
    handleViewDiff,
    handleDiscardStaged,
    handleConfirmExecute,
  };
};
