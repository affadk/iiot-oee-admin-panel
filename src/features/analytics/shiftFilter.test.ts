import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDateString,
  isCrossMidnightShift,
  parseShiftClock,
  resolveShiftWindow,
} from '../../utils/historicalExport';
import {
  buildClearShiftFilterPatch,
  buildShiftFilterPatch,
  daysAgoDateString,
  findShiftOne,
  toLocalDateString,
} from './shiftFilter';
import { Shift } from '../../types/production';

const SHIFT_1: Shift = {
  shiftId: 'SHIFT-1',
  shiftName: 'Shift 1 (Pagi)',
  shiftCode: 'S1',
  startTime: '07:00',
  endTime: '15:00',
  isActive: true,
  createdAt: '2026-01-02T07:00:00.000Z',
};

const SHIFT_2: Shift = {
  ...SHIFT_1,
  shiftId: 'SHIFT-2',
  shiftName: 'Shift 2 (Siang)',
  shiftCode: 'S2',
  startTime: '15:00',
  endTime: '23:00',
};

const SHIFT_3: Shift = {
  ...SHIFT_1,
  shiftId: 'SHIFT-3',
  shiftName: 'Shift 3 (Malam Dini)',
  shiftCode: 'S3',
  startTime: '00:00',
  endTime: '07:00',
};

// Shift lintas tengah malam (tidak ada di seed — resolver harus aman).
const SHIFT_NIGHT: Shift = {
  ...SHIFT_1,
  shiftId: 'SHIFT-N',
  shiftName: 'Shift Malam',
  shiftCode: 'SN',
  startTime: '23:00',
  endTime: '07:00',
};

const SHIFTS = [SHIFT_1, SHIFT_2, SHIFT_3];

test('resolveShiftWindow: Shift 1 pada tanggal tertentu (offset eksplisit)', () => {
  const win = resolveShiftWindow(SHIFT_1, '2026-11-16', '+07:00');
  assert.deepEqual(win, {
    from: '2026-11-16T07:00:00+07:00',
    to: '2026-11-16T15:00:00+07:00',
  });
});

test('resolveShiftWindow: Shift 2 dan Shift 3 dari definisi seed', () => {
  assert.deepEqual(resolveShiftWindow(SHIFT_2, '2026-11-16', '+07:00'), {
    from: '2026-11-16T15:00:00+07:00',
    to: '2026-11-16T23:00:00+07:00',
  });
  assert.deepEqual(resolveShiftWindow(SHIFT_3, '2026-11-16', '+07:00'), {
    from: '2026-11-16T00:00:00+07:00',
    to: '2026-11-16T07:00:00+07:00',
  });
});

test('resolveShiftWindow: shift lintas tengah malam — to jatuh keesokan harinya', () => {
  assert.deepEqual(resolveShiftWindow(SHIFT_NIGHT, '2026-11-16', '+07:00'), {
    from: '2026-11-16T23:00:00+07:00',
    to: '2026-11-17T07:00:00+07:00',
  });
  assert.equal(isCrossMidnightShift(SHIFT_NIGHT), true);
  assert.equal(isCrossMidnightShift(SHIFT_1), false);
  // Batas bulan/tahun ikut bergeser dengan benar.
  assert.deepEqual(resolveShiftWindow(SHIFT_NIGHT, '2026-12-31', '+07:00'), {
    from: '2026-12-31T23:00:00+07:00',
    to: '2027-01-01T07:00:00+07:00',
  });
});

test('resolveShiftWindow: endTime == startTime berarti shift 24 jam', () => {
  const fullDay: Shift = { ...SHIFT_1, startTime: '07:00', endTime: '07:00' };
  assert.deepEqual(resolveShiftWindow(fullDay, '2026-11-16', '+07:00'), {
    from: '2026-11-16T07:00:00+07:00',
    to: '2026-11-17T07:00:00+07:00',
  });
});

test('resolveShiftWindow: tanpa offset memakai offset pabrik +07:00 (E12 T12.11 / X-4)', () => {
  // Zona waktu tunggal Asia/Jakarta — bukan offset lokal browser.
  assert.deepEqual(resolveShiftWindow(SHIFT_1, '2026-11-16'), {
    from: '2026-11-16T07:00:00+07:00',
    to: '2026-11-16T15:00:00+07:00',
  });
});

test('resolveShiftWindow: input tidak valid mengembalikan null', () => {
  assert.equal(resolveShiftWindow({ ...SHIFT_1, startTime: '7:00' }, '2026-11-16', '+07:00'), null);
  assert.equal(resolveShiftWindow({ ...SHIFT_1, endTime: '25:00' }, '2026-11-16', '+07:00'), null);
  assert.equal(resolveShiftWindow(SHIFT_1, '16-11-2026', '+07:00'), null);
  assert.equal(resolveShiftWindow(SHIFT_1, '2026-02-30', '+07:00'), null);
  assert.equal(resolveShiftWindow(SHIFT_1, 'bukan-tanggal', '+07:00'), null);
});

test('parseShiftClock + addDaysToDateString: util tanggal shift', () => {
  assert.equal(parseShiftClock('07:00'), 420);
  assert.equal(parseShiftClock('23:59'), 1439);
  assert.equal(parseShiftClock('7:00'), null);
  assert.equal(parseShiftClock('24:00'), null);
  assert.equal(addDaysToDateString('2026-11-16', -1), '2026-11-15');
  assert.equal(addDaysToDateString('2026-03-01', -1), '2026-02-28');
  assert.equal(addDaysToDateString('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysToDateString('2026-02-30', 1), null);
  assert.equal(addDaysToDateString('2026-11-16', 0), '2026-11-16');
});

test('toLocalDateString + daysAgoDateString: tanggal Asia/Jakarta (bukan UTC / lokal browser)', () => {
  // E12 T12.11 (X-4 / FAT-59): 2026-11-17 02:00 WIB = 2026-11-16 19:00 UTC —
  // tanggalnya 17 Nov (Jakarta), bukan 16 Nov (UTC / browser UTC).
  const earlyJakarta = new Date('2026-11-17T02:00:00+07:00');
  assert.equal(toLocalDateString(earlyJakarta), '2026-11-17');
  assert.equal(daysAgoDateString(1, new Date('2026-11-16T12:00:00+07:00')), '2026-11-15');
  assert.equal(daysAgoDateString(0, new Date('2026-11-16T12:00:00+07:00')), '2026-11-16');
});

test('findShiftOne: shift berkode S1, fallback shift aktif pertama', () => {
  assert.equal(findShiftOne(SHIFTS)?.shiftId, 'SHIFT-1');
  assert.equal(findShiftOne([SHIFT_2, SHIFT_3])?.shiftId, 'SHIFT-2');
  assert.equal(findShiftOne([]), undefined);
});

test('buildShiftFilterPatch: memilih shift menghasilkan shiftDate/shiftId + from/to jendela shift', () => {
  const patch = buildShiftFilterPatch(SHIFT_1, '2026-11-16');
  assert.ok(patch);
  assert.equal(patch.shiftDate, '2026-11-16');
  assert.equal(patch.shiftId, 'SHIFT-1');
  assert.match(patch.from, /^2026-11-16T07:00:00[+-]\d{2}:\d{2}$/);
  assert.match(patch.to, /^2026-11-16T15:00:00[+-]\d{2}:\d{2}$/);

  // Lintas tengah malam: to keesokan harinya.
  const night = buildShiftFilterPatch(SHIFT_NIGHT, '2026-11-16');
  assert.ok(night);
  assert.match(night.from, /^2026-11-16T23:00:00[+-]\d{2}:\d{2}$/);
  assert.match(night.to, /^2026-11-17T07:00:00[+-]\d{2}:\d{2}$/);

  assert.equal(buildShiftFilterPatch(undefined, '2026-11-16'), null);
  assert.equal(buildShiftFilterPatch(SHIFT_1, undefined), null);
  assert.equal(buildShiftFilterPatch(SHIFT_1, '2026-02-30'), null);
});

test('buildClearShiftFilterPatch: hapus filter shift kembali ke 7 hari sliding', () => {
  const patch = buildClearShiftFilterPatch();
  assert.equal(patch.shiftDate, undefined);
  assert.equal(patch.shiftId, undefined);
  assert.ok(patch.from && patch.to);
  const spanMs = Date.parse(patch.to) - Date.parse(patch.from);
  assert.equal(spanMs, 7 * 24 * 60 * 60 * 1000);
});
