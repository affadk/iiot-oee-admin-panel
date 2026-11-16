import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { BrokerConfigVersion } from '../../types/mqtt';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useBrokerConfig } from './hooks/useBrokerConfig';
import { BrokerConfigEditorTab } from './components/BrokerConfigEditorTab';
import { BrokerVersionsTab } from './components/BrokerVersionsTab';
import { BrokerOperationsTab } from './components/BrokerOperationsTab';
import { BrokerBackupsTab } from './components/BrokerBackupsTab';
import { BrokerRawTab } from './components/BrokerRawTab';
import { BrokerDiffModal } from './components/BrokerDiffModal';
import { BrokerConfirmModal } from './components/BrokerConfirmModal';

type ConfigTab = 'editor' | 'versions' | 'operations' | 'backups' | 'raw';

export const BrokerConfigManagerPage: React.FC = () => {
  const {
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
  } = useBrokerConfig();

  const [activeTab, setActiveTab] = useState<ConfigTab>('editor');

  // Stage sukses → pindah ke tab versions (hook tidak memiliki activeTab).
  const handleStage = async (e: React.FormEvent) => {
    const staged = await handleStageConfig(e);
    if (staged) setActiveTab('versions');
  };

  // Prefill confirm atomik: action + reason (+ reset checkbox) dalam satu callback.
  const handleRequestApply = (version: BrokerConfigVersion) => {
    setConfirmAction({ type: 'APPLY', version });
    setConfirmCheckbox(false);
    setConfirmReason(version.summary);
  };

  const handleRequestRollback = (version: BrokerConfigVersion) => {
    setConfirmAction({ type: 'ROLLBACK', version });
    setConfirmCheckbox(false);
    setConfirmReason(`Rollback ke ${version.version_id}`);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat pengaturan koneksi mesin...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Pengaturan Konfigurasi Broker Mesin
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Alur perubahan aman: Simpan Draf → Tinjau Perbedaan → Konfirmasi Terapkan atau Kembalikan Versi Sebelumnya.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {syncStatus && (
            <Badge variant={syncStatus.sync_state === 'IN_SYNC' ? 'success' : 'warning'}>
              {syncStatus.sync_state} · {syncStatus.active_version}
            </Badge>
          )}
          <Button size="sm" variant="secondary" onClick={loadConfigState}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {validationIssues.length > 0 && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 text-xs text-red-900 dark:text-red-200 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Pemeriksaan Validasi Pengaturan:
          </div>
          <ul className="list-disc pl-5">
            {validationIssues.map((iss, idx) => (
              <li key={idx}>
                {iss.field ? <strong>{iss.field}: </strong> : null}
                {iss.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
            activeTab === 'editor' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          Editor &amp; Simpan Draf
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
            activeTab === 'versions' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          Riwayat Versi &amp; Perbedaan ({versions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
            activeTab === 'operations' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          Riwayat Penerapan ({operations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backups')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
            activeTab === 'backups' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          Cadangan ({backups.length})
        </button>
        {canReadRaw.canInteract && (
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              activeTab === 'raw' ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Tampilan Konfigurasi Teknis (Admin)
          </button>
        )}
      </div>

      {/* TAB 1: STRUCTURED EDITOR + STAGE */}
      {activeTab === 'editor' && draftConfig && (
        <BrokerConfigEditorTab
          draftConfig={draftConfig}
          onDraftChange={setDraftConfig}
          stageSummary={stageSummary}
          onStageSummaryChange={setStageSummary}
          onStage={handleStage}
          isWorking={isWorking}
          canManage={canManage}
        />
      )}

      {/* TAB 2: VERSIONS & DIFF */}
      {activeTab === 'versions' && (
        <BrokerVersionsTab
          versions={versions}
          canManage={canManage}
          onViewDiff={handleViewDiff}
          onDiscard={handleDiscardStaged}
          onRequestApply={handleRequestApply}
          onRequestRollback={handleRequestRollback}
        />
      )}

      {/* TAB 3: OPERATIONS LOG */}
      {activeTab === 'operations' && <BrokerOperationsTab operations={operations} />}

      {/* TAB 4: BACKUPS */}
      {activeTab === 'backups' && <BrokerBackupsTab backups={backups} />}

      {/* TAB 5: RAW CONF (ADMIN ONLY) */}
      {activeTab === 'raw' && canReadRaw.canInteract && <BrokerRawTab rawConf={rawConf} />}

      {/* Diff Modal */}
      <BrokerDiffModal diffResult={diffResult} onClose={() => setDiffResult(null)} />

      {/* Explicit confirm:true Apply / Rollback Modal */}
      <BrokerConfirmModal
        confirmAction={confirmAction}
        onClose={() => !isWorking && setConfirmAction(null)}
        confirmReason={confirmReason}
        onReasonChange={setConfirmReason}
        confirmCheckbox={confirmCheckbox}
        onCheckboxChange={setConfirmCheckbox}
        onExecute={handleConfirmExecute}
        isWorking={isWorking}
      />
    </div>
  );
};
