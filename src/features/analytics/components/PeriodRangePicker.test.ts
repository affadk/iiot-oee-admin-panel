import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HistoryFilters } from '../../../types/historical';
import { resolveTimeWindowPreset } from '../../../utils/historicalExport';
import { PeriodRangePicker } from './PeriodRangePicker';

// ---------------------------------------------------------------------------
// E12 T12.9 (X-2 / FAT-62): kontrol periode halaman OEE. Render diuji
// lewat renderToStaticMarkup (tanpa jsdom — repo ini tidak memakai jsdom):
// preset yang tersorot ditebak dari from/to aktif, input kustom muncul
// bila rentang kustom/jendela shift, dan petunjuk filter shift tampil
// bila shift aktif. Perilaku klik (preset -> {from, to} baru) diuji di
// utilitasnya: resolveTimeWindowPreset + applyHistoryFilterPatch /
// serializeHistoryFiltersToSearchParams (historyFilters.test.ts) dan
// buildOeeAnalyticsQueryKeys (oeeQueryKeys.test.ts).
// ---------------------------------------------------------------------------

function render(from: string, to: string, shiftFilterActive = false): string {
  const noop = (_patch: Partial<HistoryFilters>) => {};
  return renderToStaticMarkup(
    React.createElement(PeriodRangePicker, {
      from,
      to,
      onFilterChange: noop,
      shiftFilterActive,
    })
  );
}

/** Tombol preset `label` sedang aktif (aria-pressed="true") di markup. */
function isPresetPressed(markup: string, label: string): boolean {
  return new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${label}</button>`).test(markup);
}

test('rentang 7 hari menyorot preset "7 Hari" dan menampilkan rentang aktif', () => {
  const now = new Date('2026-11-17T10:24:00+07:00');
  const range = resolveTimeWindowPreset('7d', now);
  const markup = render(range.from, range.to);
  assert.equal(isPresetPressed(markup, '7 Hari'), true);
  assert.equal(isPresetPressed(markup, '30 Hari'), false);
  assert.match(markup, /Rentang aktif:/);
  assert.doesNotMatch(markup, /oee-period-from-input/);
});

test('rentang hari ini menyorot preset "Hari ini"', () => {
  const now = new Date('2026-11-17T10:24:00+07:00');
  const range = resolveTimeWindowPreset('today', now);
  const markup = render(range.from, range.to);
  assert.equal(isPresetPressed(markup, 'Hari ini'), true);
  assert.equal(isPresetPressed(markup, '24 Jam'), false);
});

test('rentang kustom menampilkan input dari/sampai dan menyorot "Kustom"', () => {
  const markup = render('2026-11-02T00:00:00+07:00', '2026-11-05T00:00:00+07:00');
  assert.equal(isPresetPressed(markup, 'Kustom'), true);
  assert.match(markup, /id="oee-period-from-input"/);
  assert.match(markup, /id="oee-period-to-input"/);
  assert.match(markup, /type="datetime-local"/);
});

test('jendela shift tampil sebagai kustom + petunjuk filter shift bila shift aktif', () => {
  const markup = render(
    '2026-11-16T07:00:00+07:00',
    '2026-11-16T15:00:00+07:00',
    true
  );
  assert.equal(isPresetPressed(markup, 'Kustom'), true);
  assert.match(markup, /id="oee-period-from-input"/);
  assert.match(markup, /Filter shift aktif/);
  const withoutShift = render('2026-11-16T07:00:00+07:00', '2026-11-16T15:00:00+07:00', false);
  assert.doesNotMatch(withoutShift, /Filter shift aktif/);
});
