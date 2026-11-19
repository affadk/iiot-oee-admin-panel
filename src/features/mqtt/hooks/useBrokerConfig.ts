import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../../services/api/client';
import { ApiError } from '../../../types/auth';
import {
  BrokerBackup,
  BrokerConfigSchema,
  BrokerConfigStatus,
  BrokerConfigVersion,
  BrokerOperation,
} from '../../../types/mqtt';
import { useAuth, useCapability } from '../../../context/AuthContext';

export type BrokerConfirmAction = { type: 'APPLY' | 'ROLLBACK'; version: BrokerConfigVersion };

export type BrokerDiffResult = { version_id: string; diff_summary: string; changed_keys: string[] };

export type BrokerFeedback = { type: 'success' | 'error'; msg: string };

/**
 * E20 P20.5 (FAT-157): status konfigurasi = bentuk dokumen §3.3b
 * (`BrokerConfigStatus`), bukan asumsi lama `active_version`/`sync_state`.
 */
export type BrokerSyncStatus = BrokerConfigStatus;

export type BrokerValidationIssue = { field?: string; message: string };

/**
 * Semua state + logika BrokerConfigManagerPage KECUALI navigasi tab
 * (`activeTab` tetap di page — stage→versions dilakukan page setelah
 * `handleStageConfig` mengembalikan true).
 */
export const useBrokerConfig = () => {
  const { reportForbidden } = useAuth();
  const canRead = useCapability('mqtt.config.read');
  const canReadRaw = useCapability('mqtt.config.read_raw');
  const canManage = useCapability('mqtt.config.manage');

  const [draftConfig, setDraftConfig] = useState<BrokerConfigSchema | null>(null);
  const [stageSummary, setStageSummary] = useState('Penyesuaian batas koneksi perangkat pabrik');
  const [rawConf, setRawConf] = useState<string | null>(null);
  const [versions, setVersions] = useState<BrokerConfigVersion[]>([]);
  const [operations, setOperations] = useState<BrokerOperation[]>([]);
  const [backups, setBackups] = useState<BrokerBackup[]>([]);
  const [syncStatus, setSyncStatus] = useState<BrokerSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  // Validation 422 issues & general feedback
  const [validationIssues, setValidationIssues] = useState<BrokerValidationIssue[]>([]);
  const [feedback, setFeedback] = useState<BrokerFeedback | null>(null);

  // Diff Viewer Modal
  const [diffResult, setDiffResult] = useState<BrokerDiffResult | null>(null);

  // Apply / Rollback Confirmation Modal (confirm=true + reason <= 500 + operation polling)
  const [confirmAction, setConfirmAction] = useState<BrokerConfirmAction | null>(null);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [confirmReason, setConfirmReason] = useState('');

  const loadConfigState = useCallback(async () => {
    if (!canRead.canInteract) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [cfg, status, verList, opsList, bakList] = await Promise.all([
        apiClient.getBrokerConfig(),
        apiClient.getBrokerConfigStatus(),
        apiClient.getBrokerConfigVersions(100),
        apiClient.getBrokerConfigOperations(50),
        apiClient.getBrokerConfigBackups(),
      ]);
      setDraftConfig(cfg);
      setSyncStatus(status);
      setVersions(verList);
      setOperations(opsList);
      setBackups(bakList);

      // Hanya panggil /raw jika subjek punya capability mqtt.config.read_raw (SUPERVISOR tidak memiliki izin ini)
      if (canReadRaw.canInteract) {
        try {
          const raw = await apiClient.getBrokerConfigRaw();
          setRawConf(raw);
        } catch {
          setRawConf(null);
        }
      } else {
        setRawConf(null);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.config.read', undefined, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat pengaturan koneksi mesin.' });
    } finally {
      setIsLoading(false);
    }
  }, [canRead.canInteract, canReadRaw.canInteract, reportForbidden]);

  useEffect(() => {
    loadConfigState();
  }, [loadConfigState]);

  const handleStageConfig = async (e: FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!draftConfig) return false;
    setIsWorking(true);
    setFeedback(null);
    setValidationIssues([]);
    try {
      const staged = await apiClient.stageBrokerConfig(draftConfig, stageSummary);
      setFeedback({
        type: 'success',
        msg: `Draft konfigurasi staged sebagai ${staged.version_id}. Buka tab Versions untuk Diff & Apply.`,
      });
      await loadConfigState();
      return true;
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.config.manage', undefined, err.message);
      }
      if (err?.issues?.length) {
        setValidationIssues(err.issues);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Staging konfigurasi gagal.' });
      return false;
    } finally {
      setIsWorking(false);
    }
  };

  const handleViewDiff = async (versionId: string) => {
    try {
      const diff = await apiClient.getBrokerConfigDiff(versionId);
      setDiffResult(diff);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal mengambil diff versi.' });
    }
  };

  const handleDiscardStaged = async (versionId: string) => {
    try {
      await apiClient.deleteBrokerConfigVersion(versionId);
      setFeedback({ type: 'success', msg: `Draft staged ${versionId} dibuang.` });
      await loadConfigState();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuang draft staged.' });
    }
  };

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
            })
          : await apiClient.rollbackBrokerConfig(confirmAction.version.version_id, {
              confirm: true,
              reason: confirmReason.trim() || undefined,
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
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.config.manage', confirmAction.version.version_id, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal mengeksekusi operasi konfigurasi.' });
    } finally {
      setIsWorking(false);
    }
  };

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
