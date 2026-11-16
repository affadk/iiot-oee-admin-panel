import React from 'react';
import { IamRole } from '../../../types/iam';
import { ALL_ROLES } from '../hooks/useOperators';

export interface OperatorsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED';
  onStatusFilterChange: (value: 'ALL' | 'ACTIVE' | 'SUSPENDED') => void;
  iamRoles: IamRole[];
  shownCount: number;
  totalCount: number;
}

/** Toolbar search & filter (R9.5, dipindah dari OperatorsPage L439–484). Murni presentasional. */
export const OperatorsToolbar: React.FC<OperatorsToolbarProps> = ({
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  iamRoles,
  shownCount,
  totalCount,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Cari operator"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Cari ID, nama, atau line..."
          className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        />
        <select
          aria-label="Filter peran operator"
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="ALL">Semua Peran</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          {iamRoles
            .filter((r) => !r.is_system)
            .map((r) => (
              <option key={r.id} value={r.name}>
                {r.name} (Custom)
              </option>
            ))}
        </select>
        <select
          aria-label="Filter status operator"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED')}
          className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
      </div>
      <span className="text-[11px] text-slate-500">
        Menampilkan {shownCount} dari {totalCount} operator
      </span>
    </div>
  );
};
