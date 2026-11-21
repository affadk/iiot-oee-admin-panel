// E32.3 (FAT-284): dipecah dari contractAlignment.test.ts — proyeksi kapabilitas /auth/me + normalisasi skema AuthMe.
// Kode sumber tidak diubah, hanya pemecahan file tes per domain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthMeResponseSchema } from './schemas';
import { apiClient } from './client';

test('GET /api/v1/auth/me returns structured capability projection for ADMIN vs LINE-scoped OPERATOR and AuthMeResponseSchema normalizes array/record formats', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setSessionActive(true);

  apiClient.setUserRole('ADMIN');
  const adminMe = await apiClient.getAuthMe();
  assert.equal(adminMe.primaryRole, 'ADMIN');
  assert.equal(adminMe.capabilities['access_control.manage'], 'allow');
  assert.equal(adminMe.capabilities['mqtt.dynsec.read'], 'allow');
  assert.equal(adminMe.capabilities['mqtt.config.read_raw'], 'allow');
  assert.equal(adminMe.capabilities['work_order.cancel'], 'unknown');

  apiClient.setUserRole('OPERATOR');
  const opMe = await apiClient.getAuthMe();
  assert.equal(opMe.primaryRole, 'OPERATOR');
  assert.equal(opMe.capabilities['access_control.manage'], 'deny');
  assert.equal(opMe.capabilities['mqtt.dynsec.read'], 'deny');
  assert.equal(opMe.capabilities['telemetry.refresh'], 'deny');
  assert.equal(opMe.capabilities['downtime_event.label'], 'unknown');

  // Verify Zod normalization of array capabilities [{ key, state }] -> Record<string, state>
  const parsedFromArray = AuthMeResponseSchema.parse({
    operator: { operator_id: 'SUP-042', name: 'Budi Santoso', role: 'SUPERVISOR' },
    primaryRole: 'SUPERVISOR',
    effectiveRoles: [{ roleName: 'SUPERVISOR', scopeType: 'ORGANIZATION', scopeId: null }],
    authzVersion: '4',
    mode: 'enforce',
    capabilities: [
      { key: 'telemetry.refresh', state: 'allow' },
      { key: 'access_control.manage', state: 'deny' },
    ],
  });
  assert.equal(parsedFromArray.authzVersion, 4);
  assert.equal(parsedFromArray.capabilities['telemetry.refresh'], 'allow');
  assert.equal(parsedFromArray.capabilities['access_control.manage'], 'deny');

  apiClient.setUserRole('ADMIN');
});
