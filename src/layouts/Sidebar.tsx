import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV_GROUPS } from './components/sidebarNavGroups';
import { SidebarFooter } from './components/SidebarFooter';
import { SidebarNavGroup } from './components/SidebarNavGroup';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

/**
 * E32.6 (FAT-287): definisi grup navigasi dipecah ke
 * components/sidebarNavGroups.ts, render grup ke SidebarNavGroup, dan
 * footer ke SidebarFooter. Sidebar tinggal orkestrasi: state
 * collapse/buka-grup + header + tautan Overview + overlay mobile.
 * Perilaku/UI tidak berubah.
 */
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
              // FAT-262: saat minimize, ikon Overview harus center seperti
              // ikon grup (justify-center p-2); sebelumnya rata kiri (px-3).
              `flex items-center ${isCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'} text-xs font-medium rounded transition-colors ${
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

          {NAV_GROUPS.map((group, idx) => (
            <SidebarNavGroup
              key={group.title}
              group={group}
              index={idx}
              isCollapsed={isCollapsed}
              isOpen={openGroups[group.title] !== false}
              onToggleGroup={toggleGroup}
              onCloseMobile={onCloseMobile}
              checkCapability={checkCapability}
            />
          ))}
        </div>

        {!isCollapsed && (
          <SidebarFooter role={currentUser.role} operatorId={currentUser.operator_id} />
        )}
      </aside>
    </>
  );
};
