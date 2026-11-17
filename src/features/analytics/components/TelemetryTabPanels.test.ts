import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { UseQueryResult } from '@tanstack/react-query';
import {
  HourlyOeePoint,
  TelemetryAggregatePoint,
  TelemetryAggregateResult,
} from '../../../types/analytics';
import { TelemetryTabPanels, TelemetryTabPanelsProps } from './TelemetryTabPanels';
import { useTelemetryAggregateColumns } from './TelemetryAggregateColumns';

// ---------------------------------------------------------------------------
// E12 T12.2 (F-5 / FAT-51): tab Aggregate me-render SELURUH deret per-bucket
// (tabel + grafik), menandai flag provisional, dan menampilkan empty state
// yang layak bila tidak ada baris. Render diuji lewat renderToStaticMarkup
// (tanpa jsdom — repo ini tidak memakai jsdom).
// ---------------------------------------------------------------------------

const ROWS: TelemetryAggregatePoint[] = [
  {
    bucket: '2026-11-11T09:00:00.000Z',
    totalCount: 10,
    goodCount: 9,
    rejectCount: 1,
    operatingSec: 3600,
    runSec: 3300,
    availabilityPct: 91.7,
    performancePct: 93.0,
    qualityPct: 90.0,
    oeePct: 76.7,
    sampleCount: 60,
    provisional: false,
  },
  {
    bucket: '2026-11-11T10:00:00.000Z',
    totalCount: 12,
    goodCount: 12,
    rejectCount: 0,
    operatingSec: 3600,
    runSec: 3400,
    availabilityPct: 94.4,
    performancePct: 95.0,
    qualityPct: 100.0,
    oeePct: 84.0,
    sampleCount: 60,
    provisional: false,
  },
  {
    bucket: '2026-11-11T11:00:00.000Z',
    totalCount: 11,
    goodCount: 10,
    rejectCount: 1,
    operatingSec: 3600,
    runSec: 3350,
    availabilityPct: 93.1,
    performancePct: 94.0,
    qualityPct: 90.9,
    oeePct: 88.0,
    sampleCount: 60,
    provisional: true,
  },
];

const AGG_DATA: TelemetryAggregateResult = {
  device_id: 'STM32-OEE-01',
  bucket: '1h',
  avg_oee: 82.9,
  avg_availability: 93.1,
  avg_performance: 94.0,
  avg_quality: 93.6,
  total_parts: 33,
  sample_count: 180,
  rows: ROWS,
};

function queryStub<T>(overrides: Partial<UseQueryResult<T, Error>> = {}): UseQueryResult<T, Error> {
  return {
    isLoading: false,
    isFetching: false,
    error: null,
    dataUpdatedAt: 0,
    refetch: async () => ({}) as unknown as ReturnType<UseQueryResult<T, Error>['refetch']>,
    ...overrides,
  } as unknown as UseQueryResult<T, Error>;
}

function baseProps(overrides: Partial<TelemetryTabPanelsProps> = {}): TelemetryTabPanelsProps {
  return {
    activeTab: 'aggregate',
    selectedDevice: 'STM32-OEE-01',
    aggBucket: '1h',
    rawRecords: [],
    rawColumns: [],
    telemetryQuery: {
      isLoading: false,
      isFetching: false,
      error: null,
      dataUpdatedAt: 0,
      refetch: async () => undefined,
    } as unknown as TelemetryTabPanelsProps['telemetryQuery'],
    rawPagination: undefined,
    hourlyData: [],
    hourlyColumns: [],
    hourlyQuery: queryStub<HourlyOeePoint[]>(),
    aggData: AGG_DATA,
    aggregateQuery: queryStub<TelemetryAggregateResult>(),
    aggColumns: [],
    rollupRecords: [],
    rollupColumns: [],
    rollupQuery: {
      isLoading: false,
      isFetching: false,
      error: null,
      dataUpdatedAt: 0,
      refetch: async () => undefined,
    } as unknown as TelemetryTabPanelsProps['rollupQuery'],
    rollupPagination: undefined,
    cursorStackLength: 1,
    onPushCursor: () => undefined,
    onPopCursor: () => undefined,
    onResetCursor: () => undefined,
    onPresetChange: () => undefined,
    periodLabel: '10 Nov 2026 – 11 Nov 2026',
    ...overrides,
  };
}

/** Pembungkus: kolom agregat dibuat lewat hook, seperti di halaman. */
function AggregateProbe(props: TelemetryTabPanelsProps) {
  const aggColumns = useTelemetryAggregateColumns();
  return React.createElement(TelemetryTabPanels, { ...props, aggColumns });
}

function renderAggregate(props: TelemetryTabPanelsProps): string {
  return renderToStaticMarkup(React.createElement(AggregateProbe, props));
}

test('Tab Aggregate: seluruh rows dirender (tabel + grafik) + provisional ditandai', () => {
  const html = renderAggregate(baseProps());
  // Tiap baris punya nilai OEE berbeda — ketiganya muncul berarti deret penuh.
  assert.ok(html.includes('76.7%'), html);
  assert.ok(html.includes('84.0%'), html);
  assert.ok(html.includes('88.0%'), html);
  // Penanda provisional (pola yang sama dengan Hourly/Rollup).
  assert.ok(html.includes('(Provisional)'), html);
  // Grafik batang sederhana + kartu ringkasan.
  assert.ok(html.includes('Tren OEE per bucket'), html);
  assert.ok(html.includes('3 bucket'), html);
  assert.ok(html.includes('OEE Rata-rata'), html);
  assert.ok(html.includes('33 pcs'), html);
  // Bukan empty state.
  assert.ok(!html.includes('Tidak ada data agregat'), html);
});

test('Tab Aggregate: rows kosong menampilkan empty state (bukan render null)', () => {
  const html = renderAggregate(baseProps({ aggData: { ...AGG_DATA, rows: [], total_parts: 0, sample_count: 0 } }));
  assert.ok(html.includes('Tidak ada data agregat'), html);
  assert.ok(html.includes('Belum ada bucket agregat untuk STM32-OEE-01'), html);
  assert.ok(!html.includes('Tren OEE per bucket'), html);
  assert.ok(!html.includes('OEE Rata-rata'), html);
});

test('Tab Aggregate: aggData undefined menampilkan empty state', () => {
  const html = renderAggregate(baseProps({ aggData: undefined }));
  assert.ok(html.includes('Tidak ada data agregat'), html);
  assert.ok(html.includes('Belum ada bucket agregat untuk STM32-OEE-01'), html);
});

test('Tab Aggregate: performance null (kapasitas unknown) dirender sebagai —', () => {
  const unknownRows: TelemetryAggregatePoint[] = [
    { ...ROWS[0], performancePct: null, totalCount: 0, oeePct: 0 },
  ];
  const html = renderAggregate(
    baseProps({
      aggData: {
        ...AGG_DATA,
        rows: unknownRows,
        avg_oee: 0,
        avg_performance: 0,
        total_parts: 0,
      },
    })
  );
  assert.ok(html.includes('0.0%'), html);
  assert.ok(html.includes('—'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): badge jumlah sampel tidak menampilkan "0" yang
// menyesatkan saat query agregat masih memuat (konsistensi dengan skeleton
// DataTable di bawahnya).
// ---------------------------------------------------------------------------

test('Tab Aggregate: badge sampel menampilkan … saat query masih memuat', () => {
  const html = renderAggregate(
    baseProps({
      aggData: undefined,
      aggregateQuery: queryStub<TelemetryAggregateResult>({ isLoading: true }),
    })
  );
  assert.ok(html.includes('… sampel'), html);
  assert.ok(!html.includes('0 sampel'), html);
  // DataTable menampilkan skeleton, bukan empty state.
  assert.ok(html.includes('Memuat baris tabel'), html);
  assert.ok(!html.includes('Tidak ada data agregat'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.19 (U-5 / FAT-64): tab Per Jam adalah tampilan RINGKAS dari OEE
// per jam (gap G23) — tampilannya yang kanonis ada di Analytics OEE.
// Tab ini mencatat sumber data yang sama (CAgg `oee_hourly_summary`) dan
// menautkan silang ke tampilan kanonis. <Link> dibungkus MemoryRouter.
// ---------------------------------------------------------------------------

/** Pembungkus: tab Per Jam memakai <Link> ke Analytics OEE. */
function renderHourly(props: TelemetryTabPanelsProps): string {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(TelemetryTabPanels, props)
    )
  );
}

test('Tab Hourly: mencatat tampilan ringkas + tampilan kanonis di Analytics OEE + sumber data sama', () => {
  const html = renderHourly(
    baseProps({ activeTab: 'hourly', oeeAnalyticsHref: '/analytics/oee?machine_id=CNC-MILLING-01' })
  );
  assert.ok(html.includes('Tampilan ringkas dari OEE per jam'), html);
  assert.ok(html.includes('tampilan kanonis ada di'), html);
  assert.ok(html.includes('Analytics OEE'), html);
  assert.ok(html.includes('oee_hourly_summary'), html);
  assert.ok(html.includes('Sumber data sama'), html);
});

test('Tab Hourly: tautan silang memakai href kanonis yang diteruskan halaman', () => {
  const html = renderHourly(
    baseProps({ activeTab: 'hourly', oeeAnalyticsHref: '/analytics/oee?machine_id=CNC-MILLING-01' })
  );
  assert.ok(html.includes('href="/analytics/oee?machine_id=CNC-MILLING-01"'), html);
});

test('Tab Hourly: tanpa href dari halaman, tautan jatuh ke /analytics/oee', () => {
  const html = renderHourly(baseProps({ activeTab: 'hourly' }));
  assert.ok(html.includes('href="/analytics/oee"'), html);
});

test('Tab Hourly: catatan kanonis hanya muncul di tab Per Jam, bukan tab lain', () => {
  const html = renderHourly(baseProps({ activeTab: 'raw' }));
  assert.ok(!html.includes('Tampilan ringkas dari OEE per jam'), html);
  assert.ok(!html.includes('oee_hourly_summary'), html);
});
