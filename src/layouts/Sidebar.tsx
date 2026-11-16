import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Cpu,
  Server,
  Activity,
  AlertOctagon,
  Bell,
  LineChart,
  PieChart,
  History,
  RefreshCw,
  Radio,
  KeyRound,
  Sliders,
  ShieldCheck,
  FileText,
  Info,
  ChevronDown,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CapabilityKey } from '../utils/capabilities';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  capability: CapabilityKey;
}

interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onCloseMobile }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Production: true,
    Assets: true,
    'Data & Analytics': true,
    'MQTT & Connectivity': true,
    System: true,
  });

  const { currentUser, checkCapability } = useAuth();

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const navGroups: NavGroup[] = [
    {
      title: 'Production',
      icon: ClipboardList,
      items: [
        { name: 'Work Orders', path: '/work-orders', icon: ClipboardList, capability: 'work_order.read' },
        { name: 'Downtime Events', path: '/downtime', icon: AlertOctagon, capability: 'downtime.read' },
        { name: 'Operational Events', path: '/audit', icon: Bell, capability: 'operational_event.read' },
        { name: 'Live Machine State', path: '/admin/live-state', icon: Activity, capability: 'telemetry.read' },
      ],
    },
    {
      title: 'Assets',
      icon: Cpu,
      items: [
        { name: 'Edge Devices', path: '/admin/devices', icon: Server, capability: 'device.read' },
        { name: 'Machines', path: '/admin/machines', icon: Cpu, capability: 'machine.read' },
        { name: 'Products', path: '/admin/products', icon: Package, capability: 'product.read' },
        { name: 'Operators', path: '/admin/operators', icon: Users, capability: 'operator.read' },
      ],
    },
    {
      title: 'Data & Analytics',
      icon: LineChart,
      items: [
        { name: 'Telemetry History', path: '/telemetry', icon: History, capability: 'telemetry.read' },
        { name: 'OEE & Shift Analytics', path: '/analytics', icon: LineChart, capability: 'oee.read' },
        { name: 'Quality & Rejects', path: '/admin/quality', icon: PieChart, capability: 'quality.read' },
        { name: 'Data Reconciliation', path: '/admin/reconciliation', icon: RefreshCw, capability: 'telemetry.read' },
      ],
    },
    {
      title: 'MQTT & Connectivity',
      icon: Radio,
      items: [
        { name: 'Broker Overview', path: '/admin/mqtt/overview', icon: Radio, capability: 'mqtt.overview.read' },
        { name: 'Dynamic Security', path: '/admin/mqtt/security', icon: KeyRound, capability: 'mqtt.dynsec.read' },
        { name: 'Broker Configuration', path: '/admin/mqtt/configuration', icon: Sliders, capability: 'mqtt.config.read' },
      ],
    },
    {
      title: 'System',
      icon: ShieldCheck,
      items: [
        { name: 'System Health', path: '/admin/system/health', icon: ShieldCheck, capability: 'dashboard.read' },
        { name: 'Hak Akses Pengguna', path: '/admin/access-control', icon: KeyRound, capability: 'access_control.manage' },
        { name: 'Audit Trail', path: '/admin/system-audit', icon: FileText, capability: 'audit.system.read' },
        { name: 'System Information', path: '/admin/system/info', icon: Info, capability: 'dashboard.read' },
      ],
    },
  ];

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 md:z-0 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 transition-all duration-200 select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'w-16' : 'w-64'}`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-sky-600 rounded flex items-center justify-center font-bold text-white text-sm">
                OE
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-white block leading-none">OEE ADMIN</span>
                <span className="text-[10px] text-slate-400 font-mono">IIoT Management</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:inline-flex p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            aria-label="Close navigation drawer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          <NavLink
            to="/admin"
            end
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded transition-colors ${
                isActive
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`
            }
            title="Overview"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Overview Dashboard</span>}
          </NavLink>

          {navGroups.map((group) => {
            const isOpen = openGroups[group.title] !== false;
            // Capability-first navigation gating (Build Guide §4.5 via /auth/me)
            const visibleItems = group.items.filter((item) => checkCapability(item.capability).canInteract);

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="pt-2">
                {!isCollapsed ? (
                  <div>
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider rounded transition-colors"
                    >
                      <span>{group.title}</span>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    {isOpen && (
                      <div className="space-y-0.5 mt-0.5 pl-1">
                        {visibleItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={onCloseMobile}
                              className={({ isActive }) =>
                                `flex items-center gap-2.5 px-3 py-1.5 text-xs rounded transition-colors ${
                                  isActive
                                    ? 'bg-sky-600 text-white font-semibold'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                                }`
                              }
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{item.name}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={onCloseMobile}
                          className={({ isActive }) =>
                            `flex items-center justify-center p-2 rounded transition-colors ${
                              isActive
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`
                          }
                          title={item.name}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isCollapsed && (
          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Active Role:</span>
              <span className="font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 font-bold">
                {currentUser.role}
              </span>
            </div>
            <div className="mt-1 truncate text-slate-500">ID: {currentUser.operator_id}</div>
          </div>
        )}
      </aside>
    </>
  );
};
