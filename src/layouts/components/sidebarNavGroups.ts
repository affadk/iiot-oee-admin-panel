import React from 'react';
import {
  Activity,
  AlertOctagon,
  Bell,
  CalendarClock,
  ClipboardList,
  Clock,
  Cpu,
  Factory,
  FileText,
  History,
  Info,
  KeyRound,
  LineChart,
  Monitor,
  Package,
  PieChart,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Sliders,
  Users,
} from 'lucide-react';
import { CapabilityKey } from '../../utils/capabilities';

export interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Kunci capability pengatur visibilitas. Opsional: item tanpa capability
   * selalu tampil (mis. System Health / System Information — kunci
   * `dashboard.read` karangan DIHAPUS, E20 P20.3).
   */
  capability?: CapabilityKey;
}

export interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

/**
 * Definisi grup navigasi Sidebar.
 * Dipindah dari Sidebar.tsx (E32.6, FAT-287) — data murni, tanpa JSX.
 */
export const NAV_GROUPS: NavGroup[] = [
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
      { name: 'Stations', path: '/admin/stations', icon: Monitor, capability: 'device.read' },
      { name: 'Machines', path: '/admin/machines', icon: Cpu, capability: 'machine.read' },
      { name: 'Products', path: '/admin/products', icon: Package, capability: 'product.read' },
      { name: 'Operators', path: '/admin/operators', icon: Users, capability: 'operator.read' },
      { name: 'Production Lines', path: '/admin/lines', icon: Factory, capability: 'production_line.read' },
      { name: 'Shifts', path: '/admin/shifts', icon: Clock, capability: 'shift.read' },
      { name: 'Shift Schedules', path: '/admin/shift-schedules', icon: CalendarClock, capability: 'shift_schedule.read' },
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
      { name: 'System Health', path: '/admin/system/health', icon: ShieldCheck },
      { name: 'Hak Akses Pengguna', path: '/admin/access-control', icon: KeyRound, capability: 'access_control.read' },
      { name: 'Audit Trail', path: '/admin/system-audit', icon: FileText, capability: 'access_control.read' },
      { name: 'System Information', path: '/admin/system/info', icon: Info },
    ],
  },
];
