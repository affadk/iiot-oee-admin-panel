import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { OperationalEvent } from '../../../types/monitoring';

export interface UnknownStation {
  /** Label mentah dari event, di-trim — UNTRUSTED, jangan jadikan key React / kunci lookup. */
  label: string;
  count: number;
  /** recorded_at event terakhir (ISO) atau null bila tak tersedia. */
  lastSeenAt: string | null;
}

/**
 * E27 Spec 043 (FAT-234, T3): baca station_label secara toleran.
 * T2 menambahkan `station_label` ke tipe + mapper OperationalEvent, tapi
 * sebelum merge itu field-nya tidak ada di tipe — baca dari objek mentah
 * (snake_case atau camelCase) agar derivasi ini jalan di kedua keadaan.
 * Bila backend belum mengirim field-nya (Q2), hasilnya null dan panel
 * menampilkan empty state, bukan error.
 *
 * E30 (FAT-256, P30.3): bingkai baru — event yang sama (SECURITY_REJECTION,
 * device_id null, station_label) kini berarti "terminal tak dikenal mencoba
 * kirim data", bukan "percobaan login". Logika derivasi tidak berubah;
 * penulisan audit baru menjadi tugas backend (B30.2).
 */
export function readStationLabel(event: OperationalEvent): string | null {
  const raw = event as unknown as Record<string, unknown>;
  const v = raw.station_label ?? raw.stationLabel;
  return typeof v === 'string' ? v : null;
}

/**
 * Derivasi client-side T3: event SECURITY_REJECTION dengan device_id null
 * dan station_label non-kosong → distinct label (trim-normalisasi,
 * case-sensitive) yang BELUM terdaftar sebagai device_id.
 */
export function deriveUnknownStations(
  events: OperationalEvent[],
  registeredIds: string[],
): UnknownStation[] {
  const registered = new Set(registeredIds);
  const byLabel = new Map<string, UnknownStation>();
  for (const ev of events) {
    if (ev.event_type !== 'SECURITY_REJECTION') continue;
    if (ev.device_id !== null && ev.device_id !== undefined) continue;
    const rawLabel = readStationLabel(ev);
    if (!rawLabel) continue;
    const label = rawLabel.trim();
    if (!label) continue;
    if (registered.has(label)) continue;
    const at = typeof ev.recorded_at === 'string' ? ev.recorded_at : null;
    const prev = byLabel.get(label);
    if (!prev) {
      byLabel.set(label, { label, count: 1, lastSeenAt: at });
    } else {
      prev.count += 1;
      if (at && (!prev.lastSeenAt || at > prev.lastSeenAt)) prev.lastSeenAt = at;
    }
  }
  return [...byLabel.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function useUnknownStations(registeredIds: string[]) {
  const [unknownStations, setUnknownStations] = useState<UnknownStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Total event SECURITY_REJECTION di server (bila API mengembalikannya). */
  const [totalEvents, setTotalEvents] = useState<number | null>(null);

  const registeredKey = registeredIds.join('\n');

  const loadUnknownStations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Halaman pertama secukupnya (limit 50); bila ada lebih, tampilkan
      // "dan N lainnya" dari total_count — jangan mengarang jumlah.
      const page = await apiClient.getOperationalEventsPage({
        event_type: 'SECURITY_REJECTION',
        limit: 50,
      });
      setTotalEvents(page.pagination?.total_count ?? null);
      setUnknownStations(deriveUnknownStations(page.data, registeredKey.split('\n').filter(Boolean)));
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat diagnostik terminal.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredKey]);

  useEffect(() => {
    loadUnknownStations();
  }, [loadUnknownStations]);

  return { unknownStations, isLoading, error, totalEvents, loadUnknownStations };
}
