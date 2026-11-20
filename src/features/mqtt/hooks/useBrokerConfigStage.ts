/**
 * Alur stage konfigurasi broker (E31.2, FAT-265) — satu alur: draft
 * editor → `stageBrokerConfig` (+ tampilkan hasil validasi). Dipisah
 * dari `useBrokerConfig` (R4). `isWorking` dimiliki komposisi dan
 * diteruskan sebagai setter supaya stage + confirm berbagi flag yang
 * sama seperti sebelumnya.
 */
import { useState, type FormEvent } from 'react';
import { apiClient } from '../../../services/api/client';
import { ApiError } from '../../../types/auth';
import type { BrokerConfigSchema } from '../../../types/mqtt';
import type { CapabilityKey } from '../../../utils/capabilities/specs';
import type { BrokerFeedback, BrokerValidationIssue } from './brokerConfigTypes';

export interface BrokerConfigStageDeps {
  draftConfig: BrokerConfigSchema | null;
  setValidationIssues: (issues: BrokerValidationIssue[]) => void;
  setFeedback: (feedback: BrokerFeedback | null) => void;
  loadConfigState: () => Promise<void>;
  setIsWorking: (working: boolean) => void;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
}

export function useBrokerConfigStage(deps: BrokerConfigStageDeps) {
  const { draftConfig, setValidationIssues, setFeedback, loadConfigState, setIsWorking, reportForbidden } = deps;

  const [stageSummary, setStageSummary] = useState('Penyesuaian batas koneksi perangkat pabrik');

  const handleStageConfig = async (e: FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!draftConfig) return false;
    setIsWorking(true);
    setFeedback(null);
    setValidationIssues([]);
    try {
      const staged = await apiClient.stageBrokerConfig(draftConfig, stageSummary);
      // E23 Batch 1 (FAT-181, N-12): respons stage menyertakan validation/
      // impact/diff — tampilkan status validasi, jangan dibuang.
      const validation = staged.validation;
      if (validation) {
        if (validation.issues.length > 0) {
          setValidationIssues(validation.issues.map((iss) => ({ field: iss.field, message: iss.message })));
        }
        setFeedback({
          type: validation.status === 'failed' ? 'error' : 'success',
          msg: `Draft konfigurasi staged sebagai ${staged.version_id}. Validasi: ${validation.status}${
            validation.status === 'failed' ? ` (${validation.issues.length} issue)` : ''
          }. Buka tab Versions untuk Diff & Apply.`,
        });
      } else {
        setFeedback({
          type: 'success',
          msg: `Draft konfigurasi staged sebagai ${staged.version_id}. Buka tab Versions untuk Diff & Apply.`,
        });
      }
      await loadConfigState();
      return true;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.config.manage', undefined, err.message);
      }
      const issues = (err as { issues?: BrokerValidationIssue[] })?.issues;
      if (issues?.length) {
        setValidationIssues(issues);
      }
      setFeedback({
        type: 'error',
        msg: (err as { message?: string })?.message || 'Staging konfigurasi gagal.',
      });
      return false;
    } finally {
      setIsWorking(false);
    }
  };

  return { stageSummary, setStageSummary, handleStageConfig };
}
