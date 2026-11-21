import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NavGroup } from './sidebarNavGroups';
import { CapabilityKey } from '../../utils/capabilities';

interface SidebarNavGroupProps {
  group: NavGroup;
  /** Indeks grup (untuk garis pemisah antar grup saat minimize). */
  index: number;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggleGroup: (group: string) => void;
  onCloseMobile?: () => void;
  /** Mengembalikan true bila capability boleh berinteraksi. */
  checkCapability: (key: CapabilityKey) => { canInteract: boolean };
}

/**
 * Satu grup navigasi Sidebar (mode expand + minimize).
 * Dipindah dari Sidebar.tsx (E32.6, FAT-287).
 */
export function SidebarNavGroup({
  group,
  index,
  isCollapsed,
  isOpen,
  onToggleGroup,
  onCloseMobile,
  checkCapability,
}: SidebarNavGroupProps) {
  // Capability-first navigation gating (Build Guide §4.5 via /auth/me)
  const visibleItems = group.items.filter((item) => !item.capability || checkCapability(item.capability).canInteract);

  if (visibleItems.length === 0) return null;

  return (
    <div className="pt-2">
      {!isCollapsed ? (
        <div>
          <button
            onClick={() => onToggleGroup(group.title)}
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
          {/* FAT-262: saat minimize, judul grup hilang — tanpa
              pemisah, ikon-ikon antar grup menyatu. Pertahankan
              break line seperti saat expand: garis pemisah antar
              grup (kecuali sebelum grup pertama, sama seperti
              mode expand yang juga tanpa garis di sana). */}
          {index > 0 && (
            <div className="mx-2 my-2 border-t border-slate-800" aria-hidden="true" />
          )}
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
}
