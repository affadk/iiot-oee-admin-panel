import React from 'react';
import { Monitor, Wifi, WifiOff, Edit3, Trash2, Ban } from 'lucide-react';
import { Station } from '../../../types/assets';
import { CapabilityKey, CapabilityState } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface StationTableProps {
  stations: Station[];
  isLoading: boolean;
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string,
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
  onEdit: (station: Station) => void;
  onRevoke: (station: Station) => void;
  onDelete: (station: Station) => void;
}

function enrollmentLabel(state: Station['enrollmentState']): string {
  if (state === 'PROVISIONED') return 'Terdaftar';
  if (state === 'REVOKED') return 'Dicabut';
  return 'Aktif';
}

export const StationTable: React.FC<StationTableProps> = ({
  stations,
  isLoading,
  checkCapability,
  onEdit,
  onRevoke,
  onDelete,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Station / Device ID</th>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Terdaftar</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Memuat stasiun...
                </td>
              </tr>
            ) : stations.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Belum ada device terdaftar — kiosk tidak bisa login.
                </td>
              </tr>
            ) : (
              stations.map((st) => {
                const rowManageCap = checkCapability('device.manage', st.device_id);
                const isRevoked = st.enrollmentState === 'REVOKED';
                return (
                  <tr key={st.device_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 font-tabular">
                        <Monitor className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>{st.device_id}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 pl-6">
                        {st.model ? `${st.model} · ` : ''}FW: {st.firmware_version ?? '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                      {st.ip_address ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            isRevoked ? 'danger' : st.enrollmentState === 'PROVISIONED' ? 'warning' : 'success'
                          }
                        >
                          {enrollmentLabel(st.enrollmentState)}
                        </Badge>
                        <Badge variant={st.online ? 'success' : 'neutral'}>
                          {st.online ? (
                            <span className="inline-flex items-center gap-1">
                              <Wifi className="w-3 h-3" /> ONLINE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <WifiOff className="w-3 h-3" /> OFFLINE
                            </span>
                          )}
                        </Badge>
                      </div>
                      <div className="text-[11px] font-tabular text-slate-400 mt-1">
                        {st.last_seen ? `Terakhir terlihat ${new Date(st.last_seen).toLocaleString()}` : 'Belum ada data'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                      {new Date(st.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!rowManageCap.canInteract}
                          aria-label={`Edit stasiun ${st.device_id}`}
                          title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah IP / Firmware'}
                          onClick={() => onEdit(st)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!rowManageCap.canInteract || isRevoked}
                          aria-label={`Nonaktifkan stasiun ${st.device_id}`}
                          title={
                            !rowManageCap.canInteract
                              ? rowManageCap.reason
                              : isRevoked
                                ? 'Stasiun sudah dicabut'
                                : 'Nonaktifkan stasiun (revoke)'
                          }
                          onClick={() => onRevoke(st)}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Nonaktifkan</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!rowManageCap.canInteract}
                          aria-label={`Hapus stasiun ${st.device_id}`}
                          title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus stasiun'}
                          onClick={() => onDelete(st)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
