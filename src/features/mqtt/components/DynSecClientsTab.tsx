import { useMemo } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import type { MqttClient } from '../../../types/mqtt';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

interface DynSecClientsTabProps {
  clients: MqttClient[];
  canManage: { canInteract: boolean };
  onToggleClient: (client: MqttClient) => void;
  onDeleteClient: (username: string) => void;
  onDetachRole: (username: string, rolename: string) => void;
  onOpenAttachRole: (client: MqttClient) => void;
  onOpenRotatePassword: (client: MqttClient) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Chip role
// dengan tombol detach inline + tombol "+ Role" dipindahkan ke
// ColumnDef.cell. Catatan: tabel lama tidak punya empty state (daftar
// kosong = header saja); DataTable menampilkan empty state standar —
// teks netral di bawah.
export const DynSecClientsTab: React.FC<DynSecClientsTabProps> = ({
  clients,
  canManage,
  onToggleClient,
  onDeleteClient,
  onDetachRole,
  onOpenAttachRole,
  onOpenRotatePassword,
}) => {
  const columns = useMemo<ColumnDef<MqttClient, unknown>[]>(
    () => [
      {
        id: 'username',
        header: 'Username / Client ID',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="text-xs font-tabular">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{c.username}</div>
              <div className="text-[11px] text-slate-500">{c.clientid || c.textname || '-'}</div>
            </div>
          );
        },
      },
      {
        id: 'roles',
        header: 'Roles (Attach / Detach)',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {c.roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[11px] font-mono"
                >
                  {r}
                  {canManage.canInteract && (
                    <button
                      type="button"
                      aria-label={`Detach role ${r}`}
                      onClick={() => onDetachRole(c.username, r)}
                      className="text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {canManage.canInteract && (
                <button
                  type="button"
                  onClick={() => onOpenAttachRole(c)}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
                >
                  + Role
                </button>
              )}
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? 'success' : 'danger'}>
            {row.original.enabled ? 'ENABLED' : 'DISABLED'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!canManage.canInteract}
                onClick={() => onToggleClient(c)}
              >
                {c.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!canManage.canInteract}
                onClick={() => onOpenRotatePassword(c)}
              >
                <KeyRound className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!canManage.canInteract}
                onClick={() => onDeleteClient(c.username)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [canManage, onToggleClient, onDeleteClient, onDetachRole, onOpenAttachRole, onOpenRotatePassword],
  );

  return (
    <DataTable
      data={clients}
      columns={columns}
      getRowId={(c) => c.username}
      emptyTitle="Belum ada klien MQTT"
      emptyDescription="Tidak ada klien dynamic security yang terdaftar."
    />
  );
};
