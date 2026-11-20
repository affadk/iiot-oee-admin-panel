import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../types/auth';
import { mapLoginForbiddenMessage } from './LoginPage';
import { LAN_GATE_DENY_REASON, resolveEffectiveAccess } from '../../services/api/mode';

// ---------------------------------------------------------------------------
// E29 Batch B (FAT-244, T5): pemetaan error login 403 — bedakan 403 gate LAN
// lokal dari 403 role-gate server.
//
// - Gate lokal: assertLanForMutation / assertLanAccess melempar ApiError 403
//   dengan message persis LAN_GATE_DENY_REASON, sebelum fetch → pesan
//   observasi "jaringan jarak jauh" (tidak berubah).
// - 403 server (role-gate POST /auth/admin/login, Spec 044): pesan server
//   tampil VERBATIM, generik, tanpa tambahan alasan role.
//
// Menggantikan tes E27 mapStationNotFoundMessage (FAT-242, T3): helper itu
// dihapus bersama field Station — 400 STATION_NOT_FOUND tidak lagi mungkin
// dari login admin.
// ---------------------------------------------------------------------------

const OBSERVATION_MSG =
  'Login tidak dapat dilakukan melalui jaringan jarak jauh. Silakan hubungkan ke jaringan lokal pabrik untuk masuk.';

function apiError(code: string, httpStatus: number, message: string): ApiError {
  return new ApiError({ code, message, httpStatus });
}

test('T5: 403 gate LAN lokal → pesan observasi (jaringan jarak jauh)', () => {
  const msg = mapLoginForbiddenMessage(apiError('FORBIDDEN', 403, LAN_GATE_DENY_REASON));
  assert.equal(msg, OBSERVATION_MSG);
});

test('T5: 403 role-gate server → pesan server tampil verbatim, tanpa alasan role tambahan', () => {
  const serverMsg = 'Access denied: operator role OPERATOR is not allowed for admin login';
  const msg = mapLoginForbiddenMessage(apiError('FORBIDDEN', 403, serverMsg));
  assert.equal(msg, serverMsg, 'pesan server tidak diparafrasa');
  assert.ok(!msg!.includes('jaringan jarak jauh'), 'tidak tertukar dengan pesan tunnel');
  assert.ok(!msg!.includes('Mode observasi'), 'tidak tertukar dengan pesan gate lokal');
});

test('T5: 403 server dengan code lain juga passthrough verbatim', () => {
  const serverMsg = 'Forbidden: admin role required';
  assert.equal(
    mapLoginForbiddenMessage(apiError('ROLE_NOT_ALLOWED', 403, serverMsg)),
    serverMsg
  );
});

test('T5: pembeda andal — alasan gate = konstanta tunggal dari mode.ts', () => {
  // Konstanta tidak boleh bergeser diam-diam: bila string ini berubah,
  // pemetaan 403 ikut berubah — tes ini memaksa perubahan disengaja.
  assert.equal(
    LAN_GATE_DENY_REASON,
    'Mode observasi — perubahan dinonaktifkan. Akses penuh tersedia dari LAN pabrik.'
  );
  // Guard memakai alasan yang sama: REMOTE_TUNNEL + private → deny dengan
  // message persis konstanta (env access-mode default = private).
  const snap = process.env.VITE_ACCESS_MODE;
  try {
    delete process.env.VITE_ACCESS_MODE;
    assert.equal(resolveEffectiveAccess('REMOTE_TUNNEL').canMutate, false);
    assert.equal(resolveEffectiveAccess('REMOTE_TUNNEL').reason, LAN_GATE_DENY_REASON);
  } finally {
    if (snap === undefined) delete process.env.VITE_ACCESS_MODE;
    else process.env.VITE_ACCESS_MODE = snap;
  }
});

test('T5: bukan 403 → null (ditangani cabang lain / fallback generik)', () => {
  assert.equal(mapLoginForbiddenMessage(apiError('UNAUTHORIZED', 401, 'Invalid operator credentials')), null);
  assert.equal(mapLoginForbiddenMessage(apiError('RATE_LIMITED', 429, 'Too many attempts')), null);
  assert.equal(mapLoginForbiddenMessage(apiError('VALIDATION_ERROR', 400, 'Bad input')), null);
  assert.equal(mapLoginForbiddenMessage(new Error('Autentikasi gagal.')), null);
  assert.equal(mapLoginForbiddenMessage(null), null);
});
