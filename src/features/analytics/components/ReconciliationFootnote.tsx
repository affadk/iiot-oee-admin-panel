import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { HourlyOeePoint, ShiftSummary, ShiftTimelineSegment } from '../../../types/analytics';
import {
  computeOeeReconciliation,
  formatReconciliationDiff,
  formatReconciliationValue,
  RECONCILIATION_RELATIVE_TOLERANCE,
  RECONCILIATION_TIME_TOLERANCE_SEC,
  ReconciliationCheck,
} from '../reconciliation';

interface ReconciliationFootnoteProps {
  summary: ShiftSummary | null;
  hourly: HourlyOeePoint[];
  timeline: ShiftTimelineSegment[];
}

/**
 * E12 T12.6 (U-3 / FAT-56): catatan kaki rekonsiliasi halaman OEE (gap G2).
 *
 * Menghitung dari data yang SUDAH dimuat halaman (ringkasan shift, tabel
 * per jam, timeline) — tanpa fetch baru — dan menampilkannya sebagai
 * catatan kaki, bukan blokir. Bila ada selisih melewati ambang, barisnya
 * ditandai peringatan. Tidak tampil sama sekali bila datanya belum lengkap
 * (widget di atas sudah menampilkan skeleton / pesan kosong / error-nya
 * sendiri, gap G17).
 */
export const ReconciliationFootnote: React.FC<ReconciliationFootnoteProps> = ({
  summary,
  hourly,
  timeline,
}) => {
  const rec = computeOeeReconciliation(summary, hourly, timeline);
  if (!rec.hasData) return null;

  const relativePct = Math.round(RECONCILIATION_RELATIVE_TOLERANCE * 100);

  return (
    <section
      aria-label="Rekonsiliasi data OEE"
      className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Rekonsiliasi data
        </h2>
        {rec.isConsistent ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Cocok
          </span>
        ) : (
          <span
            role="alert"
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
          >
            <AlertTriangle className="w-3 h-3" />
            {rec.warningCount} selisih melebihi ambang
          </span>
        )}
      </div>

      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
        {rec.checks.map((check) => (
          <ReconciliationCheckRow key={check.id} check={check} />
        ))}
      </ul>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Perbandingan ini mengasumsikan ringkasan, tabel per jam, dan timeline
        mencakup jendela yang sama. Ambang peringatan — waktu: selisih &gt;{' '}
        {RECONCILIATION_TIME_TOLERANCE_SEC} detik atau &gt; {relativePct}% dari
        nilai ringkasan; parts: selisih &gt; {relativePct}% dari nilai ringkasan.
      </p>
    </section>
  );
};

function ReconciliationCheckRow({ check }: { check: ReconciliationCheck }) {
  const left = formatReconciliationValue(check.leftValue, check.unit);
  const right = formatReconciliationValue(check.rightValue, check.unit);
  const diffText = formatReconciliationDiff(check.diff, check.unit);
  const thresholdNote =
    check.unit === 'pcs'
      ? `ambang: > ${Math.round(RECONCILIATION_RELATIVE_TOLERANCE * 100)}%`
      : `ambang: > ${RECONCILIATION_TIME_TOLERANCE_SEC} dtk atau > ${Math.round(RECONCILIATION_RELATIVE_TOLERANCE * 100)}%`;

  if (check.status === 'unavailable') {
    return (
      <li>
        {check.label}: {left} vs {right} —{' '}
        <span className="text-slate-500 dark:text-slate-400">data tidak lengkap</span>
        {check.note ? ` (${check.note})` : ''}
      </li>
    );
  }
  if (check.status === 'warning') {
    return (
      <li className="text-amber-700 dark:text-amber-300">
        {check.label}: {left} vs {right} —{' '}
        <span className="font-medium">selisih {diffText}</span> ({thresholdNote})
        {check.note ? ` — ${check.note}` : ''}
      </li>
    );
  }
  return (
    <li>
      {check.label}: {left} vs {right} — cocok
      {check.note ? ` (${check.note})` : ''}
    </li>
  );
}
