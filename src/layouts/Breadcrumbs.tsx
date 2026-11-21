import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const routeNames: Record<string, string> = {
    admin: 'Overview',
    production: 'Production Management',
    'work-orders': 'Work Orders',
    products: 'Products',
    operators: 'Operators',
    assets: 'Asset Management',
    machines: 'Machines',
    devices: 'Edge Devices',
    monitoring: 'Monitoring & Operations',
    'live-state': 'Machine Live State',
    downtime: 'Downtime Events',
    events: 'Alarm & Event',
    alarms: 'Alarm & Event',
    analytics: 'OEE & Quality Analytics',
    oee: 'OEE Analytics',
    quality: 'Quality & Reject Analysis',
    telemetry: 'Telemetry History',
    reconciliation: 'Data Reconciliation',
    mqtt: 'MQTT & Connectivity',
    overview: 'Broker Overview',
    security: 'Dynamic Security',
    configuration: 'Pengaturan Koneksi Mesin',
    system: 'System',
    health: 'System Health',
    audit: 'Alarm & Event',
    'system-audit': 'System Audit Trail',
    'iam-audit': 'Audit IAM',
    info: 'System Information',
    'access-control': 'Hak Akses Pengguna',
    'shift-analytics': 'Shift Analytics',
  };

  if (pathnames.length <= 1 && pathnames[0] === 'admin') {
    return null;
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4" aria-label="Breadcrumb">
      <Link to="/admin" className="hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1">
        <Home className="w-3.5 h-3.5" />
        <span>Admin</span>
      </Link>
      {pathnames.map((value, index) => {
        if (value === 'admin') return null;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeNames[value] || value;

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            {isLast ? (
              <span className="font-semibold text-slate-800 dark:text-slate-200" aria-current="page">
                {displayName}
              </span>
            ) : (
              <Link to={to} className="hover:text-slate-800 dark:hover:text-slate-200">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
