import React, { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { Machine, EdgeDevice } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { FeedbackState } from './useMachines';

export interface UseMachineBindingOptions {
  loadData: (cursor?: string | null, append?: boolean) => Promise<void>;
  setFeedback: (feedback: FeedbackState | null) => void;
  setConflictState: (state: ConflictDialogState | null) => void;
  unboundDevices: EdgeDevice[];
}

export function useMachineBinding({
  loadData,
  setFeedback,
  setConflictState,
  unboundDevices,
}: UseMachineBindingOptions) {
  const { reportForbidden } = useAuth();

  const [bindTarget, setBindTarget] = useState<Machine | null>(null);
  const [selectedBindDeviceId, setSelectedBindDeviceId] = useState('');
  const [bindSubmitError, setBindSubmitError] = useState<string | null>(null);
  const [bindConfirmTarget, setBindConfirmTarget] = useState<{ machine: Machine; deviceId: string } | null>(null);
  const [isBinding, setIsBinding] = useState(false);

  const [isUnbinding, setIsUnbinding] = useState(false);

  const handleOpenBindModal = (machine: Machine) => {
    setBindTarget(machine);
    setSelectedBindDeviceId(unboundDevices[0]?.device_id || '');
    setBindSubmitError(null);
  };

  const handleRequestBindConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindTarget || !selectedBindDeviceId) return;
    setBindConfirmTarget({ machine: bindTarget, deviceId: selectedBindDeviceId });
  };

  const handleCloseBindModal = () => {
    setBindTarget(null);
    setBindConfirmTarget(null);
  };

  const handleConfirmBindDevice = async () => {
    if (!bindConfirmTarget) return;
    const { machine, deviceId } = bindConfirmTarget;
    setIsBinding(true);
    setBindSubmitError(null);
    setFeedback(null);
    try {
      await apiClient.bindDevice(machine.machine_id, { device_id: deviceId });
      await loadData(null, false);
      setFeedback({
        type: 'success',
        msg: `Edge device ${deviceId} berhasil diikatkan ke ${machine.machine_id}.`,
      });
      setBindConfirmTarget(null);
      setBindTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', machine.machine_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
      }
      setBindConfirmTarget(null);
      setBindSubmitError(err?.message || 'Gagal melakukan binding device.');
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal melakukan binding device.',
        conflictMachineForUnbind:
          err instanceof ApiError && err.code === 'MACHINE_ALREADY_BOUND' ? machine : undefined,
      });
    } finally {
      setIsBinding(false);
    }
  };

  const handleConfirmUnbindDevice = async (unbindTarget: Machine) => {
    setIsUnbinding(true);
    setFeedback(null);
    try {
      const targetId = unbindTarget.machine_id;
      await apiClient.unbindDevice(targetId);
      await loadData(null, false);
      setFeedback({
        type: 'success',
        msg: `Ikatan edge device dari mesin ${targetId} berhasil dilepas.`,
      });
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('machine.manage', unbindTarget.machine_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadData(null, false);
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Melepas Device dari ${unbindTarget.machine_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal melepas ikatan device.',
        activeWoId: err?.activeWoId,
      });
    } finally {
      setIsUnbinding(false);
    }
  };

  return {
    bindTarget,
    setBindTarget,
    selectedBindDeviceId,
    setSelectedBindDeviceId,
    bindSubmitError,
    bindConfirmTarget,
    setBindConfirmTarget,
    isBinding,
    isUnbinding,
    handleOpenBindModal,
    handleRequestBindConfirmation,
    handleCloseBindModal,
    handleConfirmBindDevice,
    handleConfirmUnbindDevice,
  };
}
