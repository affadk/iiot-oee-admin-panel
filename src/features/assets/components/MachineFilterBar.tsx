import React from 'react';
import { BindingFilter } from '../hooks/useMachines';

export interface MachineFilterBarProps {
  bindingFilter: BindingFilter;
  onBindingFilterChange: (filter: BindingFilter) => void;
  totalMachines: number;
  boundMachinesCount: number;
  unboundMachinesCount: number;
  unboundDevicesCount: number;
}

export const MachineFilterBar: React.FC<MachineFilterBarProps> = ({
  bindingFilter,
  onBindingFilterChange,
  totalMachines,
  boundMachinesCount,
  unboundMachinesCount,
  unboundDevicesCount,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status binding mesin">
        <button
          type="button"
          onClick={() => onBindingFilterChange('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
            bindingFilter === 'ALL'
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          Semua Mesin ({totalMachines})
        </button>
        <button
          type="button"
          onClick={() => onBindingFilterChange('BOUND')}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
            bindingFilter === 'BOUND'
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          Terikat Device ({boundMachinesCount})
        </button>
        <button
          type="button"
          onClick={() => onBindingFilterChange('UNBOUND')}
          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
            bindingFilter === 'UNBOUND'
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          Unbound ({unboundMachinesCount})
        </button>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 font-tabular">
        Device tersedia untuk binding:{' '}
        <strong className="text-slate-800 dark:text-slate-200">{unboundDevicesCount}</strong>
      </div>
    </div>
  );
};
