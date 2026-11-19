import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../types/auth';
import { mapStationNotFoundMessage } from './LoginPage';

// ---------------------------------------------------------------------------
// E27 (FAT-235, LOGIN): pemetaan error login 400 STATION_NOT_FOUND.
// LoginPage.handleSubmit memakai helper ini sebelum fallback generik:
// pesan "Stasiun tidak terdaftar" (Indonesia), bukan pesan mentah server
// ("station_id is not a registered station"). Periksa httpStatus DAN code.
// ---------------------------------------------------------------------------

function apiError(code: string, httpStatus: number, message = 'station_id is not a registered station'): ApiError {
  return new ApiError({ code, message, httpStatus });
}

test('400 STATION_NOT_FOUND → pesan "Stasiun tidak terdaftar"', () => {
  const msg = mapStationNotFoundMessage(apiError('STATION_NOT_FOUND', 400));
  assert.ok(msg !== null, 'pesan dipetakan');
  assert.ok(msg!.includes('Stasiun tidak terdaftar'), 'pesan berbahasa Indonesia');
  assert.ok(!msg!.includes('station_id is not a registered station'), 'pesan mentah server tidak dipakai');
});

test('error lain tidak berubah (null → fallback generik)', () => {
  // 400 dengan code lain tetap memakai pesan generik/server.
  assert.equal(mapStationNotFoundMessage(apiError('VALIDATION_ERROR', 400)), null);
  // code sama tapi status bukan 400 → bukan kasus ini.
  assert.equal(mapStationNotFoundMessage(apiError('STATION_NOT_FOUND', 401)), null);
  // 403/429 ditangani cabang lain di handleSubmit, bukan helper ini.
  assert.equal(mapStationNotFoundMessage(apiError('FORBIDDEN', 403)), null);
  assert.equal(mapStationNotFoundMessage(apiError('RATE_LIMITED', 429)), null);
  // Bukan ApiError sama sekali.
  assert.equal(mapStationNotFoundMessage(new Error('Autentikasi gagal.')), null);
  assert.equal(mapStationNotFoundMessage(null), null);
});
