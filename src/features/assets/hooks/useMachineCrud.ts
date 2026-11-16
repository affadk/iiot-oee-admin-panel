import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { Machine } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { FeedbackState } from './useMachines';

export const mapApiIssuesToErrors = (err: unknown): Record<string, string> => {
  if (err instanceof ApiError && Array.isArray(err.issues)) {
    const mapped: Record<string, string> = {};
    for (const issue of err.issues) {
      if (issue.field) mapped[issue.field] = issue.message;
    }
    return mapped;
  }
  return {};
};

export interface CreateMachineInput {
  machineId: string;
  name: string;
  slaveId: number;
  bindDeviceId: string;
}

export interface UpdateMachineInput {
  name: string;
  slaveId: number;
}

export interface UseMachineCrudOptions {
  loadData: (cursor?: string | null, append?: boolean) => Promise<void>;
  setFeedback: (feedback: FeedbackState | null) => void;
  setConflictState: (state: ConflictDialogState | null) => void;
  onMachineDeleted: (machineId: string) => void;
}

export function useMachineCrud({
  loadData,
  setFeedback,
  setConflictState,
  onMachineDeleted,
}: UseMachineCrudOptions) {
  const { reportForbidden } = useAuth();

  const [isDeleting, setIsDeleting] = useState(false);

  const createMachine = async (input: CreateMachineInput): Promise<void> => {
    try {
      const created = await apiClient.createMachine({
        machine_id: input.machineId.trim(),
        name: input.name.trim(),
        modbus_slave_id: Number(input.slaveId),
        bound_device_id: input.bindDeviceId || null,
      });
      await loadData(null, false);
      setFeedback({ type: 'success', msg: `Mesin ${created.machine_id} (${created.name}) berhasil dibuat.` });
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', input.machineId, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal membuat mesin baru.' });
      throw err;
    }
  };

  const updateMachine = async (machineId: string, input: UpdateMachineInput): Promise<void> => {
    try {
      await apiClient.updateMachine(machineId, {
        name: input.name.trim(),
        modbus_slave_id: Number(input.slaveId),
      });
      await loadData(null, false);
      setFeedback({ type: 'success', msg: `Mesin ${machineId} berhasil diperbarui.` });
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', machineId, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memperbarui mesin.' });
      throw err;
    }
  };

  const deleteMachine = async (target: Machine): Promise<void> => {
    const targetId = target.machine_id;
    setIsDeleting(true);
    try {
      await apiClient.deleteMachine(targetId);
      onMachineDeleted(targetId);
      await loadData(null, false);
      setFeedback({
        type: 'success',
        msg: `Mesin ${targetId} dihapus. Riwayat Work Order, telemetri, downtime, & event tetap tersimpan untuk arsip.`,
      });
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', target.machine_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Mesin ${target.machine_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal menghapus mesin.',
        activeWoId: err?.activeWoId,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return { createMachine, updateMachine, deleteMachine, isDeleting };
}
