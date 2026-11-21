// E32.3 (FAT-284): dipecah dari contractAlignment.test.ts — registry endpoint: prefix /api/v1/ + pola terlarang.
// Kode sumber tidak diubah, hanya pemecahan file tes per domain.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ENDPOINTS,
  AdminEndpointKey,
  FORBIDDEN_ENDPOINT_PATTERNS,
  isValidEndpointPrefix,
} from './endpoints';

test('All ADMIN_ENDPOINTS use /api/v1/ except /health and /ws/telemetry and exclude forbidden HMI/legacy paths', () => {
  for (const def of Object.values(ADMIN_ENDPOINTS)) {
    const samplePath = def.buildPath('id-1', 'id-2');
    assert.equal(
      isValidEndpointPrefix(samplePath),
      true,
      `Endpoint ${def.key} resolved to invalid prefix "${samplePath}"`
    );
    if (def.key === 'HEALTH') {
      assert.equal(samplePath, '/health');
    } else if (def.key === 'HEALTH_DETAIL') {
      assert.equal(samplePath, '/health/detail');
    } else if (def.key === 'WS_TELEMETRY') {
      assert.equal(samplePath, '/ws/telemetry');
    } else {
      assert.ok(samplePath.startsWith('/api/v1/'), `${def.key} must start with /api/v1/`);
    }

    for (const forbidden of FORBIDDEN_ENDPOINT_PATTERNS) {
      assert.equal(
        samplePath.includes(forbidden),
        false,
        `Endpoint ${def.key} contains forbidden path "${forbidden}"`
      );
    }
  }
});
