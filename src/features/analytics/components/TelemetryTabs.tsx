import React from 'react';
import { Select } from '../../../components/ui/Select';
import { BarChart3, Clock, Database, Layers } from 'lucide-react';
import { HistoryFilters } from '../../../types/historical';
import { TelemetryRollupGroupBy } from '../../../types/analytics';
import { EdgeDevice, Machine } from '../../../types/assets';
import { TelemetryTab } from '../hooks/useTelemetryQueries';

export interface TelemetryTabsProps {
  activeTab: TelemetryTab;
  groupBy: TelemetryRollupGroupBy;
  machines: Machine[];
  devices: EdgeDevice[];
  machineIdFilter: string | undefined;
  rollupDeviceFilter: string;
  onTabChange: (tab: TelemetryTab) => void;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
  onRollupDeviceFilterChange: (value: string) => void;
}

export const TelemetryTabs: React.FC<TelemetryTabsProps> = ({
  activeTab,
  groupBy,
  machines,
  devices,
  machineIdFilter,
  rollupDeviceFilter,
  onTabChange,
  onFilterChange,
  onRollupDeviceFilterChange,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
    <div role="tablist" aria-label="Mode Tampilan Telemetri" className="flex flex-wrap gap-1.5">
      {[
        { id: 'raw', label: 'Data Mentah', icon: Database },
        { id: 'hourly', label: 'Delta Per Jam (Provisional)', icon: Clock },
        { id: 'aggregate', label: 'Downsampling Agregat', icon: Layers },
        { id: 'rollup', label: 'Rollup Multi-Mesin / Periode', icon: BarChart3 },
      ].map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onTabChange(tab.id as TelemetryTab)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              active
                ? 'bg-sky-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>

    {activeTab === 'rollup' && (
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Rollup Grouping"
          wrapperClassName="shrink-0"
          value={groupBy}
          onChange={(e) =>
            onFilterChange({ groupBy: e.target.value as TelemetryRollupGroupBy })}
          options={[{ value: 'machine', label: 'Group by: Mesin' }, { value: 'line', label: 'Group by: Lini' }, { value: 'day', label: 'Group by: Harian' }, { value: 'month', label: 'Group by: Bulanan' }]}
        />
        <Select
          aria-label="Filter Mesin Rollup"
          wrapperClassName="shrink-0"
          value={machineIdFilter ?? 'ALL'}
          onChange={(e) =>
            onFilterChange({
              machineId: e.target.value === 'ALL' ? undefined : e.target.value,
            })}
          options={[{ value: 'ALL', label: 'Semua Mesin' }, ...machines.map((m) => ({ value: m.machine_id, label: m.machine_id }))]}
        />
        <Select
          aria-label="Filter Device Rollup"
          wrapperClassName="shrink-0"
          value={rollupDeviceFilter}
          onChange={(e) => onRollupDeviceFilterChange(e.target.value)}
          options={[{ value: 'ALL', label: 'Semua Perangkat' }, ...devices.map((d) => ({ value: d.device_id, label: d.device_id }))]}
        />
      </div>
    )}
  </div>
);
