/**
 * Countdown TTL sesi + sliding refresh proaktif (FAT-282 / E32.1).
 *
 * Diekstrak dari AuthContext: satu hook = satu alur (aturan R4) —
 * hitung mundur 1 detik, refresh proaktif saat sisa TTL ≤ 20%
 * (80% terlewati, single-flight), logout saat TTL habis.
 *
 * Perilaku dipertahankan persis dari AuthContext sebelum split:
 * - Refresh TANPA syarat kanal (E29 FAT-245 T6): refresh bukan mutasi
 *   (spec /auth/refresh tanpa 403); sesi tidak boleh mati di TTL hanya
 *   karena kanal REMOTE_TUNNEL.
 * - Ambang refresh = max(1, floor(total * 0.2)).
 * - Gagal refresh ditangani diam-diam (hook 401 yang menangani bila
 *   token kedaluwarsa); logout hanya saat counter mencapai 0.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api/client';
import { resolveAuthTtlFallbackSec } from '../services/api/mode';

/**
 * TTL fallback bila server tidak mengirim expires_in — satu sumber,
 * dipakai hook ini dan login di AuthContext.
 */
export const DEFAULT_AUTH_TTL_FALLBACK_SEC = resolveAuthTtlFallbackSec();

export interface SessionTtlControls {
  /** Sisa TTL sesi dalam detik (0 = tidak ada sesi aktif). */
  sessionTtlRemaining: number;
  /** Set total + sisa TTL sekaligus (dipakai login & silent restore). */
  setSessionTtl: (ttl: number) => void;
}

export function useSessionTtl(args: {
  isAuthenticated: boolean;
  /** Dipanggil saat TTL habis — AuthContext meneruskan ke logout(reason). */
  onExpire: (reason: string) => void;
  /** Dipanggil setelah refreshSession sukses — AuthContext meneruskan ke refreshCapabilities. */
  onRefreshed: () => Promise<void>;
}): SessionTtlControls {
  const { isAuthenticated, onExpire, onRefreshed } = args;
  const [sessionTtlRemaining, setSessionTtlRemaining] = useState<number>(0);
  const [sessionTtlTotal, setSessionTtlTotal] = useState<number>(0);

  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const setSessionTtl = useCallback((ttl: number) => {
    setSessionTtlTotal(ttl);
    setSessionTtlRemaining(ttl);
  }, []);

  // Session TTL countdown + proactive single-flight sliding refresh at
  // 80% elapsed (20% remaining).
  useEffect(() => {
    if (!isAuthenticated) return;
    const refreshThreshold = Math.max(1, Math.floor(sessionTtlTotal * 0.2));
    const interval = setInterval(() => {
      setSessionTtlRemaining((prev) => {
        if (prev <= 1) {
          onExpire('Waktu sesi operator habis. Silakan masuk kembali.');
          return 0;
        }
        const next = prev - 1;
        // Refresh proactively at <= 20% remaining (80% elapsed), any channel
        if (next === refreshThreshold && !refreshInFlightRef.current) {
          refreshInFlightRef.current = apiClient
            .refreshSession()
            .then((refreshed) => {
              const nextTotal = refreshed.expires_in || DEFAULT_AUTH_TTL_FALLBACK_SEC;
              setSessionTtlTotal(nextTotal);
              setSessionTtlRemaining(nextTotal);
              onRefreshed();
            })
            .catch(() => {
              // Handled cleanly by 401 hook if expired
            })
            .finally(() => {
              refreshInFlightRef.current = null;
            });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, sessionTtlTotal, onExpire, onRefreshed]);

  return { sessionTtlRemaining, setSessionTtl };
}
