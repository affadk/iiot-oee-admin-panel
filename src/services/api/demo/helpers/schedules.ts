/**
 * Helper demo: validasi tumpang tindih jadwal shift.
 *
 * Dipisah dari demo/helpers.ts (415 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../helpers.ts).
 */

import { store } from '../store';
import { ApiError } from '../../../../types/auth';
import { doTimeRangesOverlap } from '../../../../utils/capabilities';

/** 409 SHIFT_SCHEDULE_OVERLAP: satu lini tidak boleh punya 2 shift yang jamnya tumpang tindih di hari yang sama. */
export function assertNoScheduleOverlap(lineId: string, shiftId: string, dayOfWeek: number, excludeScheduleId: string | null) {
  const shift = store.shifts.find((s) => s.shiftId === shiftId);
  if (!shift) return;
  for (const other of store.shiftSchedules) {
    if (!other.isActive || other.lineId !== lineId || other.dayOfWeek !== dayOfWeek) continue;
    if (excludeScheduleId && other.scheduleId === excludeScheduleId) continue;
    const otherShift = store.shifts.find((s) => s.shiftId === other.shiftId);
    if (!otherShift) continue;
    if (doTimeRangesOverlap(shift.startTime, shift.endTime, otherShift.startTime, otherShift.endTime)) {
      throw new ApiError({
        code: 'SHIFT_SCHEDULE_OVERLAP',
        message: `Jadwal tumpang tindih: shift ${shift.shiftCode} (${shift.startTime}–${shift.endTime}) bentrok dengan ${otherShift.shiftCode} (${otherShift.startTime}–${otherShift.endTime}) di lini ${lineId} hari ke-${dayOfWeek}.`,
        httpStatus: 409,
      });
    }
  }
}
