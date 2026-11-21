import React from 'react';
import { HistoryFilters } from '../../../types/historical';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { FilterBar } from '../../../components/industrial/FilterBar';
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
    <FilterBar layout="grid" columns={4}>
      <Select
        id="tel-device-select"
        label="Edge Device (Aktif / Historis)"
        value={selectedDevice}
        onChange={(e) => onFilterChange({ deviceId: e.target.value })}
        options={[...deviceOptions.map((d) => ({ value: d.device_id, label: `${d.device_id} ${d.bound_machine_name ? `— ${d.bound_machine_name}` : ''}` })), { value: 'STM32-OEE-90-DEL', label: 'STM32-OEE-90-DEL — [dihapus] (Histori)' }]}
      />

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

      <Select
        id="tel-buffered-select"
        label="Sumber Data Rekaman"
        value={isBuffered === undefined ? 'ALL' : isBuffered ? 'true' : 'false'}
        onChange={(e) =>
            onFilterChange({
              isBuffered:
                e.target.value === 'ALL' ? undefined : e.target.value === 'true',
            })}
        options={[{ value: 'ALL', label: 'Semua (Langsung & Buffer SD)' }, { value: 'false', label: 'Hanya Pengiriman Langsung' }, { value: 'true', label: 'Hanya Data Susulan (Buffered)' }]}
      />

      <Select
        id="tel-bucket-select"
        label="Interval Downsampling"
        value={aggBucket}
        onChange={(e) => onFilterChange({ bucket: e.target.value as AggBucket })}
        options={[{ value: '1m', label: '1 Menit (1m)' }, { value: '5m', label: '5 Menit (5m)' }, { value: '15m', label: '15 Menit (15m)' }, { value: '1h', label: '1 Jam (1h)' }, { value: '1d', label: '1 Hari (1d)' }]}
      />
    </FilterBar>
  </>
);
