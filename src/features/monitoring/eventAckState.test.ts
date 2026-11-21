import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationalEvent } from '../../types/monitoring';
import { getEventAckState } from './eventAckState';

// ---------------------------------------------------------------------------
// FAT-292 (P33.2, E33): state rtn-unacknowledged (ISA-18.2) — derivasi
// best-effort dalam jendela halaman yang dimuat. Aturan:
// - acknowledged → 'acked' (apa pun event_type / riwayatnya).
// - belum di-ack + DEVICE_OFFLINE + ada DEVICE_ONLINE untuk device_id
//   yang sama dengan recorded_at LEBIH BARU di daftar yang sama
//   → 'rtn-unack'.
// - belum di-ack lainnya → 'active-unack'.
// State server-side yang eksak butuh backend B33.4 (FAT-298).
// ---------------------------------------------------------------------------

function baseEvent(overrides: Partial<OperationalEvent> = {}): OperationalEvent {
  return {
    id: 'op-ev-900',
    recorded_at: '2026-11-21T00:30:00Z',
    device_id: 'STM32-OEE-01',
    station_label: null,
    machine_id: null,
    machine_name: null,
    wo_id: null,
    event_type: 'DEVICE_OFFLINE',
    trigger_source: 'DEVICE',
    event_code: null,
    snapshot_total_count: null,
    snapshot_run_sec: null,
    description: 'device offline',
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    ack_note: null,
    created_at: '2026-11-21T00:30:00Z',
    ...overrides,
  };
}

test('acked: acknowledged menang atas apa pun (offline + online lebih baru tetap acked)', () => {
  const offline = baseEvent({ acknowledged: true, acknowledged_by: 'ADM-001' });
  const online = baseEvent({
    id: 'op-ev-901',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:35:00Z',
  });
  assert.equal(getEventAckState(offline, [offline, online]), 'acked');
});

test('rtn-unack: offline belum di-ack + online lebih baru untuk device yang sama', () => {
  const offline = baseEvent();
  const online = baseEvent({
    id: 'op-ev-901',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:35:00Z',
  });
  assert.equal(getEventAckState(offline, [offline, online]), 'rtn-unack');
});

test('active-unack: offline belum di-ack + online HANYA yang lebih lama', () => {
  const offline = baseEvent();
  const online = baseEvent({
    id: 'op-ev-901',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:25:00Z',
  });
  assert.equal(getEventAckState(offline, [offline, online]), 'active-unack');
});

test('active-unack: offline belum di-ack + online lebih baru untuk device LAIN', () => {
  const offline = baseEvent();
  const online = baseEvent({
    id: 'op-ev-901',
    device_id: 'STM32-OEE-02',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:35:00Z',
  });
  assert.equal(getEventAckState(offline, [offline, online]), 'active-unack');
});

test('active-unack: offline belum di-ack tanpa event online sama sekali', () => {
  const offline = baseEvent();
  assert.equal(getEventAckState(offline, [offline]), 'active-unack');
  assert.equal(getEventAckState(offline, []), 'active-unack');
});

test('active-unack: online lebih baru tidak membuat tipe lain jadi rtn-unack', () => {
  const other = baseEvent({ event_type: 'WORK_ORDER_CANCELLED' });
  const online = baseEvent({
    id: 'op-ev-901',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:35:00Z',
  });
  assert.equal(getEventAckState(other, [other, online]), 'active-unack');
});

test('active-unack: event ONLINE itu sendiri tidak pernah rtn-unack', () => {
  const online = baseEvent({ event_type: 'DEVICE_ONLINE' });
  assert.equal(getEventAckState(online, [online]), 'active-unack');
});

test('active-unack: offline dengan device_id null tidak bisa dikorelasikan', () => {
  const offline = baseEvent({ device_id: null });
  const online = baseEvent({
    id: 'op-ev-901',
    device_id: null,
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:35:00Z',
  });
  assert.equal(getEventAckState(offline, [offline, online]), 'active-unack');
});

test('active-unack: online pada timestamp yang SAMA tidak membuktikan clear', () => {
  const offline = baseEvent();
  const online = baseEvent({
    id: 'op-ev-901',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:30:00Z',
  });
  assert.equal(getEventAckState(offline, [offline, online]), 'active-unack');
});

test('active-unack: recorded_at kosong/rusak tidak crash dan tidak jadi rtn-unack', () => {
  const offline = baseEvent({ recorded_at: '' });
  const online = baseEvent({
    id: 'op-ev-901',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:35:00Z',
  });
  assert.equal(getEventAckState(offline, [offline, online]), 'active-unack');
});
