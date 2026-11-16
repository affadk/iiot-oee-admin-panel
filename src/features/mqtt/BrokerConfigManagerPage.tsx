import React, { useEffect, useState, useCallback } from 'react';
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  Trash2,
  GitCompare,
  Save,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../services/api/client';
import {
  BrokerConfigSchema,
  BrokerConfigVersion,
  BrokerOperation,
  BrokerBackup,
} from '../../types/mqtt';
import { ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

type ConfigTab = 'editor' | 'versions' | 'operations' | 'backups' | 'raw';

export const BrokerConfigManagerPage: React.FC = () => {
  const { reportForbidden } = useAuth();
  const canRead = useCapability('mqtt.config.read');
  const canReadRaw = useCapability('mqtt.config.read_raw');
  const canManage = useCapability('mqtt.config.manage');

  const [activeTab, setActiveTab] = useState<ConfigTab>('editor');
  const [draftConfig, setDraftConfig] = useState<BrokerConfigSchema | null>(null);
  const [stageSummary, setStageSummary] = useState('Penyesuaian batas koneksi perangkat pabrik');
  const [rawConf, setRawConf] = useState<string | null>(null);
  const [versions, setVersions] = useState<BrokerConfigVersion[]>([]);
  const [operations, setOperations] = useState<BrokerOperation[]>([]);
  const [backups, setBackups] = useState<BrokerBackup[]>([]);
  const [syncStatus, setSyncStatus] = useState<{
    active_version: string;
    sync_state: string;
    last_applied_at: string;
    mutation_locked: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  // Validation 422 issues & general feedback
  const [validationIssues, setValidationIssues] = useState<Array<{ field?: string; message: string }>>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Diff Viewer Modal
  const [diffResult, setDiffResult] = useState<{ version_id: string; diff_summary: string; changed_keys: string[] } | null>(null);

  // Apply / Rollback Confirmation Modal (confirm=true + reason <= 500 + operation polling)
  const [confirmAction, setConfirmAction] = useState<{ type: 'APPLY' | 'ROLLBACK'; version: BrokerConfigVersion } | null>(null);
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

  const handleStageConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftConfig) return;
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
      setActiveTab('versions');
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.config.manage', undefined, err.message);
      }
      if (err?.issues?.length) {
        setValidationIssues(err.issues);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Staging konfigurasi gagal.' });
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
        <form onSubmit={handleStageConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">General &amp; Persistence</h2>
              <Input
                label="Autosave Interval (detik, min 60)"
                type="number"
                value={draftConfig.general.autosave_interval_seconds}
                disabled={!canManage.canInteract}
                onChange={(e) =>
                  setDraftConfig({
                    ...draftConfig,
                    general: { ...draftConfig.general, autosave_interval_seconds: Number(e.target.value) },
                  })
                }
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  disabled={!canManage.canInteract}
                  checked={draftConfig.general.allow_anonymous}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      general: { ...draftConfig.general, allow_anonymous: e.target.checked },
                    })
                  }
                />
                <span>Izinkan Koneksi Tanpa Kata Sandi (Wajib nonaktif di produksi)</span>
              </label>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connection &amp; Queue Limits</h2>
              <Input
                label="Max Connections (10–50.000)"
                type="number"
                value={draftConfig.limits.max_connections}
                disabled={!canManage.canInteract}
                onChange={(e) =>
                  setDraftConfig({
                    ...draftConfig,
                    limits: { ...draftConfig.limits, max_connections: Number(e.target.value) },
                  })
                }
              />
              <Input
                label="Max Queued Messages"
                type="number"
                value={draftConfig.limits.max_queued_messages}
                disabled={!canManage.canInteract}
                onChange={(e) =>
                  setDraftConfig({
                    ...draftConfig,
                    limits: { ...draftConfig.limits, max_queued_messages: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1">
              <Input
                label="Ringkasan Perubahan"
                value={stageSummary}
                disabled={!canManage.canInteract}
                onChange={(e) => setStageSummary(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              isLoading={isWorking}
              disabled={!canManage.canInteract}
              title={!canManage.canInteract ? canManage.reason : 'Simpan draf untuk ditinjau sebelum diterapkan'}
            >
              <Save className="w-4 h-4" />
              <span>Simpan Draf Pengaturan</span>
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: VERSIONS & DIFF */}
      {activeTab === 'versions' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
                <th className="py-3 px-4">Version ID &amp; Summary</th>
                <th className="py-3 px-4">Applied By / Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Workflow Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {versions.map((ver) => (
                <tr key={ver.version_id}>
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{ver.version_id}</div>
                    <div className="text-slate-500 mt-0.5">{ver.summary}</div>
                  </td>
                  <td className="py-3 px-4 font-tabular text-slate-500">
                    <div>{ver.applied_by}</div>
                    <div>{new Date(ver.applied_at).toLocaleString()}</div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        ver.status === 'ACTIVE'
                          ? 'success'
                          : ver.status === 'STAGED'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {ver.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    <Button size="sm" variant="outline" onClick={() => handleViewDiff(ver.version_id)}>
                      <GitCompare className="w-3.5 h-3.5" />
                      <span>Diff</span>
                    </Button>
                    {ver.status === 'STAGED' && (
                      <>
                        <Button
                          size="sm"
                          disabled={!canManage.canInteract}
                          onClick={() => {
                            setConfirmAction({ type: 'APPLY', version: ver });
                            setConfirmCheckbox(false);
                            setConfirmReason(ver.summary);
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Apply</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!canManage.canInteract}
                          onClick={() => handleDiscardStaged(ver.version_id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Discard</span>
                        </Button>
                      </>
                    )}
                    {ver.status !== 'ACTIVE' && ver.status !== 'STAGED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canManage.canInteract}
                        onClick={() => {
                          setConfirmAction({ type: 'ROLLBACK', version: ver });
                          setConfirmCheckbox(false);
                          setConfirmReason(`Rollback ke ${ver.version_id}`);
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rollback</span>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: OPERATIONS LOG */}
      {activeTab === 'operations' && (
        <div className="space-y-3">
          {operations.map((op) => (
            <div
              key={op.operation_id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-tabular">
                  <History className="w-4 h-4 text-sky-500" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">{op.operation_id}</span>
                  <Badge variant="info">{op.type}</Badge>
                  <span className="text-slate-500">Version: {op.version_id}</span>
                </div>
                <Badge variant={op.status === 'SUCCEEDED' ? 'success' : op.status === 'FAILED' ? 'danger' : 'warning'}>
                  {op.status}
                </Badge>
              </div>
              {op.reason && <div className="text-slate-600 dark:text-slate-300">Reason: {op.reason}</div>}
              {op.steps && op.steps.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {op.steps.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]"
                    >
                      {s.step}: {s.status}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: BACKUPS */}
      {activeTab === 'backups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {backups.map((b) => (
            <div
              key={b.backup_id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 text-sky-500 shrink-0" />
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{b.filename}</div>
                  <div className="text-slate-500 font-tabular">
                    Version {b.version_id} · {b.size_bytes} bytes
                  </div>
                </div>
              </div>
              <span className="text-slate-400 font-tabular">{new Date(b.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: RAW CONF (ADMIN ONLY) */}
      {activeTab === 'raw' && canReadRaw.canInteract && (
        <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileCode2 className="w-4 h-4 text-sky-400" />
            <span>Tampilan berkas konfigurasi broker aktif (hanya baca)</span>
          </div>
          <pre className="text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
            {rawConf || 'Tidak tersedia'}
          </pre>
        </div>
      )}

      {/* Diff Modal */}
      <Modal
        isOpen={Boolean(diffResult)}
        onClose={() => setDiffResult(null)}
        title={`Diff Konfigurasi: ${diffResult?.version_id ?? ''}`}
        footer={<Button onClick={() => setDiffResult(null)}>Tutup</Button>}
      >
        {diffResult && (
          <div className="space-y-3 text-xs">
            <p className="font-medium text-slate-800 dark:text-slate-200">{diffResult.diff_summary}</p>
            <div>
              <div className="text-slate-400 mb-1">Changed Schema Keys:</div>
              <div className="flex flex-wrap gap-1.5">
                {diffResult.changed_keys.map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 font-mono text-sky-800 dark:text-sky-300">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Explicit confirm:true Apply / Rollback Modal */}
      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => !isWorking && setConfirmAction(null)}
        title={
          confirmAction
            ? `${confirmAction.type === 'APPLY' ? 'Apply' : 'Rollback'} Versi ${confirmAction.version.version_id}`
            : 'Konfirmasi Broker Operation'
        }
        subtitle="Harap centang konfirmasi persetujuan dan tuliskan alasan perubahan (maksimal 500 karakter)."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmAction(null)} disabled={isWorking}>
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={!confirmCheckbox}
              isLoading={isWorking}
              onClick={handleConfirmExecute}
            >
              Eksekusi {confirmAction?.type}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
            Operasi ini akan memuat ulang layanan komunikasi mesin dan membuat cadangan otomatis sebelumnya.
          </div>
          <Input
            label="Alasan Perubahan (maks 500 karakter)"
            value={confirmReason}
            onChange={(e) => setConfirmReason(e.target.value)}
            maxLength={500}
            required
          />
          <label className="flex items-start gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={confirmCheckbox}
              onChange={(e) => setConfirmCheckbox(e.target.checked)}
              className="mt-0.5"
            />
            <span>Saya menyetujui dan mengonfirmasi penerapan perubahan pengaturan koneksi ini.</span>
          </label>
        </div>
      </Modal>
    </div>
  );
};
