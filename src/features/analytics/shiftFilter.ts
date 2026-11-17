import { HistoryFilters } from '../../types/historical';
import { Shift } from '../../types/production';
import { addDaysToDateString, dateKeyInJakarta, resolveShiftWindow } from '../../utils/historicalExport';
import { getDefaultHistoryRange } from '../shared/historyFilters';

/**
 * E12 T12.1 (X-1 / FAT-54): filter shift (tanggal + shift) — logika murni
 * pemilih shift. TANPA fetch/query baru: jam shift diambil dari definisi
 * Shift yang sudah ada (Shift.startTime/endTime 'HH:MM' — seed SHIFT-1
 * 07:00–15:00, SHIFT-2 15:00–23:00, SHIFT-3 00:00–07:00), jendela dihitung
 * resolveShiftWindow (cross-midnight safe).
 */

export interface ShiftFilterSelection {
  shiftDate: string; // YYYY-MM-DD, tanggal mulai shift
  shiftId: string; // Shift.shiftId
}

/**
 * 'YYYY-MM-DD' di Asia/Jakarta dari Date (E12 T12.11 / X-4 — sebelumnya
 * tanggal lokal browser; "hari ini" bergeser untuk browser di luar WIB).
 * Fallback ke tanggal lokal bila instant tidak valid (tidak pernah terjadi
 * untuk `new Date()`).
 */
export function toLocalDateString(date: Date): string {
  return (
    dateKeyInJakarta(date) ??
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  );
}

/** Tanggal kalender N hari lalu (lokal), mis. kemarin = daysAgoDateString(1). */
export function daysAgoDateString(days: number, now: Date = new Date()): string {
  return addDaysToDateString(toLocalDateString(now), -days) ?? toLocalDateString(now);
}

/** Shift dengan kode 'S1' (Shift 1) — target tombol cepat "Shift 1 kemarin". */
export function findShiftOne(shifts: Shift[]): Shift | undefined {
  return shifts.find((s) => s.shiftCode === 'S1') ?? shifts.find((s) => s.isActive);
}

/**
 * Patch filter untuk pilihan shift: shiftDate + shiftId + from/to jendela
 * shift itu. Null bila shift/tanggal tidak valid — pemanggil tidak mengubah
 * filter.
 */
export function buildShiftFilterPatch(
  shift: Shift | undefined | null,
  date: string | undefined | null
): (ShiftFilterSelection & { from: string; to: string }) | null {
  if (!shift || !date) return null;
  const window = resolveShiftWindow(shift, date);
  if (!window) return null;
  return { shiftDate: date, shiftId: shift.shiftId, from: window.from, to: window.to };
}

/**
 * Patch untuk menghapus filter shift: pilihan shift dibersihkan dan rentang
 * kembali ke default panel (7 hari sliding) — perilaku default tidak berubah
 * bila tidak ada shift dipilih.
 */
export function buildClearShiftFilterPatch(): Partial<HistoryFilters> {
  const range = getDefaultHistoryRange(7);
  return { shiftDate: undefined, shiftId: undefined, from: range.from, to: range.to };
}
