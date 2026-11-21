import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TelemetryRollupItem } from '../../../types/analytics';
import { OeeRollupTable } from './OeeRollupTable';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): tabel rollup membedakan memuat (skeleton) vs
// tidak ada data pada rentang ini vs gagal memuat (Guide §5, gap G17) —
// bukan lagi <tbody> kosong tanpa pesan. Render diuji lewat
// renderToStaticMarkup (tanpa jsdom — repo ini tidak memakai jsdom).
// ---------------------------------------------------------------------------

const ROW: TelemetryRollupItem = {
  groupBy: 'machine',
  groupKey: 'CNC-MILLING-01',
  bucket: null,
  machineId: 'CNC-MILLING-01',
  machine_id: 'CNC-MILLING-01',
  machine_name: 'CNC Milling 01',
  device_id: 'STM32-OEE-01',
  totalCount: 350,
  goodCount: 342,
  rejectCount: 8,
  operatingSec: 28800,
  runSec: 25920,
  availabilityPct: 90,
  performancePct: 92.5,
  qualityPct: 97.71,
  oeePct: 81.36,
  sampleCount: 480,
  provisional: false,
};

function render(
  rollupRows: TelemetryRollupItem[],
  opts: { isLoading?: boolean; isError?: boolean; rollupScope?: 'MACHINE' | 'ALL' } = {}
): string {
  return renderToStaticMarkup(
    React.createElement(OeeRollupTable, {
      rollupRows,
      rollupGroupBy: 'machine',
      machineLabel: 'CNC-MILLING-01',
      onGroupByChange: () => undefined,
      rollupScope: opts.rollupScope ?? 'MACHINE',
      onScopeChange: () => undefined,
      periodLabel: '7 hari terakhir',
      isLoading: opts.isLoading ?? false,
      isError: opts.isError ?? false,
      onRetry: () => undefined,
    })
  );
}

test('OeeRollupTable menampilkan baris rollup dengan nilai yang benar', () => {
  const html = render([ROW]);
  assert.ok(html.includes('Rollup — CNC-MILLING-01'), html);
  assert.ok(html.includes('81.36%'), html);
  assert.ok(html.includes('90.00%'), html);
  assert.ok(html.includes('92.50%'), html);
  assert.ok(html.includes('97.71%'), html);
  assert.ok(!html.includes('Tidak ada data pada rentang ini'), html);
});

test('OeeRollupTable menampilkan skeleton saat memuat dan belum ada data', () => {
  const html = render([], { isLoading: true });
  assert.ok(html.includes('Memuat data'), html);
  assert.ok(html.includes('animate-pulse'), html);
  assert.ok(!html.includes('Tidak ada data pada rentang ini'), html);
  assert.ok(!html.includes('Gagal memuat data'), html);
});

test('OeeRollupTable menampilkan pesan kosong saat tidak ada baris', () => {
  const html = render([]);
  assert.ok(html.includes('Tidak ada data pada rentang ini'), html);
  assert.ok(html.includes('Tidak ada hasil agregasi rollup untuk mesin dan periode yang dipilih.'), html);
  assert.ok(!html.includes('Memuat data'), html);
  assert.ok(!html.includes('Gagal memuat data'), html);
});

test('OeeRollupTable menampilkan pesan error + tombol coba lagi saat gagal memuat', () => {
  const html = render([], { isError: true });
  assert.ok(html.includes('Gagal memuat data'), html);
  assert.ok(html.includes('Coba lagi'), html);
  assert.ok(!html.includes('Tidak ada data pada rentang ini'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.10 (X-3 / FAT-57): toggle scope rollup — "Mesin ini" (default,
// judul "Rollup — <mesin>") vs "Semua mesin" (judul "Rollup — Semua
// Mesin" + pesan kosong plant-wide). Toggle dirender sebagai select
// "Scope Rollup" di samping select grouping.
// ---------------------------------------------------------------------------

test('OeeRollupTable scope "Mesin ini": judul memakai nama mesin + toggle memilih Mesin ini', () => {
  const html = render([ROW], { rollupScope: 'MACHINE' });
  assert.ok(html.includes('Rollup — CNC-MILLING-01'), html);
  assert.ok(!html.includes('Rollup — Semua Mesin'), html);
  assert.ok(html.includes('aria-label="Scope Rollup"'), html);
  assert.ok(html.includes('Mesin ini'), html);
  assert.ok(html.includes('Semua mesin'), html);
  // Ada baris: pesan kosong (mesin ini) tidak tampil.
  assert.ok(!html.includes('Tidak ada hasil agregasi rollup untuk mesin dan periode yang dipilih.'), html);
});

test('OeeRollupTable scope "Semua mesin": judul plant-wide + pesan kosong plant-wide', () => {
  const html = render([], { rollupScope: 'ALL' });
  assert.ok(html.includes('Rollup — Semua Mesin'), html);
  assert.ok(!html.includes('Rollup — CNC-MILLING-01'), html);
  assert.ok(html.includes('Tidak ada hasil agregasi rollup untuk semua mesin pada periode yang dipilih.'), html);
  assert.ok(!html.includes('Tidak ada hasil agregasi rollup untuk mesin dan periode yang dipilih.'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.12 (X-5 / FAT-58): penanda "(Provisional)" konsisten dengan
// Hourly/Aggregate/Timeline (gap G12) — baris provisional ditandai dengan
// teks amber yang sama, baris final tidak.
// ---------------------------------------------------------------------------

test('OeeRollupTable menandai baris provisional dengan (Provisional), baris final tidak', () => {
  const provisionalRow: TelemetryRollupItem = {
    ...ROW,
    groupKey: '2026-11-11',
    machine_name: null,
    provisional: true,
  };
  const html = render([ROW, provisionalRow]);
  assert.ok(html.includes('(Provisional)'), html);
  // Tepat satu penanda — hanya baris 2026-11-11.
  assert.equal(html.split('(Provisional)').length - 1, 1, html);
});
