import test from 'node:test';
import assert from 'node:assert/strict';
import { CursorPageResponse } from '../../../types/historical';
import { DowntimeEvent } from '../../../types/monitoring';
import { DowntimeOverlayPage, mergeDowntimeOverlayPages } from './downtimeOverlay';

// ---------------------------------------------------------------------------
// E12 T12.13 (X-6 / FAT-63): gabung halaman riwayat downtime overlay —
// halaman kedua dimuat via cursor, hitungan "N dari M", dedup tetap benar,
// aktif menang atas histori, dan total TIDAK dikarang bila server tidak
// mengirim `meta.count` (gap G18).
// ---------------------------------------------------------------------------

function ev(id: string, overrides: Partial<DowntimeEvent> = {}): DowntimeEvent {
  return {
    id,
    device_id: 'STM32-OEE-01',
    machine_id: 'CNC-MILLING-01',
    machine_name: 'CNC Milling 01',
    started_at: '2026-11-17T07:00:00.000Z',
    ended_at: '2026-11-17T07:15:00.000Z',
    duration_seconds: 900,
    category: 'EQUIPMENT_FAILURE',
    reason: `Alasan ${id}`,
    is_labeled: true,
    created_at: '2026-11-17T07:00:00.000Z',
    ...overrides,
  };
}

function page(
  events: DowntimeEvent[],
  pagination: CursorPageResponse<DowntimeEvent>['pagination']
): DowntimeOverlayPage {
  return { active: [], history: { data: events, pagination } };
}

function pageWithActive(
  events: DowntimeEvent[],
  active: DowntimeEvent[],
  pagination: CursorPageResponse<DowntimeEvent>['pagination']
): DowntimeOverlayPage {
  return { active, history: { data: events, pagination } };
}

const ids = (n: number, prefix = 'DT'): DowntimeEvent[] =>
  Array.from({ length: n }, (_, i) => ev(`${prefix}-${String(i + 1).padStart(3, '0')}`));

test('Satu halaman (demo): total = jumlah yang dimuat, tidak ada halaman berikut', () => {
  const merged = mergeDowntimeOverlayPages([
    page(ids(3), { limit: 50, next_cursor: null, has_more: false, total_count: 3 }),
  ]);
  assert.equal(merged.loadedHistoryCount, 3);
  assert.equal(merged.totalCount, 3);
  assert.equal(merged.hasMore, false);
  assert.equal(merged.map.size, 3);
});

test('Halaman kedua dimuat via cursor: N terakumulasi, M dari total server', () => {
  const page1 = page(ids(50), { limit: 50, next_cursor: 'cursor-1', has_more: true, total_count: 120 });
  const page2 = page(ids(50, 'DT2'), { limit: 50, next_cursor: 'cursor-2', has_more: true, total_count: 120 });
  const merged = mergeDowntimeOverlayPages([page1, page2]);
  assert.equal(merged.loadedHistoryCount, 100);
  assert.equal(merged.totalCount, 120);
  assert.equal(merged.hasMore, true);
  assert.equal(merged.map.size, 100);
  assert.equal(merged.map.get('DT-001')?.reason, 'Alasan DT-001');
  assert.equal(merged.map.get('DT2-050')?.reason, 'Alasan DT2-050');
});

test('Semua halaman dimuat: total = N yang dimuat (eksak)', () => {
  const page1 = page(ids(50), { limit: 50, next_cursor: 'cursor-1', has_more: true, total_count: 120 });
  const page2 = page(ids(70, 'DT2'), { limit: 50, next_cursor: null, has_more: false, total_count: 120 });
  const merged = mergeDowntimeOverlayPages([page1, page2]);
  assert.equal(merged.loadedHistoryCount, 120);
  assert.equal(merged.totalCount, 120);
  assert.equal(merged.hasMore, false);
});

test('Server tidak mengirim total (fallback = panjang halaman): M null, jangan dikarang', () => {
  // Transport mengisi total_count dengan panjang halaman bila meta.count
  // tidak ada — 50 ≤ 50 yang dimuat, jadi bukan total yang bisa dipercaya.
  const merged = mergeDowntimeOverlayPages([
    page(ids(50), { limit: 50, next_cursor: 'cursor-1', has_more: true, total_count: 50 }),
  ]);
  assert.equal(merged.loadedHistoryCount, 50);
  assert.equal(merged.totalCount, null);
  assert.equal(merged.hasMore, true);
});

test('Server tidak mengirim total sama sekali: M null', () => {
  const merged = mergeDowntimeOverlayPages([
    page(ids(50), { limit: 50, next_cursor: 'cursor-1', has_more: true }),
  ]);
  assert.equal(merged.loadedHistoryCount, 50);
  assert.equal(merged.totalCount, null);
  assert.equal(merged.hasMore, true);
});

test('Dedup: id yang sama di dua halaman dihitung sekali, korelasi tetap benar', () => {
  const shared = ev('DT-001');
  const page1 = page([shared, ...ids(49, 'A')], {
    limit: 50, next_cursor: 'cursor-1', has_more: true, total_count: 60,
  });
  const page2 = page([shared, ...ids(9, 'B')], {
    limit: 50, next_cursor: null, has_more: false, total_count: 60,
  });
  const merged = mergeDowntimeOverlayPages([page1, page2]);
  assert.equal(merged.loadedHistoryCount, 59);
  assert.equal(merged.totalCount, 59);
  assert.equal(merged.hasMore, false);
  assert.equal(merged.map.size, 59);
  assert.equal(merged.map.get('DT-001'), shared);
});

test('Aktif menang atas histori; event aktif di luar histori tidak menambah N', () => {
  const historyEv = ev('DT-001', { reason: 'Alasan histori', ended_at: '2026-11-17T07:15:00.000Z' });
  const activeEv = ev('DT-001', { reason: 'Alasan aktif (ongoing)', ended_at: null });
  const activeOnly = ev('DT-999', { reason: 'Aktif di luar rentang histori', ended_at: null });
  const merged = mergeDowntimeOverlayPages([
    pageWithActive([historyEv, ev('DT-002')], [activeEv, activeOnly], {
      limit: 50, next_cursor: null, has_more: false, total_count: 2,
    }),
  ]);
  assert.equal(merged.loadedHistoryCount, 2);
  assert.equal(merged.totalCount, 2);
  assert.equal(merged.map.get('DT-001')?.reason, 'Alasan aktif (ongoing)');
  assert.equal(merged.map.get('DT-999')?.reason, 'Aktif di luar rentang histori');
  assert.equal(merged.map.size, 3);
});

test('has_more tanpa next_cursor dianggap tidak ada halaman berikut', () => {
  const merged = mergeDowntimeOverlayPages([
    page(ids(50), { limit: 50, next_cursor: null, has_more: true, total_count: 120 }),
  ]);
  assert.equal(merged.hasMore, false);
  // Semua yang bisa dimuat sudah dimuat — total = N.
  assert.equal(merged.totalCount, 50);
});

test('Belum ada halaman: N 0, M null, tidak ada halaman berikut', () => {
  const merged = mergeDowntimeOverlayPages([]);
  assert.equal(merged.loadedHistoryCount, 0);
  assert.equal(merged.totalCount, null);
  assert.equal(merged.hasMore, false);
  assert.equal(merged.map.size, 0);
});
