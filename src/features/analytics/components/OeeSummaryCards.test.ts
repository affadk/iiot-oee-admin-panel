import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShiftSummary } from '../../../types/analytics';
import { OeeSummaryCards } from './OeeSummaryCards';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): kartu ringkasan tidak lagi hilang begitu saja
// (return null) saat summary null (gap G17, Guide §5) — tampilkan skeleton
// saat memuat, pesan error + "Coba lagi" saat gagal, dan pesan kosong saat
// tidak ada data pada rentang ini. Render diuji lewat renderToStaticMarkup
// (tanpa jsdom — repo ini tidak memakai jsdom).
// ---------------------------------------------------------------------------

const SUMMARY: ShiftSummary = {
  shift_name: 'Shift 1',
  machine_id: 'CNC-MILLING-01',
  machine_name: 'CNC Milling 01',
  shift_start: '2026-11-16T07:00:00+07:00',
  shift_end: '2026-11-16T15:00:00+07:00',
  tz: 'Asia/Jakarta',
  oee: 81.4,
  availability: 90,
  performance: 92.5,
  quality: 97.7,
  planned_production_time_min: 480,
  planned_break_min: 60,
  operating_time_min: 420,
  run_time_min: 388,
  unplanned_downtime_min: 32,
  planned_downtime_min: 60,
  total_parts: 350,
  good_parts: 342,
  defect_parts: 8,
  target_per_hour: 50,
};

function render(
  summary: ShiftSummary | null,
  opts: { isLoading?: boolean; isError?: boolean } = {}
): string {
  return renderToStaticMarkup(
    React.createElement(OeeSummaryCards, {
      summary,
      fallbackPeriodLabel: '7 hari terakhir',
      isLoading: opts.isLoading ?? false,
      isError: opts.isError ?? false,
      onRetry: () => undefined,
    })
  );
}

test('OeeSummaryCards menampilkan keempat kartu saat summary ada', () => {
  const html = render(SUMMARY);
  assert.ok(html.includes('Shift Total OEE'), html);
  assert.ok(html.includes('81.4'), html);
  assert.ok(html.includes('Availability'), html);
  assert.ok(html.includes('Performance'), html);
  assert.ok(html.includes('Quality'), html);
  assert.ok(!html.includes('Tidak ada data ringkasan'), html);
});

test('OeeSummaryCards menampilkan skeleton saat memuat dan summary null', () => {
  const html = render(null, { isLoading: true });
  assert.ok(html.includes('Memuat ringkasan OEE'), html);
  assert.ok(html.includes('animate-pulse'), html);
  // Label periode tetap tampil — pengguna tahu periode mana yang dimuat.
  assert.ok(html.includes('7 hari terakhir'), html);
  assert.ok(!html.includes('Tidak ada data ringkasan'), html);
  assert.ok(!html.includes('Gagal memuat ringkasan OEE'), html);
});

test('OeeSummaryCards menampilkan pesan kosong saat summary null dan tidak memuat', () => {
  const html = render(null);
  assert.ok(html.includes('Tidak ada data ringkasan pada rentang ini'), html);
  assert.ok(html.includes('Belum ada ringkasan shift untuk mesin dan periode yang dipilih.'), html);
  assert.ok(html.includes('7 hari terakhir'), html);
  assert.ok(!html.includes('Memuat ringkasan OEE'), html);
  assert.ok(!html.includes('Gagal memuat ringkasan OEE'), html);
});

test('OeeSummaryCards menampilkan pesan error + tombol coba lagi saat gagal memuat', () => {
  const html = render(null, { isError: true });
  assert.ok(html.includes('Gagal memuat ringkasan OEE'), html);
  assert.ok(html.includes('Coba lagi'), html);
  assert.ok(!html.includes('Tidak ada data ringkasan'), html);
});
