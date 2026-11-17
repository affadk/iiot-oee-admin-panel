import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TelemetryAggregateSummary } from '../hooks/useTelemetryQueries';
import { TelemetrySummaryStrip } from './TelemetrySummaryStrip';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): kartu ringkasan agregat di strip Telemetry
// History tidak lagi kosong tanpa pesan saat aggData undefined (gap G17,
// Guide §5) — skeleton saat memuat, pesan error + "Coba lagi" saat gagal,
// pesan kosong saat query selesai tanpa data. Bila query belum pernah
// berjalan (nonaktif karena tab lain), kartu tetap diam seperti semula.
// Render diuji lewat renderToStaticMarkup (tanpa jsdom).
// ---------------------------------------------------------------------------

const AGG_DATA: TelemetryAggregateSummary = {
  device_id: 'STM32-OEE-01',
  bucket: '1h',
  avg_oee: 82.9,
  avg_availability: 93.1,
  avg_performance: 94.0,
  avg_quality: 93.6,
  total_parts: 33,
  sample_count: 180,
  rows: [],
};

function render(
  aggData: TelemetryAggregateSummary | undefined,
  opts: { aggIsLoading?: boolean; aggIsError?: boolean; aggIsFetched?: boolean } = {}
): string {
  return renderToStaticMarkup(
    React.createElement(TelemetrySummaryStrip, {
      aggData,
      aggBucket: '1h',
      hourlyData: [],
      canExport: true,
      isExporting: false,
      cooldownSeconds: 0,
      onExportHourlyCsv: () => undefined,
      aggIsLoading: opts.aggIsLoading ?? false,
      aggIsError: opts.aggIsError ?? false,
      aggIsFetched: opts.aggIsFetched ?? false,
      onRetryAggregate: () => undefined,
    })
  );
}

test('TelemetrySummaryStrip menampilkan ringkasan agregat saat data ada', () => {
  const html = render(AGG_DATA);
  assert.ok(html.includes('180 sampel'), html);
  assert.ok(html.includes('82.9%'), html);
  assert.ok(html.includes('33'), html);
  assert.ok(!html.includes('Tidak ada data agregat'), html);
});

test('TelemetrySummaryStrip menampilkan skeleton saat agregat memuat', () => {
  const html = render(undefined, { aggIsLoading: true });
  assert.ok(html.includes('Memuat ringkasan agregat'), html);
  assert.ok(html.includes('animate-pulse'), html);
  // Badge jumlah sampel tidak menampilkan angka 0 yang menyesatkan.
  assert.ok(html.includes('… sampel'), html);
  assert.ok(!html.includes('0 sampel'), html);
  assert.ok(!html.includes('Tidak ada data agregat'), html);
});

test('TelemetrySummaryStrip menampilkan pesan error + tombol coba lagi saat agregat gagal', () => {
  const html = render(undefined, { aggIsError: true, aggIsFetched: true });
  assert.ok(html.includes('Gagal memuat ringkasan agregat'), html);
  assert.ok(html.includes('Coba lagi'), html);
  assert.ok(!html.includes('Tidak ada data agregat'), html);
});

test('TelemetrySummaryStrip menampilkan pesan kosong saat query selesai tanpa data', () => {
  const html = render(undefined, { aggIsFetched: true });
  assert.ok(html.includes('Tidak ada data agregat pada rentang ini.'), html);
  assert.ok(!html.includes('Memuat ringkasan agregat'), html);
  assert.ok(!html.includes('Gagal memuat ringkasan agregat'), html);
});

test('TelemetrySummaryStrip diam bila query agregat belum pernah berjalan', () => {
  const html = render(undefined, { aggIsFetched: false });
  assert.ok(!html.includes('Tidak ada data agregat'), html);
  assert.ok(!html.includes('Memuat ringkasan agregat'), html);
  assert.ok(!html.includes('Gagal memuat ringkasan agregat'), html);
});
