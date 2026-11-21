import React from 'react';

interface SidebarFooterProps {
  role: string;
  operatorId: string;
}

/** Footer Sidebar: peran aktif + ID operator. Dipindah dari Sidebar.tsx (E32.6, FAT-287). */
export function SidebarFooter({ role, operatorId }: SidebarFooterProps) {
  return (
    <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-300">Active Role:</span>
        <span className="font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 font-bold">
          {role}
        </span>
      </div>
      <div className="mt-1 truncate text-slate-500">ID: {operatorId}</div>
    </div>
  );
}
