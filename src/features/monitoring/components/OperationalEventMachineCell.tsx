import React from 'react';
import { OperationalEvent } from '../../../types/monitoring';
import { Badge } from '../../../components/ui/Badge';
import { formatDeletedRelationLabel } from '../../../utils/oeeCalculations';

/**
 * E27 (FAT-233, T2): sel "Mesin / Device" tabel operational events
 * (`/admin/audit`) — menampilkan `station_label` mentah di bawah device_id.
 *
 * - `station_label` = data mentah UNTRUSTED dari klien: dirender sebagai
 *   teks biasa (React meng-escape), dipotong tampilannya saja via CSS
 *   truncate + `title` (nilai untuk logika tidak dipotong), TIDAK dipakai
 *   sebagai key React, TIDAK dipakai sebagai kunci lookup, TIDAK pernah
 *   dirender via dangerouslySetInnerHTML.
 * - Badge "Tidak terdaftar" HANYA bila `device_id === null` DAN
 *   `station_label` ada (string non-kosong setelah trim). Bila `device_id`
 *   ada, label (bila ada) tampil sebagai teks biasa tanpa badge.
 * - Bila keduanya null/kosong, baris stasiun tidak dirender.
 */
export const OperationalEventMachineCell: React.FC<{ ev: OperationalEvent }> = ({ ev }) => {
  const machLbl = formatDeletedRelationLabel(ev.machine_name, ev.machine_id);
  const devLbl = formatDeletedRelationLabel(ev.device_id, null);
  const stationLabel = typeof ev.station_label === 'string' ? ev.station_label : null;
  const hasStationLabel = stationLabel !== null && stationLabel.trim() !== '';
  const showUnregisteredBadge = ev.device_id === null && hasStationLabel;

  return (
    <div className="text-xs">
      <div
        className={
          machLbl.isDeleted
            ? 'italic text-slate-400'
            : 'font-semibold text-slate-900 dark:text-slate-100'
        }
      >
        {machLbl.label}
      </div>
      <div className="text-[11px] font-tabular text-slate-400">
        {devLbl.isDeleted ? '[dihapus]' : ev.device_id}
      </div>
      {hasStationLabel && (
        <div className="mt-1 flex items-center gap-1.5 min-w-0">
          <span
            className="text-[11px] font-tabular text-slate-500 truncate"
            title={stationLabel as string}
          >
            {stationLabel}
          </span>
          {showUnregisteredBadge && <Badge variant="warning">Tidak terdaftar</Badge>}
        </div>
      )}
    </div>
  );
};
