// E32.3 (FAT-284): dipecah dari e23-batch3.test.ts — config GET + raw (N-29/N-30, FAT-198/FAT-199).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport berperilaku benar terhadap bentuk
// itu. Port segar per tes (3047–3048) — pelajaran FAT-280: reuse port
// menimbulkan galat NETWORK palsu. Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';

const LOGIN_BODY = {
  success: true,
  token: 'stub-token',
  expires_in: 900,
  operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
};

type SeenReq = { method: string | undefined; path: string; url: string; body: unknown };

function startStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown; raw?: string; contentType?: string } | null,
) {
  const seen: SeenReq[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      } catch {
        body = undefined;
      }
      seen.push({ method: req.method, path: url.pathname, url: url.pathname + url.search, body });
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(JSON.stringify(LOGIN_BODY));
        return;
      }
      const out = handler(req, url, body);
      if (out) {
        if (out.raw !== undefined) {
          res.writeHead(out.status, { 'Content-Type': out.contentType ?? 'text/csv', Connection: 'close' });
          res.end(out.raw);
          return;
        }
        res.writeHead(out.status, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(JSON.stringify(out.payload));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` }));
    });
  });
  return { server, seen };
}

async function withStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown; raw?: string; contentType?: string } | null,
  run: (seen: SeenReq[]) => Promise<void>,
) {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = `http://localhost:${port}/api/v1`;
  const { server, seen } = startStub(port, handler);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  try {
    httpApiClient.setNetworkMode('LAN');
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    await run(seen);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
  }
}

// ---------------------------------------------------------------------------
// N-29 (FAT-198): config GET — unmanaged objek, null tetap null.
// N-30 (FAT-199): config raw — text + metadata dari JSON.
// ---------------------------------------------------------------------------

test('E23 N-29 (FAT-198): config GET memetakan unmanaged objek; max_queued/inflight null tetap null', async () => {
  await withStub(3047, (_req, url) => {
    // E23 Batch 4 (FAT-208, N-39): path spec tanpa trailing slash.
    if (url.pathname === '/api/v1/mqtt/configuration') {
      return {
        status: 200,
        payload: {
          version: '2.0.18-rel-5',
          general: {
            per_listener_settings: true, allow_anonymous: false, autosave_interval_seconds: null,
            persistence: true, persistence_location: '/var/lib/mosquitto/', log_dest: [], log_type: [], connection_messages: true,
          },
          limits: {
            max_connections: null, max_packet_size_bytes: null, max_queued_messages: null,
            max_queued_bytes: null, max_inflight_messages: null,
          },
          listeners: [], tls_profiles: [], bridges: [],
          unmanaged: [
            { key: 'custom_key', section: 'general', line: 42, reason: 'custom key' },
            { key: 'other_key', section: 'listeners', line: 7, reason: 'legacy' },
          ],
        },
      };
    }
    return null;
  }, async () => {
    const cfg = await httpApiClient.getBrokerConfig();
    assert.equal(cfg.limits.max_queued_messages, null);
    assert.equal(cfg.limits.max_inflight_messages, null);
    assert.deepEqual(cfg.unmanaged, [
      { key: 'custom_key', section: 'general', line: 42, reason: 'custom key' },
      { key: 'other_key', section: 'listeners', line: 7, reason: 'legacy' },
    ]);
  });
});

test('E23 N-30 (FAT-199): config raw mengembalikan text mosquitto.conf + metadata, bukan dokumen JSON', async () => {
  const confText = 'per_listener_settings true\nallow_anonymous false\n';
  await withStub(3048, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/configuration/raw') {
      return {
        status: 200,
        payload: {
          metadata: {
            source: '/etc/mosquitto/mosquitto.conf', checksum: 'abc123', sizeBytes: 48,
            modifiedAt: '2026-11-19T07:00:00Z', mosquittoVersion: '2.0.18',
          },
          text: confText,
        },
      };
    }
    return null;
  }, async () => {
    const raw = await httpApiClient.getBrokerConfigRaw();
    assert.equal(raw.text, confText);
    assert.doesNotMatch(raw.text, /metadata/);
    assert.equal(raw.metadata?.checksum, 'abc123');
    assert.equal(raw.metadata?.sizeBytes, 48);
    assert.equal(raw.metadata?.mosquittoVersion, '2.0.18');
    assert.equal(raw.metadata?.source, '/etc/mosquitto/mosquitto.conf');
  });
});
