import React from 'react';
import { OPERATIONAL_EVENT_TYPES, OperationalEvent } from '../../../types/monitoring';
import { HistoryFilters } from '../../../types/historical';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { FilterBar } from '../../../components/industrial/FilterBar';

// E20 P20.4 (FAT-156): dropdown = 32 nilai eksplisit enum tertutup FR-034-26/27
// (API doc §I). Nilai tebakan lama (ALARM, STATE_CHANGE, COMMAND_EXECUTED,
// DISCONNECT, HEARTBEAT_TIMEOUT, MQTT_ADMIN_ACTION, IAM_POLICY_CHANGED)
// dihapus. Keluarga pola (COMMAND_<cmd>_DISPATCHED, MQTT_ADMIN_<op>,
// DEVICE_EVENT_<n>) tidak dienumerasi di dropdown — difilter lewat
// event_type bebas bila perlu. Filter `severity` dihapus (tidak didukung
// dokumen); filter mesin dihapus — `machine_id` hanya untuk /system/audit
// (D-12), bukan endpoint global ini.
const EVENT_TYPE_OPTIONS: Array<'ALL' | OperationalEvent['event_type']> = [
  'ALL',
  ...OPERATIONAL_EVENT_TYPES,
];

export interface DeviceOption {
  device_id: string;
  bound_machine_name?: string | null;
}

export interface OperationalEventsFiltersProps {
  filters: HistoryFilters;
  deviceOptions: DeviceOption[];
  ackFilter: 'ALL' | 'UNACK' | 'ACK';
  customDeviceInput: string;
  onCustomDeviceInputChange: (value: string) => void;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
  onAckChange: (value: 'ALL' | 'UNACK' | 'ACK') => void;
  onApplyCustomDevice: () => void;
}

export const OperationalEventsFilters: React.FC<OperationalEventsFiltersProps> = ({
  filters,
  deviceOptions,
  ackFilter,
  customDeviceInput,
  onCustomDeviceInputChange,
  onFilterChange,
  onAckChange,
  onApplyCustomDevice,
}) => {
  const deviceFilter = filters.deviceId || 'ALL';
  const eventTypeFilter = (filters.eventType as 'ALL' | OperationalEvent['event_type']) || 'ALL';

  return (
    <FilterBar className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Select
          id="opev-device-scope"
          label="Device Scope"
          value={deviceFilter}
          onChange={(e) =>
              onFilterChange({
                deviceId: e.target.value === 'ALL' ? undefined : e.target.value,
              })}
          options={[{ value: 'ALL', label: 'Global Feed (ALL Devices)' }, ...deviceOptions.map((d) => ({ value: d.device_id, label: d.device_id })), { value: 'STM32-OEE-90-DEL', label: 'STM32-OEE-90-DEL — [dihapus]' }]}
        />

        <Select
          id="opev-type-filter"
          label="Event Type"
          value={eventTypeFilter}
          onChange={(e) =>
              onFilterChange({
                eventType: e.target.value === 'ALL' ? undefined : e.target.value,
              })}
          options={EVENT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
        />

        <Select
          id="opev-ack-filter"
          label="Ack Status"
          value={ackFilter}
          onChange={(e) => onAckChange(e.target.value as 'ALL' | 'UNACK' | 'ACK')}
          options={[{ value: 'ALL', label: 'Semua' }, { value: 'UNACK', label: 'Belum Ack' }, { value: 'ACK', label: 'Sudah Ack' }]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <label htmlFor="opev-custom-device" className="text-[11px] font-medium text-slate-500">
          Cari Device ID Historis / Terhapus:
        </label>
        <input
          id="opev-custom-device"
          type="text"
          value={customDeviceInput}
          onChange={(e) => onCustomDeviceInputChange(e.target.value)}
          placeholder="mis. STM32-OEE-90-DEL"
          className="w-56 px-2.5 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        />
        <Button size="sm" variant="secondary" onClick={onApplyCustomDevice}>
          Terapkan
        </Button>
      </div>
    </FilterBar>
  );
};
