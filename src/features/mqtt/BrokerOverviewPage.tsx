import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileCode2, RefreshCw, ArrowRight, ShieldAlert, Lock } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { BrokerOverviewInfo } from '../../types/mqtt';
import { ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const BrokerOverviewPage: React.FC = () => {
  const { reportForbidden } = useAuth();
  const canReadOverview = useCapability('mqtt.overview.read');

  const [overview, setOverview] = useState<BrokerOverviewInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!canReadOverview.canInteract) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.getBrokerOverview();
      setOverview(data);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('mqtt.overview.read', undefined, err.message);
      }
      setErrorMsg(err?.message || 'Gagal memuat ringkasan layanan komunikasi mesin.');
    } finally {
      setIsLoading(false);
    }
  }, [canReadOverview.canInteract, reportForbidden]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (!canReadOverview.canInteract) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Akses Ringkasan Broker MQTT Terkunci</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {canReadOverview.reason || 'Halaman ringkasan koneksi broker hanya tersedia untuk peran Admin.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Ringkasan Status Broker Mesin
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ringkasan status keamanan akses perangkat dan sinkronisasi konfigurasi komunikasi mesin.
          </p>
        </div>

        <Button size="sm" variant="secondary" onClick={loadOverview} isLoading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {errorMsg && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 text-xs text-red-800 dark:text-red-200">
          {errorMsg}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dynamic Security Card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Dynamic Security Plugin</h2>
              </div>
              <Badge variant={overview.dynamicSecurity.status === 'CONNECTED' ? 'success' : 'danger'}>
                {overview.dynamicSecurity.enabled ? overview.dynamicSecurity.status : 'DISABLED'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center font-tabular">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-400 block">Clients</span>
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {overview.dynamicSecurity.clientsCount}
                </span>
              </div>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-400 block">Roles</span>
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {overview.dynamicSecurity.rolesCount}
                </span>
              </div>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-400 block">Groups</span>
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {overview.dynamicSecurity.groupsCount}
                </span>
              </div>
            </div>

            <Link
              to="/admin/mqtt/security"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              <span>Kelola Clients, Roles &amp; Groups</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Configuration Sync Card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Broker Configuration State</h2>
              </div>
              <Badge variant={overview.configuration.status === 'IN_SYNC' ? 'success' : 'warning'}>
                {overview.configuration.status}
              </Badge>
            </div>

            <div className="space-y-2 text-xs font-tabular">
              <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500">Active Version ID</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {overview.configuration.activeVersionId || '—'}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500">Last Applied At</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {overview.configuration.lastAppliedAt
                    ? new Date(overview.configuration.lastAppliedAt).toLocaleString()
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500">Mutation Lock</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  {overview.configuration.mutationLocked && <Lock className="w-3 h-3 text-amber-500" />}
                  {overview.configuration.mutationLocked ? 'LOCKED' : 'UNLOCKED'}
                </span>
              </div>
            </div>

            <Link
              to="/admin/mqtt/configuration"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              <span>Buka Broker Config Manager</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
