import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, store } from '../../services/api/client';
import { ApiError } from '../../types/auth';
import { mapDevice } from '../../services/api/http/mappers/assets';

function snapshotStore() {
  return {
    machines: store.machines.map((m) => ({ ...m })),
    devices: store.devices.map((d) => ({ ...d })),
    mqttClients: store.mqttClients.map((c) => ({ ...c })),
    deviceHistoryIds: new Set(store.deviceHistoryIds),
    workOrders: store.workOrders.map((w) => ({ ...w })),
    role: apiClient.getUserRole(),
    network: apiClient.getNetworkMode(),
    isAuthenticated: store.isAuthenticated,
    authToken: store.authToken,
  };
}

function restoreStore(snap: ReturnType<typeof snapshotStore>) {
  store.machines = snap.machines;
  store.devices = snap.devices;
  store.mqttClients = snap.mqttClients;
  store.deviceHistoryIds = snap.deviceHistoryIds;
  store.workOrders = snap.workOrders;
  apiClient.setNetworkMode(snap.network);
  apiClient.setUserRole(snap.role);
  store.isAuthenticated = snap.isAuthenticated;
  store.authToken = snap.authToken;
}

function asAdmin() {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);
}

async function expectApiError(promise: Promise<unknown>, code: string, httpStatus: number) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${String(err)}`);
    assert.equal(err.code, code);
    assert.equal(err.httpStatus, httpStatus);
    return true;
  });
}

test('E20 P20.2: provision sukses — PROVISIONED, MAC kosong, kredensial 32 char sekali tampil, client broker dibuat', async () => {
  const snap = snapshotStore();
  try {
    asAdmin();
    const result = await apiClient.provisionDevice({ deviceId: 'STM32-OEE-90', model: 'STM32H723-W5500' });
    assert.equal(result.device.device_id, 'STM32-OEE-90');
    assert.equal(result.device.enrollmentState, 'PROVISIONED');
    assert.equal(result.device.mac_address, '');
    assert.equal(result.device.online, false);
    assert.ok(result.device.provisionedAt);
    assert.equal(result.device.credentialRotatedAt, null);
    assert.equal(result.credential.username, 'STM32-OEE-90');
    assert.equal(result.credential.password.length, 32);
    assert.match(result.credential.password, /^[A-Za-z0-9-_]{32}$/);
    assert.equal(result.credential.clientId, 'STM32-OEE-90');
    assert.equal(result.credential.topicPrefix, 'oee/device');
    const client = store.mqttClients.find((c) => c.username === 'STM32-OEE-90');
    assert.ok(client, 'identitas broker dibuat');
    assert.deepEqual(client.roles, ['device-STM32-OEE-90']);
  } finally {
    restoreStore(snap);
  }
});

test('E20 P20.2: provision dengan machineId langsung bind 1:1', async () => {
  const snap = snapshotStore();
  try {
    asAdmin();
    const result = await apiClient.provisionDevice({ deviceId: 'STM32-OEE-91', machineId: 'CNC-GRIND-05' });
    assert.equal(result.device.bound_machine_id, 'CNC-GRIND-05');
    assert.equal(result.device.boundMachine?.machine_id, 'CNC-GRIND-05');
    assert.equal(result.device.boundMachine?.name, 'Surface Grinder Echo');
    const machine = store.machines.find((m) => m.machine_id === 'CNC-GRIND-05');
    assert.equal(machine?.bound_device_id, 'STM32-OEE-91');
  } finally {
    restoreStore(snap);
  }
});

test('E20 P20.2: guard provision — duplikat, mesin tak dikenal, mesin sudah terikat, id berhistori', async () => {
  const snap = snapshotStore();
  try {
    asAdmin();
    await expectApiError(
      apiClient.provisionDevice({ deviceId: 'STM32-OEE-01' }),
      'DEVICE_ALREADY_REGISTERED',
      409,
    );
    await expectApiError(
      apiClient.provisionDevice({ deviceId: 'STM32-OEE-92', machineId: 'CNC-TIDAK-ADA' }),
      'MACHINE_NOT_FOUND',
      404,
    );
    await expectApiError(
      apiClient.provisionDevice({ deviceId: 'STM32-OEE-92', machineId: 'CNC-MILLING-01' }),
      'MACHINE_ALREADY_BOUND',
      409,
    );
    await expectApiError(
      apiClient.provisionDevice({ deviceId: 'BAD-ID' }),
      'INVALID_DEVICE_ID',
      400,
    );
    // Id yang pernah terdaftar lalu dihapus tidak dapat di-provision ulang.
    await apiClient.registerDevice({
      device_id: 'STM32-OEE-93',
      mac_address: '00:08:DC:55:93:93',
    });
    await apiClient.deleteDevice('STM32-OEE-93');
    await expectApiError(
      apiClient.provisionDevice({ deviceId: 'STM32-OEE-93' }),
      'DEVICE_ID_HAS_HISTORY',
      409,
    );
  } finally {
    restoreStore(snap);
  }
});

test('E20 P20.2: revoke — selalu diizinkan, kedua kali 409 DEVICE_ALREADY_REVOKED, reason wajib', async () => {
  const snap = snapshotStore();
  try {
    asAdmin();
    await apiClient.provisionDevice({ deviceId: 'STM32-OEE-94' });
    await expectApiError(apiClient.revokeDevice('STM32-OEE-94', ''), 'VALIDATION_ERROR', 400);
    const revoked = await apiClient.revokeDevice('STM32-OEE-94', 'Perangkat diganti');
    assert.equal(revoked.enrollmentState, 'REVOKED');
    assert.equal(store.mqttClients.some((c) => c.username === 'STM32-OEE-94'), false);
    await expectApiError(
      apiClient.revokeDevice('STM32-OEE-94', 'Sekali lagi'),
      'DEVICE_ALREADY_REVOKED',
      409,
    );
  } finally {
    restoreStore(snap);
  }
});

test('E20 P20.2: rotasi — guard produksi 409 tanpa force, sukses dengan force; revoked 409 DEVICE_REVOKED', async () => {
  const snap = snapshotStore();
  try {
    asAdmin();
    // STM32-OEE-01 online + WO-2026-101 ACTIVE pada CNC-MILLING-01.
    await expectApiError(
      apiClient.rotateDeviceCredentials('STM32-OEE-01', { force: false, reason: 'Rotasi rutin' }),
      'DEVICE_IN_PRODUCTION',
      409,
    );
    const forced = await apiClient.rotateDeviceCredentials('STM32-OEE-01', { force: true, reason: 'Rotasi darurat' });
    assert.equal(forced.forced, true);
    assert.equal(forced.credential.password.length, 32);
    const dev01 = await apiClient.getDeviceById('STM32-OEE-01');
    assert.ok(dev01.credentialRotatedAt);

    await apiClient.provisionDevice({ deviceId: 'STM32-OEE-95' });
    await apiClient.revokeDevice('STM32-OEE-95', 'Diganti');
    await expectApiError(
      apiClient.rotateDeviceCredentials('STM32-OEE-95', { force: false, reason: 'Rotasi' }),
      'DEVICE_REVOKED',
      409,
    );
  } finally {
    restoreStore(snap);
  }
});

test('E20 P20.2: health — device tak dikenal 404; offline = cache miss ageSec 999999 + field nol', async () => {
  const snap = snapshotStore();
  try {
    asAdmin();
    await expectApiError(apiClient.getDeviceHealth('STM32-TIDAK-ADA'), 'DEVICE_NOT_FOUND', 404);
    const offline = await apiClient.getDeviceHealth('STM32-OEE-04');
    assert.equal(offline.ageSec, 999999);
    assert.equal(offline.heapFree, 0);
    assert.equal(offline.tasksHealthy, 0);
    assert.deepEqual(offline.staleTasks, []);
  } finally {
    restoreStore(snap);
  }
});

test('E20 P20.2: mapDevice — boundMachine server {machineId, machineName} tidak melempar; MAC "" lolos', () => {
  const parsed = mapDevice({
    deviceId: 'STM32-OEE-06',
    model: 'STM32H723-W5500',
    macAddress: '',
    ipAddress: null,
    firmwareVersion: null,
    isOnline: false,
    lastSeenAt: null,
    createdAt: '2026-11-19T01:00:00.000Z',
    enrollmentState: 'PROVISIONED',
    provisionedAt: '2026-11-19T01:00:00.000Z',
    credentialRotatedAt: null,
    boundMachine: { machineId: 'CNC-MILLING-02', machineName: 'Lathe CNC #2' },
  });
  assert.equal(parsed.device_id, 'STM32-OEE-06');
  assert.equal(parsed.mac_address, '');
  assert.equal(parsed.enrollmentState, 'PROVISIONED');
  assert.equal(parsed.bound_machine_id, 'CNC-MILLING-02');
  assert.equal(parsed.boundMachine?.machine_id, 'CNC-MILLING-02');
  assert.equal(parsed.boundMachine?.name, 'Lathe CNC #2');
});

test('E20 P20.2 (D10): kode guard demo register/delete mengikuti dokumen', async () => {
  const snap = snapshotStore();
  try {
    asAdmin();
    await expectApiError(
      apiClient.registerDevice({ device_id: 'STM32-OEE-01', mac_address: '00:08:DC:55:01:01' }),
      'DEVICE_ALREADY_REGISTERED',
      409,
    );
    // Delete device terikat WO ACTIVE → 409 CONFLICT (bukan MACHINE_HAS_ACTIVE_WO).
    await assert.rejects(
      apiClient.deleteDevice('STM32-OEE-01'),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, 'CONFLICT');
        assert.equal(err.httpStatus, 409);
        assert.equal(err.activeWoId, 'WO-2026-101');
        return true;
      },
    );
  } finally {
    restoreStore(snap);
  }
});
