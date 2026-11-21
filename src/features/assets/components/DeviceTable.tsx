import React from 'react';
import { EdgeDevice } from '../../../types/assets';
import { CapabilityKey, CapabilityState } from '../../../utils/capabilities';
import { DataTable } from '../../../components/industrial/DataTable';
import { useDeviceColumns } from './DeviceColumns';

export interface DeviceTableProps {
  devices: EdgeDevice[];
  isLoading: boolean;
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string,
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
  onDetail: (deviceId: string) => void;
  onHealth: (device: EdgeDevice) => void;
  onEdit: (device: EdgeDevice) => void;
  onDelete: (device: EdgeDevice) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1).
// E32.7 (FAT-288): definisi kolom dipindah ke DeviceColumns.tsx
// (useDeviceColumns) — komponen ini hanya shell DataTable.
export const DeviceTable: React.FC<DeviceTableProps> = ({
  devices,
  isLoading,
  checkCapability,
  onDetail,
  onHealth,
  onEdit,
  onDelete,
}) => {
  const columns = useDeviceColumns({ checkCapability, onDetail, onHealth, onEdit, onDelete });

  return (
    <DataTable
      data={devices}
      columns={columns}
      getRowId={(dev) => dev.device_id}
      isLoading={isLoading}
      emptyTitle="Tidak ada perangkat edge pada filter ini."
    />
  );
};
