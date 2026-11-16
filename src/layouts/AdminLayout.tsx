import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NetworkModeBanner } from '../components/industrial/NetworkModeBanner';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Network perimeter access mode banner */}
      <NetworkModeBanner />

      {/* Main shell: Sidebar + Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Topbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

          {/* Scrollable page body */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-100/60 dark:bg-slate-950">
            <div className="max-w-7xl mx-auto space-y-6">
              <Breadcrumbs />
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
