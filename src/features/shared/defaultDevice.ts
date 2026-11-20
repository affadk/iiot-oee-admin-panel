// ---------------------------------------------------------------------------
// E28 Batch B (FAT-170, N-2): default device diturunkan dari daftar live
// GET /devices — BUKAN hardcode 'STM32-OEE-01' (device itu kini OFFLINE).
//
// Aturan (sesuai tiket):
// 1. device ONLINE pertama (urutan server dipertahankan);
// 2. bila tidak ada yang online, device pertama;
// 3. bila list kosong, `undefined` — pemanggil menampilkan empty state yang
//    jelas, bukan default karangan.
// Fungsi murni (tanpa fetch) supaya bisa diuji tanpa stub; pemanggil
// (TelemetryHistoryPage, DowntimeEventsPage, useOeeAnalytics) memberi daftar
// dari `useMasterAssetsQuery` yang sudah dimuat halaman itu.
// Demo mode tetap jalan: seed demo menempatkan STM32-OEE-01 online di
// urutan pertama, jadi default demo tidak berubah.
// ---------------------------------------------------------------------------

import { Machine } from '../../types/assets';

export interface DefaultDeviceCandidate {
  device_id: string;
  online?: boolean;
}

export function resolveDefaultDeviceId(
  devices: readonly DefaultDeviceCandidate[] | undefined | null
): string | undefined {
  if (!devices || devices.length === 0) return undefined;
  return devices.find((d) => d.online)?.device_id ?? devices[0]?.device_id;
}

/**
 * Device untuk halaman OEE: ikatan mesin terpilih tetap utama (device yang
 * terikat mesin itu, walau offline — korelasi overlay/pareto harus
 * mengikuti mesin itu); fallback-nya default live di atas, bukan hardcode.
 */
export function resolveMachineDeviceId(
  machines: readonly Machine[],
  devices: readonly DefaultDeviceCandidate[] | undefined | null,
  selectedMachine: string
): string | undefined {
  const matched = machines.find((m) => m.machine_id === selectedMachine);
  return (
    matched?.bound_device_id ??
    matched?.boundDevice?.device_id ??
    resolveDefaultDeviceId(devices)
  );
}
