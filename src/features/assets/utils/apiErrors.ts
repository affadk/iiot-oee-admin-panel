/**
 * Pemetaan ApiError → error per-field untuk form (E31.14, FAT-277).
 *
 * Satu-satunya sumber kebenaran untuk helper ini (aturan R4/R5 +
 * prinsip "satu sumber kebenaran" di docs/UI_STRUCTURE_RULES.md):
 * sebelumnya ada dua salinan identik di hooks/useDevices.ts dan
 * hooks/useMachineCrud.ts. Dipakai semua modal form domain assets
 * (DeviceEditModal, DeviceRegisterModal, StationRegisterModal,
 * StationEditModal, MachineCreateModal, MachineEditModal).
 */
import { ApiError } from '../../../types/auth';

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
