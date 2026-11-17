import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ShiftTimelineSegment } from '../../../types/analytics';
import { DowntimeEvent } from '../../../types/monitoring';
import { ShiftTimelineDetail } from './ShiftTimelineDetail';

// ---------------------------------------------------------------------------
// E12 T12.13 (X-6 / FAT-63): overlay downtime menampilkan "menampilkan N
// dari M" + tombol "Muat lebih banyak", dan pesan tidak-ditemukan yang jelas
// (bukan lagi "sedang memuat rincian atau di luar rentang filter", gap G18).
// Render diuji lewat renderToStaticMarkup (tanpa jsdom — repo ini tidak
// memakai jsdom); <Link> dibungkus MemoryRouter seperti OeeHourlyTable.test.
// ---------------------------------------------------------------------------

const SEGMENT: ShiftTimelineSegment = {
  start: '2026-11-17T07:00:00.000Z',
  end: '2026-11-17T07:15:00.000Z',
  fsm_state: 'UNPLANNED_DOWNTIME',
  downtime_id: 'DT-075',
  duration_min: 15,
};

const MATCHED: DowntimeEvent = {
  id: 'DT-075',
  device_id: 'STM32-OEE-01',
  machine_id: 'CNC-MILLING-01',
  machine_name: 'CNC Milling 01',
  started_at: '2026-11-17T07:00:00.000Z',
  ended_at: '2026-11-17T07:15:00.000Z',
  duration_seconds: 900,
  category: 'EQUIPMENT_FAILURE',
  reason: 'Hydraulic pressure drop',
  is_labeled: true,
  created_at: '2026-11-17T07:00:00.000Z',
};

interface DetailProps {
  activeSegment?: ShiftTimelineSegment;
  matchedDowntime?: DowntimeEvent | null;
  downtimeLoadedCount?: number;
  downtimeTotalCount?: number | null;
  downtimeHasMore?: boolean;
  downtimeIsLoading?: boolean;
}

function render(props: DetailProps = {}): string {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ShiftTimelineDetail, {
        activeSegment: props.activeSegment ?? SEGMENT,
        // `null` eksplisit = tidak ada event yang cocok (bukan default MATCHED).
        matchedDowntime: props.matchedDowntime !== undefined ? props.matchedDowntime : MATCHED,
        resolvedDeviceId: 'STM32-OEE-01',
        isProvisional: false,
        downtimeLoadedCount: props.downtimeLoadedCount ?? 50,
        // `null` eksplisit = total tidak diketahui (bukan default 120).
        downtimeTotalCount: props.downtimeTotalCount !== undefined ? props.downtimeTotalCount : 120,
        downtimeHasMore: props.downtimeHasMore ?? true,
        downtimeIsLoading: props.downtimeIsLoading ?? false,
        onLoadMoreDowntime: () => undefined,
        isLoadingMoreDowntime: false,
      })
    )
  );
}

test('Total diketahui: "Menampilkan N dari M event downtime" + tombol muat lebih banyak', () => {
  const html = render();
  assert.match(html, /Menampilkan 50 dari 120 event downtime/);
  assert.match(html, /Muat lebih banyak/);
  assert.match(html, /Hydraulic pressure drop/);
});

test('Total tidak diketahui (server tidak mengirim meta.count): hanya "Menampilkan N", tanpa total karangan', () => {
  const html = render({ downtimeTotalCount: null });
  assert.match(html, /Menampilkan 50 event downtime/);
  assert.doesNotMatch(html, /dari 120/);
  assert.match(html, /Muat lebih banyak/);
});

test('Semua halaman dimuat: "N dari N", tanpa tombol muat lebih banyak', () => {
  const html = render({ downtimeLoadedCount: 120, downtimeTotalCount: 120, downtimeHasMore: false });
  assert.match(html, /Menampilkan 120 dari 120 event downtime/);
  assert.doesNotMatch(html, /Muat lebih banyak/);
});

test('downtime_id tidak ditemukan + masih ada halaman: pesan jelas + aksi muat lebih banyak', () => {
  const html = render({ matchedDowntime: null });
  assert.match(html, /DT-075 tidak ditemukan di antara 50 event downtime yang sudah dimuat/);
  assert.match(html, /kemungkinan berada di halaman berikutnya/);
  assert.match(html, /Muat lebih banyak/);
  assert.doesNotMatch(html, /sedang memuat rincian atau di luar rentang filter/);
});

test('downtime_id tidak ditemukan + semua halaman dimuat: pesan rentang filter, tanpa tombol', () => {
  const html = render({ matchedDowntime: null, downtimeLoadedCount: 120, downtimeTotalCount: 120, downtimeHasMore: false });
  assert.match(html, /DT-075 tidak ditemukan di antara 120 event downtime pada rentang filter ini/);
  assert.doesNotMatch(html, /Muat lebih banyak/);
  assert.doesNotMatch(html, /sedang memuat rincian atau di luar rentang filter/);
});

test('Halaman pertama masih dimuat: "Memuat rincian downtime…" bukan pesan tidak-ditemukan', () => {
  const html = render({ matchedDowntime: null, downtimeLoadedCount: 0, downtimeIsLoading: true });
  assert.match(html, /Memuat rincian downtime/);
  assert.doesNotMatch(html, /tidak ditemukan di antara/);
});

test('Segmen tanpa downtime_id: pesan operasi normal + hitungan tetap tampil', () => {
  const html = render({
    activeSegment: { ...SEGMENT, fsm_state: 'RUNNING', downtime_id: null },
    matchedDowntime: null,
  });
  assert.match(html, /Segmen operasi normal tanpa insiden downtime terikat/);
  assert.match(html, /Menampilkan 50 dari 120 event downtime/);
});
