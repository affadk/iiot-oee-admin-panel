import type { FormEvent } from 'react';
import { Save } from 'lucide-react';
import type { BrokerConfigSchema } from '../../../types/mqtt';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface BrokerConfigEditorTabProps {
  draftConfig: BrokerConfigSchema;
  onDraftChange: (next: BrokerConfigSchema) => void;
  stageSummary: string;
  onStageSummaryChange: (value: string) => void;
  onStage: (e: FormEvent) => void;
  isWorking: boolean;
  canManage: { canInteract: boolean; reason?: string };
}

export const BrokerConfigEditorTab: React.FC<BrokerConfigEditorTabProps> = ({
  draftConfig,
  onDraftChange,
  stageSummary,
  onStageSummaryChange,
  onStage,
  isWorking,
  canManage,
}) => {
  const updateGeneral = (patch: Partial<BrokerConfigSchema['general']>) => {
    onDraftChange({ ...draftConfig, general: { ...draftConfig.general, ...patch } });
  };

  const updateLimits = (patch: Partial<BrokerConfigSchema['limits']>) => {
    onDraftChange({ ...draftConfig, limits: { ...draftConfig.limits, ...patch } });
  };

  // E23 Batch 1 (FAT-181, N-12): bridge hasil GET tidak membawa password
  // (hanya `has_password`) dan `remote_address` boleh null — keduanya harus
  // diisi di sini sebelum staging (POST wajib `remote_address`; password
  // hanya dikirim bila diisi, transient, tidak disimpan).
  const updateBridge = (index: number, patch: Partial<BrokerConfigSchema['bridges'][number]>) => {
    const bridges = draftConfig.bridges.map((b, i) => (i === index ? { ...b, ...patch } : b));
    onDraftChange({ ...draftConfig, bridges });
  };

  return (
    <form onSubmit={onStage} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">General &amp; Persistence</h2>
          <Input
            label="Autosave Interval (detik, min 60)"
            type="number"
            // E20 P20.5 (FAT-157): `null` = tanpa sumber — tampil kosong,
            // bukan 300 (default fabrikasi dihapus).
            value={draftConfig.general.autosave_interval_seconds ?? ''}
            disabled={!canManage.canInteract}
            onChange={(e) => updateGeneral({ autosave_interval_seconds: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              disabled={!canManage.canInteract}
              checked={draftConfig.general.allow_anonymous}
              onChange={(e) => updateGeneral({ allow_anonymous: e.target.checked })}
            />
            <span>Izinkan Koneksi Tanpa Kata Sandi (Wajib nonaktif di produksi)</span>
          </label>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connection &amp; Queue Limits</h2>
          <Input
            label="Max Connections (10–50.000)"
            type="number"
            // E20 P20.5 (FAT-157): `null` = tanpa sumber — tampil kosong,
            // bukan 1000 (default fabrikasi dihapus).
            value={draftConfig.limits.max_connections ?? ''}
            disabled={!canManage.canInteract}
            onChange={(e) => updateLimits({ max_connections: Number(e.target.value) })}
          />
          <Input
            label="Max Queued Messages"
            type="number"
            // E23 Batch 3 (FAT-198, N-29): `null` = tanpa sumber — tampil
            // kosong, bukan 1000 (default fabrikasi dihapus, seperti
            // max_connections di atas).
            value={draftConfig.limits.max_queued_messages ?? ''}
            disabled={!canManage.canInteract}
            onChange={(e) => updateLimits({ max_queued_messages: Number(e.target.value) })}
          />
        </div>
      </div>

      {draftConfig.bridges.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bridges (Sinkronisasi Remote)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Server tidak mengembalikan kata sandi bridge — isi ulang kata sandi saat staging bila bridge memakainya.
            Remote address wajib diisi (staging ditolak bila kosong).
          </p>
          {draftConfig.bridges.map((bridge, i) => (
            <div
              key={bridge.id}
              className="p-3 rounded border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {bridge.name || bridge.id}
                {bridge.has_password ? ' · memakai kata sandi' : ' · tanpa kata sandi'}
              </div>
              <Input
                label="Remote Address (wajib)"
                value={bridge.remote_address ?? ''}
                disabled={!canManage.canInteract}
                onChange={(e) => updateBridge(i, { remote_address: e.target.value })}
                required
              />
              <Input
                label="Kata Sandi Bridge (isi ulang saat staging)"
                type="password"
                value={bridge.password ?? ''}
                disabled={!canManage.canInteract}
                onChange={(e) => updateBridge(i, { password: e.target.value })}
                placeholder={
                  bridge.has_password
                    ? 'Bridge ini memakai kata sandi — isi ulang di sini'
                    : 'Kosongkan bila bridge tanpa kata sandi'
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex-1">
          <Input
            label="Ringkasan Perubahan"
            value={stageSummary}
            disabled={!canManage.canInteract}
            onChange={(e) => onStageSummaryChange(e.target.value)}
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
  );
};
