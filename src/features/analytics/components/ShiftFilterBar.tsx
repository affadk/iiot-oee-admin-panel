import React, { useEffect, useState } from 'react';
import { HistoryFilters } from '../../../types/historical';
import { Shift } from '../../../types/production';
import { isCrossMidnightShift } from '../../../utils/historicalExport';
import { Button } from '../../../components/ui/Button';
import {
  buildClearShiftFilterPatch,
  buildShiftFilterPatch,
  daysAgoDateString,
  findShiftOne,
  toLocalDateString,
} from '../shiftFilter';

export interface ShiftFilterBarProps {
  shifts: Shift[];
  shiftsLoading?: boolean;
  /** E28 Batch B (FAT-220, E2E-06): query shift BENAR-BENAR gagal
      (bukan masih loading, bukan daftar kosong). Hanya bila ini true
      peringatan "tidak tersedia" boleh tampil. */
  shiftsError?: boolean;
  shiftDate?: string;
  shiftId?: string;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
}

/**
 * E12 T12.1 (X-1 / FAT-54): pemilih shift (tanggal + shift) untuk
 * Telemetry History dan halaman OEE. Memilih tanggal + shift menghitung
 * jendela shift (resolveShiftWindow) dan meneruskannya sebagai from/to —
 * "Shift 1 kemarin" jadi satu klik lewat tombol cepat, bukan hitung manual
 * + edit URL. Tanpa shift terpilih, perilaku default (7 hari sliding)
 * tidak berubah.
 */
export const ShiftFilterBar: React.FC<ShiftFilterBarProps> = ({
  shifts,
  shiftsLoading = false,
  shiftsError = false,
  shiftDate,
  shiftId,
  onFilterChange,
}) => {
  const activeShifts = shifts.filter((s) => s.isActive);
  const selectedShift = activeShifts.find((s) => s.shiftId === shiftId);
  // Draf tanggal: hari ini bila belum ada shift terpilih; mengikuti
  // pilihan aktif bila diubah dari luar (mis. URL / tombol cepat).
  const [draftDate, setDraftDate] = useState<string>(
    () => shiftDate ?? toLocalDateString(new Date())
  );
  useEffect(() => {
    if (shiftDate) setDraftDate(shiftDate);
  }, [shiftDate]);

  const applySelection = (date: string, id: string) => {
    const shift = activeShifts.find((s) => s.shiftId === id);
    const patch = buildShiftFilterPatch(shift, date);
    if (patch) onFilterChange(patch);
  };

  const handleDateChange = (date: string) => {
    setDraftDate(date);
    if (date && shiftId) applySelection(date, shiftId);
  };

  const handleShiftChange = (id: string) => {
    if (!id) {
      onFilterChange(buildClearShiftFilterPatch());
      return;
    }
    if (draftDate) applySelection(draftDate, id);
  };

  const handleYesterdayShiftOne = () => {
    const shiftOne = findShiftOne(activeShifts);
    if (!shiftOne) return;
    const yesterday = daysAgoDateString(1);
    setDraftDate(yesterday);
    applySelection(yesterday, shiftOne.shiftId);
  };

  const shiftOne = findShiftOne(activeShifts);
  // E28 Batch B (FAT-220, E2E-06 — TERKONFIRMASI dari kode): kedua
  // pemanggil lama tidak meneruskan `shiftsLoading` (default false),
  // sehingga saat query shift masih memuat, `activeShifts` kosong dan
  // peringatan "tidak tersedia" sempat berkedip lalu hilang sendiri —
  // persis observasi E2E §33.4. Peringatan kini HANYA bila query gagal
  // (`shiftsError`); saat loading tampil teks "Memuat…", dan bila query
  // sukses tapi kosong tampil catatan netral (bukan tuduhan akses/koneksi).
  const noActiveShifts = activeShifts.length === 0;
  const unavailable = !shiftsLoading && noActiveShifts;

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-end gap-3">
      <div>
        <label htmlFor="shift-date-input" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Tanggal Shift
        </label>
        <input
          id="shift-date-input"
          type="date"
          value={draftDate}
          disabled={unavailable}
          onChange={(e) => handleDateChange(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="flex-1 min-w-0">
        <label htmlFor="shift-select" className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Shift
        </label>
        <select
          id="shift-select"
          value={selectedShift ? selectedShift.shiftId : ''}
          disabled={unavailable}
          onChange={(e) => handleShiftChange(e.target.value)}
          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        >
          <option value="">Semua periode (7 hari terakhir)</option>
          {activeShifts.map((s) => (
            <option key={s.shiftId} value={s.shiftId}>
              {s.shiftName} ({s.startTime}–{s.endTime})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <Button
          size="sm"
          variant="secondary"
          disabled={unavailable || !shiftOne}
          onClick={handleYesterdayShiftOne}
          title="Tampilkan Shift 1 kemarin (satu klik)"
        >
          Shift 1 kemarin
        </Button>
        {shiftId && (
          <Button size="sm" variant="secondary" onClick={() => onFilterChange(buildClearShiftFilterPatch())}>
            Hapus filter shift
          </Button>
        )}
      </div>

      {shiftsLoading && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Memuat daftar shift…
        </p>
      )}
      {!shiftsLoading && shiftsError && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Daftar shift tidak tersedia — periksa akses shift.read / koneksi.
        </p>
      )}
      {!shiftsLoading && !shiftsError && noActiveShifts && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Belum ada shift aktif yang terdaftar — filter shift tidak dapat dipakai.
        </p>
      )}
      {selectedShift && shiftDate && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Jendela: {selectedShift.startTime}–{selectedShift.endTime}
          {isCrossMidnightShift(selectedShift) ? ' (+1 hari)' : ''} pada {shiftDate}.
        </p>
      )}
    </div>
  );
};
