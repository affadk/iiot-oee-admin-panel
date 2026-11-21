import React from 'react';
import { NavLink } from 'react-router-dom';

interface TopbarNavProps {
  canReadBrokerConfig: boolean;
}

function topbarLinkClassName({ isActive }: { isActive: boolean }): string {
  return `hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
    isActive ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
  }`;
}

/** Navigasi cepat di tengah Topbar. Dipindah dari Topbar.tsx (E32.6, FAT-287). */
export function TopbarNav({ canReadBrokerConfig }: TopbarNavProps) {
  return (
    <nav className="hidden md:flex items-center gap-4 xl:gap-5 text-xs font-medium text-slate-600 dark:text-slate-300">
      <NavLink to="/admin/live-state" className={topbarLinkClassName}>
        Live State
      </NavLink>
      <NavLink to="/admin/work-orders" className={topbarLinkClassName}>
        Work Orders
      </NavLink>
      <NavLink to="/admin/downtime" className={topbarLinkClassName}>
        Downtime
      </NavLink>
      <NavLink to="/admin/telemetry" className={topbarLinkClassName}>
        Telemetry
      </NavLink>
      {canReadBrokerConfig && (
        <NavLink to="/admin/mqtt/configuration" className={topbarLinkClassName}>
          Broker Config
        </NavLink>
      )}
    </nav>
  );
}
