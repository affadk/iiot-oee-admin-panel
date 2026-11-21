import { formatIsoWithOffset } from '../../utils/historicalExport';

/**
 * Konversi ISO ↔ nilai input datetime-local.
 * Dipindah dari HistoricalExportToolbar.tsx (E32.6, FAT-287).
 */
export function isoToLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localInputValueToIso(val: string, fallbackIso: string): string {
  if (!val) return fallbackIso;
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return formatIsoWithOffset(parsed);
}
