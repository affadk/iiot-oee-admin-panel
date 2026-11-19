import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStationId, validateStationInput } from './stationValidation';
import { mapStation, mapDevice } from '../../services/api/http/mappers/assets';
import { deriveUnknownStations, readStationLabel } from './hooks/useUnknownStations';
import { httpStations, resetDemoStationsForTest } from '../../services/api/http/stations';
import { apiClient } from '../../services/api/client';
import { ApiError } from '../../types/auth';
import { OperationalEvent } from '../../types/monitoring';

// ---------------------------------------------------------------------------
// Validasi device_id stasiun (E27, FAT-232): trim, 1..64, tanpa pola STM32.
// ---------------------------------------------------------------------------

test('validateStationId menolak kosong / hanya spasi', () => {
  assert.equal(validateStationId(''), 'Station / Device ID wajib diisi.');
  assert.equal(validateStationId('   '), 'Station / Device ID wajib diisi.');
});

test('validateStationId menolak >64 karakter', () => {
  assert.equal(validateStationId('A'.repeat(65)), 'Station / Device ID maksimal 64 karakter.');
});

test('validateStationId menerima 1..64 karakter dan mentoleransi trim', () => {
  assert.equal(validateStationId('A'), null);
  assert.equal(validateStationId('A'.repeat(64)), null);
  assert.equal(validateStationId('  ADMIN-CONSOLE-01  '), null);
  assert.equal(validateStationId('kiosk-lantai-2'), null);
});

test('validateStationInput (create) menolak id kosong, IP buruk, firmware >50', () => {
  const errs = validateStationInput({
    deviceId: '',
    ipAddress: '999.999.999.999',
    firmwareVersion: 'v'.repeat(51),
    isCreate: true,
  });
  assert.ok(errs.deviceId);
  assert.ok(errs.ipAddress);
  assert.ok(errs.firmwareVersion);
});

test('validateStationInput (create) menerima input stasiun non-STM32 yang valid', () => {
  const errs = validateStationInput({
    deviceId: 'ADMIN-CONSOLE-01',
    macAddress: '00:08:DC:55:01:0A',
    ipAddress: '192.168.10.50',
    firmwareVersion: 'v1.0.0',
    isCreate: true,
  });
  assert.deepEqual(errs, {});
});

// ---------------------------------------------------------------------------
// mapStation() — toleran terhadap deviceId non-STM32.
// ---------------------------------------------------------------------------

function deviceResponse(deviceId: string, overrides: Record<string, unknown> = {}) {
  return {
    deviceId,
    model: 'Kiosk',
    macAddress: '',
    ipAddress: '192.168.10.50',
    firmwareVersion: 'v1.0.0',
    isOnline: true,
    lastSeenAt: '2026-11-20T00:00:00.000Z',
    createdAt: '2026-11-19T10:00:00.000Z',
    enrollmentState: 'PROVISIONED',
    provisionedAt: '2026-11-19T10:00:00.000Z',
    credentialRotatedAt: null,
    boundMachine: null,
    ...overrides,
  };
}

test('mapStation mem-parse deviceId non-STM32 (ADMIN-CONSOLE-01)', () => {
  const st = mapStation(deviceResponse('ADMIN-CONSOLE-01'));
  assert.equal(st.device_id, 'ADMIN-CONSOLE-01');
  assert.equal(st.enrollmentState, 'PROVISIONED');
  assert.equal(st.ip_address, '192.168.10.50');
  assert.equal(st.online, true);
  assert.equal(st.created_at, '2026-11-19T10:00:00.000Z');
});

test('mapStation mem-parse device STM32 juga (registry yang sama)', () => {
  const st = mapStation(deviceResponse('STM32-OEE-01', { enrollmentState: 'ACTIVE', isOnline: false }));
  assert.equal(st.device_id, 'STM32-OEE-01');
  assert.equal(st.enrollmentState, 'ACTIVE');
  assert.equal(st.online, false);
});

test('mapStation: enrollmentState tak dikenal default ACTIVE; createdAt kosong jadi epoch', () => {
  const st = mapStation(deviceResponse('KIOSK-1', { enrollmentState: 'BOGUS', createdAt: undefined }));
  assert.equal(st.enrollmentState, 'ACTIVE');
  assert.equal(st.created_at, new Date(0).toISOString());
});

test('mapStation menolak device_id kosong / >64 (INVALID_RESPONSE)', () => {
  for (const bad of ['', 'X'.repeat(65)]) {
    assert.throws(
      () => mapStation(deviceResponse(bad)),
      (err: unknown) => err instanceof ApiError && err.code === 'INVALID_RESPONSE',
    );
  }
});

test('mapDevice menolak deviceId non-STM32 — alasan mapStation harus terpisah', () => {
  assert.throws(
    () => mapDevice(deviceResponse('ADMIN-CONSOLE-01')),
    (err: unknown) => err instanceof ApiError && err.code === 'INVALID_RESPONSE',
  );
});

// ---------------------------------------------------------------------------
// Derivasi T3 (FAT-234): distinct station_label null-device.
// ---------------------------------------------------------------------------

function opEvent(partial: Record<string, unknown>): OperationalEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    recorded_at: '2026-11-20T00:40:00.000Z',
    device_id: null,
    machine_id: null,
    machine_name: null,
    wo_id: null,
    event_type: 'SECURITY_REJECTION',
    trigger_source: 'AUTH',
    event_code: null,
    snapshot_total_count: null,
    snapshot_run_sec: null,
    description: 'station_id is not a registered station',
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    ack_note: null,
    created_at: '2026-11-20T00:40:00.000Z',
    ...partial,
  } as unknown as OperationalEvent;
}

test('readStationLabel membaca snake_case dan camelCase, null bila absen', () => {
  assert.equal(readStationLabel(opEvent({ station_label: 'STATION-UNKNOWN-XYZ' })), 'STATION-UNKNOWN-XYZ');
  assert.equal(readStationLabel(opEvent({ stationLabel: 'KIOSK-9' })), 'KIOSK-9');
  assert.equal(readStationLabel(opEvent({})), null);
});

test('deriveUnknownStations: distinct label trim, hitung kejadian, waktu terakhir', () => {
  const events = [
    opEvent({ station_label: 'STATION-UNKNOWN-XYZ', recorded_at: '2026-11-20T00:40:00.000Z' }),
    opEvent({ station_label: '  STATION-UNKNOWN-XYZ ', recorded_at: '2026-11-20T00:45:00.000Z' }),
    opEvent({ station_label: 'KIOSK-2', recorded_at: '2026-11-20T00:41:00.000Z' }),
  ];
  const out = deriveUnknownStations(events, []);
  assert.equal(out.length, 2);
  assert.equal(out[0].label, 'STATION-UNKNOWN-XYZ');
  assert.equal(out[0].count, 2);
  assert.equal(out[0].lastSeenAt, '2026-11-20T00:45:00.000Z');
  assert.equal(out[1].label, 'KIOSK-2');
  assert.equal(out[1].count, 1);
});

test('deriveUnknownStations mengecualikan device terdaftar, event lain, dan device_id terisi', () => {
  const events = [
    opEvent({ station_label: 'ADMIN-CONSOLE-01' }),
    opEvent({ station_label: 'STATION-UNKNOWN-XYZ', device_id: 'STM32-OEE-01' }),
    opEvent({ station_label: 'STATION-UNKNOWN-XYZ', event_type: 'MACHINE_START' }),
    opEvent({ station_label: '   ' }),
    opEvent({ station_label: null }),
  ];
  const out = deriveUnknownStations(events, ['ADMIN-CONSOLE-01']);
  assert.deepEqual(out, []);
});

test('deriveUnknownStations case-sensitive: STATION-X dan station-x berbeda', () => {
  const events = [
    opEvent({ station_label: 'STATION-X' }),
    opEvent({ station_label: 'station-x' }),
  ];
  const out = deriveUnknownStations(events, []);
  assert.equal(out.length, 2);
});

// ---------------------------------------------------------------------------
// Service stasiun jalur demo (tanpa HTTP): CRUD ID non-STM32.
// ---------------------------------------------------------------------------

function asAdmin() {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);
}

test('httpStations demo: daftar + register + revoke + update + delete ID non-STM32', async () => {
  asAdmin();
  resetDemoStationsForTest();

  const before = await httpStations.getStations();
  assert.ok(before.length >= 1);
  assert.ok(before.every((s) => typeof s.device_id === 'string' && s.device_id.length > 0));

  const created = await httpStations.registerStation({
    device_id: 'ADMIN-CONSOLE-01',
    ip_address: '192.168.10.50',
    firmware_version: 'v1.0.0',
  });
  assert.equal(created.device_id, 'ADMIN-CONSOLE-01');
  assert.equal(created.enrollmentState, 'PROVISIONED');

  const afterRegister = await httpStations.getStations();
  assert.ok(afterRegister.some((s) => s.device_id === 'ADMIN-CONSOLE-01'));

  await assert.rejects(
    httpStations.registerStation({ device_id: 'ADMIN-CONSOLE-01' }),
    (err: unknown) => err instanceof ApiError && err.code === 'DEVICE_ALREADY_REGISTERED' && err.httpStatus === 409,
  );

  const updated = await httpStations.updateStation('ADMIN-CONSOLE-01', { ip_address: '192.168.10.51' });
  assert.equal(updated.ip_address, '192.168.10.51');
  assert.equal(updated.firmware_version, 'v1.0.0');

  const revoked = await httpStations.revokeStation('ADMIN-CONSOLE-01', 'kiosk tidak dipakai lagi');
  assert.equal(revoked.enrollmentState, 'REVOKED');
  await assert.rejects(
    httpStations.revokeStation('ADMIN-CONSOLE-01', 'lagi'),
    (err: unknown) => err instanceof ApiError && err.code === 'DEVICE_ALREADY_REVOKED' && err.httpStatus === 409,
  );

  await httpStations.deleteStation('ADMIN-CONSOLE-01');
  const afterDelete = await httpStations.getStations();
  assert.ok(!afterDelete.some((s) => s.device_id === 'ADMIN-CONSOLE-01'));

  await assert.rejects(
    httpStations.deleteStation('ADMIN-CONSOLE-01'),
    (err: unknown) => err instanceof ApiError && err.code === 'DEVICE_NOT_FOUND' && err.httpStatus === 404,
  );
});
