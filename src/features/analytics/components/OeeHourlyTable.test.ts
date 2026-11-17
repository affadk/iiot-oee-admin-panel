import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HourlyOeePoint } from '../../../types/analytics';
import { OeeHourlyTable } from './OeeHourlyTable';

// ---------------------------------------------------------------------------
// E12 T12.3 (F-6 / FAT-53): tabel per jam menampilkan good_count,
// hourly_operating_sec, hourly_run_sec, sampleCount; presisi OEE dan A/P/Q
// disamakan ke 2 desimal seperti rollup; kapasitas unknown menampilkan
// "— (Kapasitas 0/Unknown)" (bukan Performance 0). Render diuji lewat
// renderToStaticMarkup (tanpa jsdom — repo ini tidak memakai jsdom);
// <Link> di komponen dibungkus MemoryRouter.
// ---------------------------------------------------------------------------

const NORMAL_ROW: HourlyOeePoint = {
  hour: '07:00',
  oee: 80.5,
  availability: 90.3,
  performance: 91.0,
  quality: 98.0,
  parts_produced: 42,
  defect_count: 1,
  good_count: 41,
  hourly_operating_sec: 3600,
  hourly_run_sec: 3250,
  sampleCount: 60,
  targetPerHour: 50,
  state: 'RUNNING',
  planned: false,
  provisional: false,
};

const UNKNOWN_CAPACITY_ROW: HourlyOeePoint = {
  ...NORMAL_ROW,
  hour: '08:00',
  oee: 0,
  availability: 100,
  performance: 0,
  quality: 100,
  parts_produced: 0,
  defect_count: 0,
  good_count: 0,
  targetPerHour: null,
};

const ZERO_CAPACITY_ROW: HourlyOeePoint = {
  ...NORMAL_ROW,
  hour: '12:00',
  oee: 0,
  availability: 0,
  performance: 0,
  quality: 100,
  parts_produced: 0,
  defect_count: 0,
  good_count: 0,
  hourly_operating_sec: 0,
  hourly_run_sec: 0,
  sampleCount: 12,
  targetPerHour: 0,
  state: 'PLANNED_DOWNTIME',
  planned: true,
};

function render(
  hourly: HourlyOeePoint[],
  opts: { isLoading?: boolean; isError?: boolean } = {}
): string {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(OeeHourlyTable, {
        hourly,
        resolvedDeviceId: 'STM32-OEE-01',
        isLoading: opts.isLoading ?? false,
        isError: opts.isError ?? false,
        onRetry: () => undefined,
      })
    )
  );
}

test('OeeHourlyTable menampilkan kolom baru dengan nilai yang benar', () => {
  const html = render([NORMAL_ROW]);
  assert.match(html, /<th[^>]*>Good<\/th>/);
  assert.match(html, /Op \/ Run · Sampel/);
  // good_count 41 (kolom Good, hijau seperti rollup).
  assert.ok(html.includes('>41<'));
  // Op 3600 dtk = "1h 0m 0s", Run 3250 dtk = "54m 10s", Sampel 60.
  assert.ok(html.includes('1h 0m 0s'));
  assert.ok(html.includes('54m 10s'));
  assert.ok(html.includes('· 60'));
});

test('OeeHourlyTable memakai presisi 2 desimal seperti rollup', () => {
  const html = render([NORMAL_ROW]);
  assert.ok(html.includes('80.50%'), 'OEE 2 desimal');
  assert.ok(html.includes('90.30% / 91.00% / 98.00%'), 'A/P/Q 2 desimal');
  assert.ok(!html.includes('80.5%'), 'tidak ada lagi 1 desimal');
});

test('OeeHourlyTable memberi label Weighted pada kolom performa', () => {
  const html = render([NORMAL_ROW]);
  assert.match(html, /A \/ P \(Weighted\) \/ Q/);
});

test('OeeHourlyTable menampilkan — (Kapasitas 0/Unknown) bila kapasitas unknown', () => {
  const html = render([UNKNOWN_CAPACITY_ROW]);
  assert.ok(html.includes('— (Kapasitas 0/Unknown)'));
  // Performance bukan lagi "0.00%" di sel A/P/Q.
  assert.ok(!html.includes(' / 0.00% /'), 'tidak ada Performance 0.00%');
  // A dan Q tetap tampil 2 desimal di sekelilingnya.
  assert.ok(html.includes('100.00% / — (Kapasitas 0/Unknown) / 100.00%'));
});

test('OeeHourlyTable menampilkan — (Kapasitas 0/Unknown) bila kapasitas 0', () => {
  const html = render([ZERO_CAPACITY_ROW]);
  assert.ok(html.includes('— (Kapasitas 0/Unknown)'));
  assert.ok(!html.includes(' / 0.00% /'));
});

test('OeeHourlyTable menampilkan — bila field opsional tidak dikirim', () => {
  const sparse: HourlyOeePoint = {
    hour: '09:00',
    oee: 86.2,
    availability: 94.0,
    performance: 93.5,
    quality: 98.2,
    parts_produced: 50,
    defect_count: 1,
    targetPerHour: 50,
    state: 'RUNNING',
  };
  const html = render([sparse]);
  // Good —, Op/Run —, Sampel —.
  assert.ok(html.includes('— / — · —'));
});

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): tabel membedakan memuat (skeleton) vs tidak ada
// data pada rentang ini vs gagal memuat (Guide §5, gap G17) — bukan lagi
// <tbody> kosong tanpa pesan.
// ---------------------------------------------------------------------------

test('OeeHourlyTable menampilkan skeleton saat memuat dan belum ada data', () => {
  const html = render([], { isLoading: true });
  assert.ok(html.includes('Memuat data'), html);
  assert.ok(html.includes('animate-pulse'), html);
  assert.ok(!html.includes('Tidak ada data pada rentang ini'), html);
  assert.ok(!html.includes('Gagal memuat data'), html);
});

test('OeeHourlyTable menampilkan pesan kosong saat tidak ada baris', () => {
  const html = render([]);
  assert.ok(html.includes('Tidak ada data pada rentang ini'), html);
  assert.ok(html.includes('Tidak ada bucket produksi per jam untuk mesin dan periode yang dipilih.'), html);
  assert.ok(!html.includes('Memuat data'), html);
  assert.ok(!html.includes('Gagal memuat data'), html);
});

test('OeeHourlyTable menampilkan pesan error + tombol coba lagi saat gagal memuat', () => {
  const html = render([], { isError: true });
  assert.ok(html.includes('Gagal memuat data'), html);
  assert.ok(html.includes('Coba lagi'), html);
  assert.ok(!html.includes('Tidak ada data pada rentang ini'), html);
});

test('OeeHourlyTable tetap menampilkan baris bila data sudah ada (bukan state kosong)', () => {
  const html = render([NORMAL_ROW]);
  assert.ok(html.includes('80.50%'), html);
  assert.ok(!html.includes('Tidak ada data pada rentang ini'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.12 (X-5 / FAT-58): penanda "(Provisional)" konsisten dengan
// Rollup/Aggregate/Timeline (gap G12) — baris provisional ditandai dengan
// teks amber yang sama, baris final tidak.
// ---------------------------------------------------------------------------

test('OeeHourlyTable menandai baris provisional dengan (Provisional), baris final tidak', () => {
  const provisionalRow: HourlyOeePoint = { ...NORMAL_ROW, hour: '13:00', provisional: true };
  const html = render([NORMAL_ROW, provisionalRow]);
  assert.ok(html.includes('(Provisional)'), html);
  // Tepat satu penanda — hanya baris 13:00.
  assert.equal(html.split('(Provisional)').length - 1, 1, html);
  assert.ok(html.includes('13:00'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.19 (U-5 / FAT-64): tabel ini adalah tampilan KANONIS OEE per jam
// (gap G23) — diberi label, dicatat sumber datanya yang sama dengan tab Per
// Jam di Riwayat Telemetri, dan ditautkan silang ke tab itu.
// ---------------------------------------------------------------------------

test('OeeHourlyTable menandai dirinya sebagai tampilan kanonis + mencatat sumber data sama', () => {
  const html = render([NORMAL_ROW]);
  assert.ok(html.includes('Tampilan kanonis'), html);
  assert.ok(html.includes('oee_hourly_summary'), html);
  assert.ok(html.includes('tab Per Jam di Riwayat Telemetri'), html);
  assert.ok(html.includes('sumber yang sama'), html);
});

test('OeeHourlyTable menautkan silang ke tab Per Jam di Telemetry History (dengan device + tab)', () => {
  const html = render([NORMAL_ROW]);
  assert.ok(html.includes('Lihat di Telemetry History'), html);
  // href memakai &amp; (HTML-escaped) — device_id + tab=hourly.
  assert.ok(html.includes('/telemetry?device_id=STM32-OEE-01&amp;tab=hourly'), html);
  assert.ok(!html.includes('Buka Riwayat Telemetri'), 'label lama diganti');
});
