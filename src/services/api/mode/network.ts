/**
 * Akses jaringan — dual-vhost D1 (port 80 LAN penuh, tunnel read-only).
 * FAT-285, E32.4.
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku.
 */
import type { NetworkAccessMode } from '../../../types/auth';
import { readEnv, readEnvBool, readEnvInt } from './env';

/** Port tunnel read-only (Guide D1). Sebelumnya hardcoded `8080` di context. */
export function resolveTunnelPort(): number {
  return readEnvInt('VITE_TUNNEL_PORT', 8080);
}

/**
 * Mode akses jaringan: override eksplisit `VITE_NETWORK_MODE` menang;
 * bila kosong, deteksi dari port (port tunnel → REMOTE_TUNNEL, lainnya LAN).
 */
export function resolveNetworkMode(): NetworkAccessMode {
  const override = (readEnv('VITE_NETWORK_MODE') ?? '').trim().toUpperCase();
  if (override === 'LAN' || override === 'REMOTE_TUNNEL') return override;
  try {
    if (typeof window !== 'undefined' && window.location.port === String(resolveTunnelPort())) {
      return 'REMOTE_TUNNEL';
    }
  } catch {
    // abaikan
  }
  return 'LAN';
}

/**
 * Apakah banner boleh menampilkan tombol simulasi pergantian mode jaringan
 * ("Mode Remote Tunnel" / "Kembali ke LAN"). Default MATI (`false`):
 * mode jaringan berasal dari env/deployment, bukan dari klik di UI —
 * tombol simulasi bisa mengklaim LAN palsu dari tunnel dan mengaktifkan
 * kembali mutasi yang seharusnya nonaktif. Nyalakan hanya untuk dev lokal.
 */
export function isNetworkModeSimulationAllowed(): boolean {
  return readEnvBool('VITE_ALLOW_NETWORK_MODE_SIMULATION', false);
}
