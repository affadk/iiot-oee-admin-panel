import React from 'react';
import { HistoryFilters } from '../../../types/historical';
import { Button } from '../../../components/ui/Button';
import { AggBucket } from '../hooks/useTelemetryQueries';

export interface TelemetryFilterBarProps {
  deviceOptions: { device_id: string; bound_machine_name?: string | null }[];
  selectedDevice: string;
  customDeviceInput: string;
  isBuffered: boolean | undefined;
  aggBucket: AggBucket;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
  onCustomDeviceInputChange: (value: string) => void;
  isValid: boolean;
  validationErrors: Record<string, string>;
  onResetFilters: () => void;
}

export const TelemetryFilterBar: React.FC<TelemetryFilterBarProps> = ({
  deviceOptions,
  selectedDevice,
  customDeviceInput,
  isBuffered,
  aggBucket,
  onFilterChange,
  onCustomDeviceInputChange,
  isValid,
  validationErrors,
  onResetFilters,
}) => (
  <>
    {!isValid && (
      <div
        role="alert"
        className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
      >
        <span>Filter tidak valid: {Object.values(validationErrors).join(' · ')}</span>
        <Button size="sm" variant="secondary" onClick={onResetFilters}>
          Reset Filter
        </Button>
      </div>
    )}

    {/* Selectors */}
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <label htmlFor="tel-device-select" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Edge Device (Aktif / Historis)
        </label>
        <select
          id="tel-device-select"
          value={selectedDevice}
          onChange={(e) => onFilterChange({ deviceId: e.target.value })}
          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          {deviceOptions.map((d) => (
            <option key={d.device_id} value={d.device_id}>
              {d.device_id} {d.bound_machine_name ? `— ${d.bound_machine_name}` : ''}
            </option>
          ))}
          <option value="STM32-OEE-90-DEL">STM32-OEE-90-DEL — [dihapus] (Histori)</option>
        </select>
      </div>

      <div>
        <label htmlFor="tel-custom-device" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Query ID Perangkat Kustom / Terhapus
        </label>
        <div className="flex gap-1.5">
          <input
            id="tel-custom-device"
            type="text"
            value={customDeviceInput}
            onChange={(e) => onCustomDeviceInputChange(e.target.value)}
            placeholder="mis. STM32-OEE-90-DEL"
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (customDeviceInput.trim()) {
                onFilterChange({ deviceId: customDeviceInput.trim() });
              }
            }}
          >
            Cari
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor="tel-buffered-select" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Sumber Data Rekaman
        </label>
        <select
          id="tel-buffered-select"
          value={isBuffered === undefined ? 'ALL' : isBuffered ? 'true' : 'false'}
          onChange={(e) =>
            onFilterChange({
              isBuffered:
                e.target.value === 'ALL' ? undefined : e.target.value === 'true',
            })
          }
          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="ALL">Semua (Langsung &amp; Buffer SD)</option>
          <option value="false">Hanya Pengiriman Langsung</option>
          <option value="true">Hanya Data Susulan (Buffered)</option>
        </select>
      </div>

      <div>
        <label htmlFor="tel-bucket-select" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Interval Downsampling
        </label>
        <select
          id="tel-bucket-select"
          value={aggBucket}
          onChange={(e) => onFilterChange({ bucket: e.target.value as AggBucket })}
          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="1m">1 Menit (1m)</option>
          <option value="5m">5 Menit (5m)</option>
          <option value="15m">15 Menit (15m)</option>
          <option value="1h">1 Jam (1h)</option>
          <option value="1d">1 Hari (1d)</option>
        </select>
      </div>
    </div>
  </>
);
