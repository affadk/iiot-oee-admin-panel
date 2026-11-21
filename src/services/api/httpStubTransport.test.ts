// E32.2 (FAT-283): dipecah dari modeAndTransport.test.ts — transport HTTP
// vs stub server lokal (login, retry 503, IAM/dynsec, provision device).
// Port segar per tes (3001/3003/3004/3005) — pelajaran FAT-280: reuse port
// menimbulkan galat NETWORK palsu dari koneksi keep-alive mati.
// Kode sumber tidak diubah, hanya pemecahan file tes.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';
import { ApiError } from '../../types/auth';

test('HTTP transport vs stub server: login, retry 503, trailing slash, 409 tanpa retry', async () => {
  const seenPaths: string[] = [];
  const seenAuth: Array<string | undefined> = [];
  let devicesCalls = 0;
  let productsCalls = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3001');
    seenPaths.push(url.pathname);
    seenAuth.push(req.headers.authorization);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
      json(200, {
        success: true,
        token: 'stub-jwt',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/devices') {
      devicesCalls += 1;
      if (devicesCalls <= 2) {
        json(503, { error: 'SERVICE_UNAVAILABLE', message: 'Backend sibuk.' });
        return;
      }
      json(200, [{ device_id: 'STM32-OEE-01', mac_address: 'AA:BB:CC:00:00:01', ip_address: null, firmware_version: '1.0' }]);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/operational-events') {
      json(200, {
        data: [{ id: 'ev-1', recordedAt: '2026-11-16T06:00:00.000Z', deviceId: 'STM32-OEE-01', machineId: null, machineName: null, woId: null, eventType: 'DEVICE_ONLINE', triggerSource: 'DEVICE', eventCode: null, snapshotTotalCount: null, snapshotRunSec: null, description: 'Device online', acknowledged: false, acknowledgedAt: null, acknowledgedBy: null, ackNote: null, createdAt: '2026-11-16T06:00:00.000Z' }],
        meta: { count: 1, hasMore: false, nextCursor: null },
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/products') {
      productsCalls += 1;
      json(409, { error: 'PRODUCT_ALREADY_EXISTS', message: 'Product ID sudah ada.' });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3001, resolve));
  try {
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt');
    assert.equal(loggedIn.operator.id, 'ADM-001');

    // GET retry: 503, 503, lalu 200 — header Bearer terkirim
    const devices = await httpApiClient.getDevices();
    assert.equal(devicesCalls, 3);
    assert.equal(devices.length, 1);
    assert.equal(devices[0].device_id, 'STM32-OEE-01');
    assert.equal(devices[0].mac_address, 'AA:BB:CC:00:00:01');
    assert.ok(seenAuth.some((h) => h === 'Bearer stub-jwt'));

    // List operational events tanpa trailing slash (E20 P20.4, R9) + mapper
    // FR-034-01 (acknowledged diturunkan dari acknowledgedAt).
    const eventsPage = await httpApiClient.getOperationalEventsPage({});
    assert.equal(eventsPage.data.length, 1);
    assert.ok(seenPaths.includes('/api/v1/operational-events'));
    assert.equal(seenPaths.includes('/api/v1/operational-events/'), false);
    assert.equal(eventsPage.pagination.has_more, false);
    assert.equal(eventsPage.pagination.total_count, 1);
    assert.equal(eventsPage.data[0].event_type, 'DEVICE_ONLINE');
    assert.equal(eventsPage.data[0].acknowledged, false);
    assert.equal(eventsPage.data[0].description, 'Device online');

    // 409 tidak di-retry (tepat 1 panggilan)
    await assert.rejects(
      () => httpApiClient.createProduct({ product_id: 'PRD-X', name: 'X', ideal_cycle_time_seconds: 30 }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, 'PRODUCT_ALREADY_EXISTS');
        assert.equal(err.httpStatus, 409);
        return true;
      }
    );
    assert.equal(productsCalls, 1);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});

test('E14 Fase 0: K-10 PUT IAM, K-10 PATCH dynsec, K-11 provision, K-03 slash config (stub HTTP)', async () => {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = 'http://localhost:3003/api/v1';
  const seen: Array<{ method: string | undefined; path: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3003');
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      } catch {
        body = undefined;
      }
      seen.push({ method: req.method, path: url.pathname, body });
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        json(200, {
          success: true,
          token: 'stub-jwt',
          expires_in: 900,
          operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
        });
        return;
      }
      if (req.method === 'PUT' && url.pathname === '/api/v1/access-control/roles/ROLE-1') {
        json(200, { id: 'ROLE-1', name: 'OPERATOR' });
        return;
      }
      if (req.method === 'PUT' && url.pathname === '/api/v1/access-control/policies/POL-1') {
        json(200, { id: 'POL-1', roleId: 'role-operator', roleName: 'OPERATOR', subjectMatch: 'role:OPERATOR', action: 'read', resourceType: 'telemetry', resourcePattern: 'org:line:01', effect: 'ALLOW', enabled: false, createdAt: '2026-01-01T00:00:00Z' });
        return;
      }
      if (req.method === 'PATCH' && url.pathname === '/api/v1/mqtt/dynamic-security/clients/user1/password') {
        json(200, { success: true });
        return;
      }
      if (req.method === 'PATCH' && url.pathname === '/api/v1/mqtt/dynamic-security/clients/user1/enable') {
        // E23 Batch 1 (FAT-178, N-9): spec live — PATCH .../enable hanya
        // `{success}`; entitas penuh dibaca ulang via GET di bawah.
        json(200, { success: true });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/mqtt/dynamic-security/clients/user1') {
        json(200, { username: 'user1', enabled: false });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/mqtt/dynamic-security/clients') {
        json(200, { client: { username: 'user2', enabled: true }, generatedPassword: 'dynsec_once' });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/mqtt/configuration') {
        json(200, {});
        return;
      }
      json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${req.method} ${url.pathname}` });
    });
  });
  await new Promise<void>((resolve) => server.listen(3003, resolve));
  try {
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt');

    const role = await httpApiClient.updateIamRole('ROLE-1', { description: 'Operator line' });
    assert.equal(role.id, 'ROLE-1');
    const pol = await httpApiClient.updateIamPolicy('POL-1', { enabled: false });
    assert.equal(pol.id, 'POL-1');

    assert.equal((await httpApiClient.rotateMqttClientPassword('user1', 'NewPass1!')).success, true);
    const toggled = await httpApiClient.toggleMqttClient('user1', false);
    assert.equal(toggled.enabled, false);

    const manual = await httpApiClient.createMqttClient({ username: 'user2', roles: ['edge_publisher'] });
    assert.equal(manual.client.username, 'user2');

    await httpApiClient.getBrokerConfig();

    const find = (method: string, path: string) => seen.find((s) => s.method === method && s.path === path);
    assert.ok(find('PUT', '/api/v1/access-control/roles/ROLE-1'), 'updateIamRole memakai PUT');
    assert.ok(find('PUT', '/api/v1/access-control/policies/POL-1'), 'updateIamPolicy memakai PUT');
    assert.ok(find('PATCH', '/api/v1/mqtt/dynamic-security/clients/user1/password'), 'rotate memakai PATCH');
    const tog = find('PATCH', '/api/v1/mqtt/dynamic-security/clients/user1/enable');
    assert.ok(tog, 'toggle memakai PATCH');
    assert.deepEqual(tog.body, { enabled: false });
    assert.ok(find('POST', '/api/v1/mqtt/dynamic-security/clients'), 'create roles tetap memakai /clients');
    assert.ok(find('GET', '/api/v1/mqtt/configuration'), 'GET config tanpa trailing slash (spec, E23 Batch 4 N-39)');
    // Tidak ada lagi method lama: POST rotate/toggle, PATCH IAM.
    assert.equal(seen.filter((s) => s.method === 'POST' && s.path.endsWith('/password')).length, 0);
    assert.equal(seen.filter((s) => s.method === 'POST' && s.path.endsWith('/enable')).length, 0);
    assert.equal(seen.filter((s) => s.method === 'PATCH' && s.path.startsWith('/api/v1/access-control/')).length, 0);
  } finally {
    httpApiClient.setSessionActive(false, null);
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});

test('E15 K-05: 4 sub-operasi dynsec mengirim objek tunggal (stub HTTP)', async () => {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = 'http://localhost:3004/api/v1';
  const seen: Array<{ method: string | undefined; path: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3004');
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      } catch {
        body = undefined;
      }
      seen.push({ method: req.method, path: url.pathname, body });
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        json(200, {
          success: true,
          token: 'stub-jwt',
          expires_in: 900,
          operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
        });
        return;
      }
      // E23 Batch 1 (FAT-178, N-9): spec live — keempat sub-op hanya
      // `{success}`; entitas penuh dibaca ulang via GET di bawah.
      if (req.method === 'POST' && url.pathname === '/api/v1/mqtt/dynamic-security/clients/user1/roles') {
        json(201, { success: true });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/mqtt/dynamic-security/clients/user1') {
        json(200, { username: 'user1', enabled: true, roles: ['edge_publisher'] });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/mqtt/dynamic-security/roles/role1/acls') {
        json(201, { success: true });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/mqtt/dynamic-security/roles/role1') {
        json(200, { rolename: 'role1', acls: [{ acltype: 'publishClientSend', topic: 'test/#', allow: true }] });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/mqtt/dynamic-security/groups/g1/clients') {
        json(201, { success: true });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/mqtt/dynamic-security/groups/g1/roles') {
        json(201, { success: true });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/mqtt/dynamic-security/groups/g1') {
        json(200, { groupname: 'g1', clients: ['edge1'], roles: ['edge_publisher'] });
        return;
      }
      json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${req.method} ${url.pathname}` });
    });
  });
  await new Promise<void>((resolve) => server.listen(3004, resolve));
  try {
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt');

    await httpApiClient.addMqttClientRole('user1', 'edge_publisher', 1);
    await httpApiClient.addMqttRoleAcl('role1', { acltype: 'publishClientSend', topic: 'test/#', allow: true });
    await httpApiClient.addMqttGroupClient('g1', 'edge1');
    await httpApiClient.addMqttGroupRole('g1', 'edge_publisher');

    const find = (path: string) => seen.find((s) => s.method === 'POST' && s.path === path);
    const roleReq = find('/api/v1/mqtt/dynamic-security/clients/user1/roles');
    assert.deepEqual(roleReq?.body, { rolename: 'edge_publisher', priority: 1 });
    const aclReq = find('/api/v1/mqtt/dynamic-security/roles/role1/acls');
    assert.deepEqual(aclReq?.body, { acltype: 'publishClientSend', topic: 'test/#', allow: true });
    const grpClientReq = find('/api/v1/mqtt/dynamic-security/groups/g1/clients');
    assert.deepEqual(grpClientReq?.body, { username: 'edge1' });
    const grpRoleReq = find('/api/v1/mqtt/dynamic-security/groups/g1/roles');
    assert.deepEqual(grpRoleReq?.body, { rolename: 'edge_publisher' });
  } finally {
    httpApiClient.setSessionActive(false, null);
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});


test('E20 P20.2: provision/revoke/rotasi/health device via HTTP (stub, port 3005)', async () => {
  // Port 3005: 3001/3002/3003/3004 sudah dipakai stub lain — undici keep-alive
  // rusak bila port dipakai ulang; VITE_API_URL di-set/restore di try/finally.
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = 'http://localhost:3005/api/v1';
  const seen: Array<{ method: string | undefined; path: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3005');
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      } catch {
        body = undefined;
      }
      seen.push({ method: req.method, path: url.pathname, body });
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        json(200, {
          success: true,
          token: 'stub-jwt',
          expires_in: 900,
          operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/devices/provision') {
        json(201, {
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
          credential: { username: 'STM32-OEE-06', password: 'Aa1-'.repeat(8), clientId: 'STM32-OEE-06', topicPrefix: 'oee/device' },
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/devices/STM32-OEE-06/revoke') {
        json(200, {
          device: {
            deviceId: 'STM32-OEE-06',
            model: 'STM32H723-W5500',
            macAddress: '',
            ipAddress: null,
            firmwareVersion: null,
            isOnline: false,
            lastSeenAt: null,
            createdAt: '2026-11-19T01:00:00.000Z',
            enrollmentState: 'REVOKED',
            provisionedAt: '2026-11-19T01:00:00.000Z',
            credentialRotatedAt: null,
            boundMachine: null,
          },
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/devices/STM32-OEE-06/credentials') {
        json(200, {
          credential: { username: 'STM32-OEE-06', password: 'Bb2-'.repeat(8), clientId: 'STM32-OEE-06', topicPrefix: 'oee/device' },
          forced: true,
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/devices/STM32-OEE-06/health') {
        json(200, {
          deviceId: 'STM32-OEE-06',
          timestamp: null,
          heapFree: 0,
          tasksHealthy: 0,
          tasksTotal: 0,
          ageSec: 999999,
          eventFlags: [],
          staleCount: 0,
          staleTasks: [],
        });
        return;
      }
      json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${req.method} ${url.pathname}` });
    });
  });
  await new Promise<void>((resolve) => server.listen(3005, resolve));
  try {
    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt');

    const provisioned = await httpApiClient.provisionDevice({ deviceId: 'STM32-OEE-06', machineId: 'CNC-MILLING-02', model: 'STM32H723-W5500' });
    assert.equal(provisioned.device.device_id, 'STM32-OEE-06');
    assert.equal(provisioned.device.enrollmentState, 'PROVISIONED');
    assert.equal(provisioned.device.mac_address, '');
    assert.equal(provisioned.device.bound_machine_id, 'CNC-MILLING-02');
    assert.equal(provisioned.device.boundMachine?.machine_id, 'CNC-MILLING-02');
    assert.equal(provisioned.device.boundMachine?.name, 'Lathe CNC #2');
    assert.equal(provisioned.credential.username, 'STM32-OEE-06');
    assert.equal(provisioned.credential.password.length, 32);
    assert.equal(provisioned.credential.topicPrefix, 'oee/device');

    const rotated = await httpApiClient.rotateDeviceCredentials('STM32-OEE-06', { force: true, reason: 'Rotasi terjadwal' });
    assert.equal(rotated.forced, true);
    assert.equal(rotated.credential.username, 'STM32-OEE-06');
    assert.equal(rotated.credential.password.length, 32);

    const revoked = await httpApiClient.revokeDevice('STM32-OEE-06', 'Perangkat diganti');
    assert.equal(revoked.device_id, 'STM32-OEE-06');
    assert.equal(revoked.enrollmentState, 'REVOKED');

    const health = await httpApiClient.getDeviceHealth('STM32-OEE-06');
    assert.equal(health.ageSec, 999999);
    assert.equal(health.heapFree, 0);

    const find = (method: string, path: string) => seen.find((s) => s.method === method && s.path === path);
    assert.deepEqual(find('POST', '/api/v1/devices/provision')?.body, { deviceId: 'STM32-OEE-06', machineId: 'CNC-MILLING-02', model: 'STM32H723-W5500' });
    assert.deepEqual(find('POST', '/api/v1/devices/STM32-OEE-06/revoke')?.body, { reason: 'Perangkat diganti' });
    assert.deepEqual(find('POST', '/api/v1/devices/STM32-OEE-06/credentials')?.body, { force: true, reason: 'Rotasi terjadwal' });
    // Rute lama tidak pernah dipanggil.
    assert.equal(seen.filter((s) => s.path.includes('/mqtt/dynamic-security/clients/provision')).length, 0);
    assert.equal(seen.filter((s) => s.path.includes('telemetry+state') || s.path.includes('telemetry')).length, 0);
  } finally {
    httpApiClient.setSessionActive(false, null);
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});
