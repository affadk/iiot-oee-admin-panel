import { TimeWindowPreset } from '../../types/historical';
import { RETENTION_POLICY_DAYS } from './constants';

/**
 * Formats a Date into ISO 8601 with explicit timezone offset (e.g. `2026-11-01T00:00:00+07:00`).
 */
export function formatIsoWithOffset(date: Date = new Date()): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hh = pad(Math.floor(absMin / 60));
  const mm = pad(absMin % 60);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${hh}:${mm}`;
}

export function resolveTimeWindowPreset(
  preset: TimeWindowPreset,
  now: Date = new Date()
): { from: string; to: string } {
  const to = formatIsoWithOffset(now);
  const msPerHour = 60 * 60 * 1000;
  const msPerDay = 24 * msPerHour;

  switch (preset) {
    case '24h':
      return { from: formatIsoWithOffset(new Date(now.getTime() - msPerDay)), to };
    case '7d':
      return { from: formatIsoWithOffset(new Date(now.getTime() - 7 * msPerDay)), to };
    case '30d':
      return { from: formatIsoWithOffset(new Date(now.getTime() - 30 * msPerDay)), to };
    case '90d':
      return {
        from: formatIsoWithOffset(
          new Date(now.getTime() - (RETENTION_POLICY_DAYS * msPerDay - msPerHour))
        ),
        to,
      };
    case 'custom':
    default:
      return { from: formatIsoWithOffset(new Date(now.getTime() - 7 * msPerDay)), to };
  }
}
