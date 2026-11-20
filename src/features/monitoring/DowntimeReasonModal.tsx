import React, { useState, useEffect } from 'react';
import { DowntimeCategory, DowntimeEvent, DowntimeReasonResult } from '../../types/monitoring';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../services/api/client';
import { ApiError } from '../../types/auth';
import { useAuth, useCapability } from '../../context/AuthContext';
import { mapDowntimeToSixBigLoss } from '../../utils/historicalExport';
import { formatDuration, formatDeletedRelationLabel } from '../../utils/oeeCalculations';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface DowntimeReasonModalProps {
  event: DowntimeEvent | null;
  onClose: () => void;
  // E20 P20.5 (FAT-157): classify mengembalikan `DowntimeReasonResult`
  // (§J.3: {success, eventId, deviceId, operatorReason, isOverwrite,
  // operator}) — BUKAN DowntimeEvent penuh. Pemanggil memuat ulang
  // daftar (invalidateQueries) untuk event terbarunya.
  onSuccess: (result: DowntimeReasonResult) => void;
}

const CATEGORIES: { value: DowntimeCategory; label: string }[] = [
  { value: 'EQUIPMENT_FAILURE', label: '1. Equipment Failures / Breakdowns (Mesin Rusak)' },
  { value: 'SETUP_AND_ADJUSTMENT', label: '2. Setup & Adjustments (Changeover / Kalibrasi)' },
  { value: 'IDLING_AND_MINOR_STOPPAGE', label: '3. Idling & Minor Stops (Micro-stoppage <5m)' },
  { value: 'REDUCED_SPEED', label: '4. Reduced Speed (Kecepatan Siklus Lambat)' },
  { value: 'PROCESS_DEFECT', label: '5. Process Defects & Rework (Cacat Produksi)' },
  { value: 'MATERIAL_SHORTAGE', label: '6. Material Shortage (Kehabisan Bahan Baku)' },
  { value: 'PLANNED_MAINTENANCE', label: '6. Planned Maintenance (Perawatan Terjadwal)' },
  { value: 'REST_BREAK', label: '6. Scheduled Rest Break (Istirahat Shift)' },
  { value: 'CLEANING_5S', label: '6. Scheduled Cleaning / 5S' },
  { value: 'OTHER', label: '6. Other Startup / Organizational Losses' },
];

/**
 * E28 Batch B (FAT-230, MUT-04): buang prefix kategori "[KATEGORI] " di
 * depan teks alasan — server menyimpan `operatorReason` dengan prefix
 * itu saat label dikirim lewat POST /reason, sehingga alasan yang
 * dibaca kembali ("[EQUIPMENT_FAILURE] Equipment failure") bukan lagi
 * teks asli ("Equipment failure"). Dipakai saat prefill overwrite (agar
 * prefix tidak menumpuk di setiap overwrite berikut) dan saat opsi
 * "kembalikan ke Belum dikategorikan" dipakai. Hanya prefix di awal
 * yang dibuang; "[...]" di tengah teks dibiarkan.
 */
export function stripDowntimeCategoryPrefix(reason: string): string {
  return reason.replace(/^\[[A-Z0-9_]+\]\s*/, '');
}

/** Kategori netral untuk opsi kembalikan — lihat `DowntimeReasonModal`. */
export const RESTORE_UNLABELED_CATEGORY: DowntimeCategory = 'OTHER';

export const DowntimeReasonModal: React.FC<DowntimeReasonModalProps> = ({
  event,
  onClose,
  onSuccess,
}) => {
  const { reportForbidden } = useAuth();
  const canLabel = useCapability('downtime_event.label', event?.id);

  const [category, setCategory] = useState<DowntimeCategory>('EQUIPMENT_FAILURE');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  // E28 Batch B (FAT-230, MUT-04): opsi kembalikan ke "Belum
  // dikategorikan" — hanya untuk overwrite (event sudah berlabel).
  const [restoreUnlabeled, setRestoreUnlabeled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      // E23 Batch 3 (FAT-194, N-25): 'UNKNOWN' bukan nilai valid body
      // POST /reason (spec: 10 kategori) — default pelabelan ke 'OTHER'
      // (pilihan netral, masih bisa diubah pengguna).
      setCategory(event.category === 'UNKNOWN' ? 'OTHER' : event.category);
      // E28 Batch B (FAT-230): prefill TANPA prefix "[KATEGORI] " yang
      // ditambahkan server — pengguna mengedit teks aslinya, dan prefix
      // tidak menumpuk bila di-overwrite berulang kali.
      setReason(event.is_labeled ? stripDowntimeCategoryPrefix(event.reason) : '');
      setNotes(event.notes ?? '');
      setRestoreUnlabeled(false);
      setErrorMsg(null);
    }
  }, [event]);

  if (!event) return null;

  const isOverwrite = event.is_labeled;
  const sixBigLoss = mapDowntimeToSixBigLoss(
    restoreUnlabeled ? RESTORE_UNLABELED_CATEGORY : category
  );
  const machineLabel = formatDeletedRelationLabel(event.machine_name, event.machine_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canLabel.canInteract) {
      setErrorMsg(canLabel.reason || 'Aksi dinonaktifkan oleh kebijakan akses.');
      return;
    }
    if (reason.trim().length < 3 || reason.trim().length > 255) {
      setErrorMsg('Alasan downtime wajib antara 3–255 karakter.');
      return;
    }
    if (notes.length > 500) {
      setErrorMsg('Catatan tambahan maksimal 500 karakter.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      // E28 Batch B (FAT-230): mode kembalikan memakai kategori netral
      // 'OTHER' + teks asli tanpa prefix. Spec 20 Nov MEWAJIBKAN
      // `category` (10 nilai enum, tanpa 'UNKNOWN' dan tanpa endpoint
      // unlabel) — jadi "tanpa kategori" tidak bisa dikirim; ini yang
      // paling dekat dengan "Belum dikategorikan" yang diizinkan API.
      // Kolom kategori hanya bisa benar-benar kembali ke "Belum
      // dikategorikan" bila backend menambah dukungan unlabel.
      const result = await apiClient.classifyDowntimeReason(
        event.id,
        restoreUnlabeled ? RESTORE_UNLABELED_CATEGORY : category,
        reason.trim(),
        notes.trim() || undefined
      );
      onSuccess(result);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('downtime_event.label', event.id, err.message);
      }
      setErrorMsg(err?.message || 'Gagal mengklasifikasi alasan downtime.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(event)}
      onClose={() => !isLoading && onClose()}
      title={isOverwrite ? 'Overwrite Alasan Downtime' : 'Klasifikasi Alasan Downtime'}
      subtitle={`${machineLabel.label} (${event.device_id ?? '[dihapus]'}) · Durasi: ${event.durationFormatted || formatDuration(event.duration_seconds)}`}
      maxWidth="lg"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!canLabel.canInteract}
            title={!canLabel.canInteract ? canLabel.reason : undefined}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isOverwrite ? 'Simpan Overwrite' : 'Simpan Klasifikasi'}</span>
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isOverwrite && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Peristiwa downtime ini sudah diklasifikasikan sebelumnya ({event.reason}). Mengubahnya akan dicatat sebagai revisi pada riwayat aktivitas.
            </span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-300"
          >
            {errorMsg}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Kategori Six Big Losses
          </label>
          <select
            value={restoreUnlabeled ? RESTORE_UNLABELED_CATEGORY : category}
            disabled={restoreUnlabeled}
            onChange={(e) => setCategory(e.target.value as DowntimeCategory)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* E28 Batch B (FAT-230, MUT-04): opsi kembalikan ke "Belum
            dikategorikan" — hanya saat overwrite. Mengirim kategori
            netral OTHER + teks asli tanpa prefix "[KATEGORI] ". */}
        {isOverwrite && (
          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded">
            <input
              type="checkbox"
              checked={restoreUnlabeled}
              onChange={(e) => setRestoreUnlabeled(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 mt-0.5"
            />
            <span>
              <span className="font-semibold">Kembalikan ke &ldquo;Belum dikategorikan&rdquo;</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Label dikirim sebagai kategori netral (Other) dengan teks alasan asli tanpa
                prefix kategori. API saat ini mewajibkan satu dari 10 kategori — kolom
                kategori baru benar-benar kembali ke &ldquo;Belum dikategorikan&rdquo; bila
                backend menambah dukungan unlabel.
              </span>
            </span>
          </label>
        )}

        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded text-xs flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-500" />
            Pilar OEE:
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {sixBigLoss.label} · <strong>{sixBigLoss.oee_pillar}</strong>
          </span>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Deskripsi Akar Masalah (3–255 karakter)
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            placeholder="Contoh: Tekanan hidrolik drop di bawah 45 bar, mengganti seal valve."
            required
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Catatan Tambahan / Tindakan Perbaikan (Opsional, maks 500 karakter)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Sparepart terpasang: Seal Viton #SV-44, dites oleh teknisi shift..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <div className="text-[11px] text-slate-400 text-right font-tabular">{notes.length}/500</div>
        </div>
      </form>
    </Modal>
  );
};
