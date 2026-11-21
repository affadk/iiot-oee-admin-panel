import { useCallback, useEffect, useState } from 'react';
import { httpStations } from '../../../services/api/http/stations';
import { Station } from '../../../types/assets';
import { useAuth } from '../../../context/AuthContext';
import { FeedbackState } from './useDevices';
import { useStationMutations } from './useStationMutations';
import { useStationConfirmations } from './useStationConfirmations';

// Tipe input mutasi tinggal di useStationMutations.ts (E32.7, FAT-288);
// di-re-export dari sini supaya impor modal lama tetap jalan.
export type {
  RegisterStationInput,
  UpdateStationInput,
} from './useStationMutations';

// E32.7 (FAT-288): mutasi tulis dipindah ke useStationMutations.ts,
// alur revoke + hapus ke useStationConfirmations.ts — hook ini tinggal
// orkestrasi: muat daftar + komposisi. Bentuk return tidak berubah
// (dipakai StationsPage).
export function useStations() {
  const { reportForbidden } = useAuth();

  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const loadStations = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await httpStations.getStations();
      setStations(list);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar stasiun.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  const { registerStation, updateStation } = useStationMutations({
    loadStations,
    reportForbidden,
    setFeedback,
  });

  const {
    revokeTarget,
    setRevokeTarget,
    isRevoking,
    handleRevoke,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  } = useStationConfirmations({ loadStations, reportForbidden, setFeedback });

  return {
    stations,
    isLoading,
    feedback,
    setFeedback,
    loadStations,
    registerStation,
    updateStation,
    revokeTarget,
    setRevokeTarget,
    isRevoking,
    handleRevoke,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  };
}
