/**
 * Silent restore sesi dari sessionStorage (FAT-280 Opsi B).
 *
 * Dipakai AuthProvider saat mount (mode Real saja): bila ada token
 * tersimpan, token itu dipakai untuk POST /auth/refresh — sekaligus
 * memvalidasi dan merotasi token — lalu GET /auth/me mengisi identitas.
 * TIDAK PERNAH melempar: semua kegagalan dikembalikan sebagai
 * `{ ok: false, reason }` agar pemanggil tidak perlu .catch.
 *
 * Batas yang diketahui (bukan bug): reload setelah JWT kedaluwarsa
 * (>900 dtk sejak refresh terakhir) tetap minta login ulang — backend
 * /auth/refresh hanya menerima JWT yang masih berlaku dan TIDAK ADA
 * refresh token terpisah (lihat ~/workspace/auth-bug-diagnosis.md §7).
 * Mode Demo TIDAK dipulihkan: state auth demo hidup di store in-memory
 * (`currentUserId`, `isAuthenticated`, token `mem_jwt_…`) — token palsu
 * yang disimpan tidak akan memulihkan state itu; demo juga alat dev
 * yang login ulangnya satu klik (preset login).
 */
import { useEffect, useRef, useState } from 'react';
import { ApiError, AuthMeResponse, UserRole } from '../types/auth';
import { apiClient } from '../services/api/client';
import { resolveApiMode, resolveAuthTtlFallbackSec } from '../services/api/mode';
import { clearStoredHttpToken, getStoredHttpToken, setHttpToken } from '../services/api/http/transport';

export interface SessionUser {
  operator_id: string;
  name: string;
  role: UserRole;
  line_id?: string;
}

export interface RestoredSession {
  ok: true;
  user: SessionUser;
  expiresIn: number;
  mustChangePassword: boolean;
}

export type RestoreResult =
  | RestoredSession
  | { ok: false; reason: 'no-token' | 'refresh-failed' | 'me-failed' | 'unexpected' };

export interface SessionRestoreClient {
  refreshSession: () => Promise<{ token: string; expires_in: number; authz_version: number }>;
  getAuthMe: () => Promise<AuthMeResponse>;
}

export async function restoreSessionFromStorage(client: SessionRestoreClient): Promise<RestoreResult> {
  try {
    return await restoreSessionFromStorageInner(client);
  } catch {
    // Jaminan: fungsi ini TIDAK PERNAH melempar (mis. respons refresh
    // cacat) — pemanggil selalu mendapat { ok: false }.
    return { ok: false, reason: 'unexpected' };
  }
}

async function restoreSessionFromStorageInner(client: SessionRestoreClient): Promise<RestoreResult> {
  const stored = getStoredHttpToken();
  if (!stored) return { ok: false, reason: 'no-token' };
  // Isi memori dulu — refreshSession() mengirim JWT tersimpan ini.
  setHttpToken(stored);
  let refreshed: { token: string; expires_in: number; authz_version: number };
  try {
    refreshed = await client.refreshSession();
  } catch (err) {
    // 400/401 = token mati (kedaluwarsa/ditolak) → hapus simpanan.
    // Galat lain (jaringan/timeout) = token mungkin masih valid → simpan
    // tetap ada agar reload berikutnya bisa mencoba lagi.
    if (err instanceof ApiError && (err.httpStatus === 400 || err.httpStatus === 401)) {
      clearStoredHttpToken();
      setHttpToken(null);
    }
    return { ok: false, reason: 'refresh-failed' };
  }
  // Simpan token hasil rotasi — JANGAN andalkan efek samping client:
  // refreshSession() klien HTTP asli memang menyimpannya sendiri, tapi
  // kontrak helper ini harus berlaku untuk client apa pun. Tanpa baris
  // ini, token lama tetap tersimpan dan rotasi terbuang.
  setHttpToken(refreshed.token);
  let me: AuthMeResponse;
  try {
    me = await client.getAuthMe();
  } catch {
    // Transien (jaringan) — token sudah terotasi dan valid; biarkan
    // tersimpan untuk percobaan berikut, jangan paksa login ulang.
    return { ok: false, reason: 'me-failed' };
  }
  return {
    ok: true,
    user: {
      operator_id: me.operator.operator_id,
      name: me.operator.name,
      role: me.operator.role,
      line_id: me.operator.line_id,
    },
    expiresIn: refreshed.expires_in || resolveAuthTtlFallbackSec(),
    mustChangePassword: me.operator.mustChangePassword === true,
  };
}

/**
 * Apakah silent restore harus berjalan saat boot — dipakai sebagai nilai
 * AWAL state `isRestoringSession` (lazy initializer, dievaluasi SINKRON
 * saat render pertama AuthProvider).
 *
 * FAT-280 race (verifikasi live 2026-11-20 GAGAL sebelum perbaikan ini):
 * nilai awal hook adalah `useState(false)`, sehingga render pertama
 * punya isAuthenticated=false + isRestoringSession=false → AdminLayout
 * langsung me-return `<Navigate to="/login" />` SEBELUM effect restore
 * berjalan (effect jalan setelah render pertama). Restore lalu selesai
 * di background, tapi route sudah /login dan LoginPage tidak redirect
 * saat sudah terautentikasi → pengguna terjebak di /login. Dengan
 * initializer sinkron ini, bila ada token tersimpan (mode Real), render
 * pertama SUDAH menahan redirect (placeholder "Memulihkan sesi…").
 * Tanpa token / mode Demo → false (redirect langsung, benar).
 */
export function shouldRestoreAtBoot(): boolean {
  return resolveApiMode() === 'real' && getStoredHttpToken() !== null;
}

/**
 * Hook silent restore (FAT-280 Opsi B): dipanggil AuthProvider saat mount.
 * Mengembalikan true selama percobaan restore berjalan — AdminLayout
 * menahan redirect /login selama itu. Mode Demo tidak dipulihkan
 * (alasan di header file ini).
 */
export function useSessionRestore(
  applySession: (user: SessionUser, ttl: number, mustChange: boolean) => void,
): boolean {
  // Nilai awal SINKRON (lihat shouldRestoreAtBoot) — JANGAN ganti ke
  // useState(false): render pertama harus sudah menahan redirect bila
  // ada token tersimpan, karena effect di bawah baru jalan setelahnya.
  const [isRestoring, setIsRestoring] = useState(shouldRestoreAtBoot);
  const attemptedRef = useRef(false);
  useEffect(() => {
    if (attemptedRef.current || resolveApiMode() !== 'real') return;
    attemptedRef.current = true;
    setIsRestoring(true);
    restoreSessionFromStorage(apiClient).then((restored) => {
      if (restored.ok) applySession(restored.user, restored.expiresIn, restored.mustChangePassword);
      setIsRestoring(false);
    });
  }, [applySession]);
  return isRestoring;
}
