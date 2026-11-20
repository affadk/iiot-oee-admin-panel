import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { resolveApiMode } from '../../services/api/mode';

// ---------------------------------------------------------------------------
// E28 Batch B (FAT-207, N-38 — sisa indikator koneksi): status koneksi
// backend di /login, dari GET /health (endpoint publik, tanpa auth).
//
// MODE-AWARE: hanya dirender di mode Real. Di mode Demo tidak ada backend —
// ping ke sana akan selalu gagal dan menyesatkan, jadi komponen
// mengembalikan null.
// INFORMATIF SAJA: tidak memblokir submit login. Bila ping gagal, statusnya
// "Tidak dapat diperiksa" (netral, abu-abu) — BUKAN error merah yang
// menuduh backend mati: kegagalan bisa juga dari CORS/jaringan klien
// (CORS Vercel sudah diperbaiki live, tapi dari LAN lain belum tentu).
// Timeout 8 detik supaya status "Memeriksa…" tidak menggantung selamanya.
// ---------------------------------------------------------------------------

type HealthStatus = 'checking' | 'ok' | 'unknown';

const PING_TIMEOUT_MS = 8000;

export const BackendHealthIndicator: React.FC = () => {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const startedAt = Date.now();
    setStatus('checking');
    setLatencyMs(null);
    try {
      await apiClient.getSystemHealth(controller.signal);
      if (controller.signal.aborted) return;
      setLatencyMs(Date.now() - startedAt);
      setStatus('ok');
    } catch {
      if (controller.signal.aborted) return;
      setStatus('unknown');
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    // Demo mode: tidak ada backend — jangan ping sama sekali.
    if (resolveApiMode() !== 'real') return;
    void check();
    return () => abortRef.current?.abort();
  }, [check]);

  // Demo mode: tidak ada backend untuk di-ping — jangan tampilkan apa pun.
  if (resolveApiMode() !== 'real') return null;

  return (
    <div
      role="status"
      className="px-6 pt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
    >
      <span
        aria-hidden="true"
        className={`w-2 h-2 rounded-full shrink-0 ${
          status === 'ok'
            ? 'bg-emerald-500'
            : status === 'unknown'
              ? 'bg-slate-400'
              : 'bg-amber-400 animate-pulse'
        }`}
      />
      <span>
        {status === 'checking' && 'Memeriksa koneksi backend…'}
        {status === 'ok' &&
          `Backend terhubung${latencyMs !== null ? ` · ${latencyMs} ms` : ''}`}
        {status === 'unknown' &&
          'Koneksi backend tidak dapat diperiksa — login tetap bisa dicoba.'}
      </span>
      <button
        type="button"
        onClick={() => void check()}
        disabled={status === 'checking'}
        className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 hover:underline disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Periksa lagi</span>
      </button>
    </div>
  );
};
