import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../../services/api/client';
import {
  dateKeyInJakarta,
  formatJakartaDateTime,
  formatJakartaTime,
  monthKeyInJakarta,
  timelineSegmentDurationMin,
} from './timezone';
import { formatIsoWithOffset, resolveShiftWindow } from './time';

// ---------------------------------------------------------------------------
// E12 T12.11 (X-4 / FAT-59): zona waktu tunggal Asia/Jakarta (gap G11).
// Kunci hari/bulan rollup demo, from/to, dan semua label waktu memakai
// WIB — bukan offset lokal browser (VM test berjalan di UTC, jadi setiap
// kasus di bawah sengaja membedakan WIB dari UTC).
// ---------------------------------------------------------------------------

test('formatIsoWithOffset menulis wall-clock Asia/Jakarta +07:00', () => {
  // 2026-11-16 19:00 UTC = 2026-11-17 02:00 WIB.
  assert.equal(formatIsoWithOffset(new Date('2026-11-16T19:00:00Z')), '2026-11-17T02:00:00+07:00');
  assert.equal(formatIsoWithOffset(new Date('2026-11-11T00:00:00Z')), '2026-11-11T07:00:00+07:00');
});

test('dateKeyInJakarta: kunci hari WIB, bukan UTC', () => {
  // 2026-11-16 23:30 UTC masih 16 Nov UTC, tapi sudah 17 Nov 06:30 WIB.
  assert.equal(dateKeyInJakarta(new Date('2026-11-16T23:30:00Z')), '2026-11-17');
  assert.equal(dateKeyInJakarta(new Date('2026-11-17T02:00:00+07:00')), '2026-11-17');
  assert.equal(dateKeyInJakarta(new Date('2026-11-16T16:59:00Z')), '2026-11-16');
});

test('monthKeyInJakarta: kunci bulan WIB, bukan UTC', () => {
  // 2026-11-30 17:30 UTC masih Nov UTC, tapi sudah 1 Des 00:30 WIB.
  assert.equal(monthKeyInJakarta(new Date('2026-11-30T17:30:00Z')), '2026-12');
  assert.equal(monthKeyInJakarta(new Date('2026-11-30T17:30:00Z'), 1), '2026-11');
  assert.equal(monthKeyInJakarta(new Date('2026-01-15T12:00:00+07:00'), 1), '2025-12');
});

test('formatJakartaTime: ISO dikonversi ke WIB, HH:MM polos apa adanya', () => {
  assert.equal(formatJakartaTime('2026-11-11T07:00:00+07:00'), '07:00');
  assert.equal(formatJakartaTime('2026-11-11T00:00:00Z'), '07:00');
  assert.equal(formatJakartaTime('2026-11-16T19:00:00Z'), '02:00');
  assert.equal(formatJakartaTime('07:00'), '07:00');
  assert.equal(formatJakartaTime('bukan-jam'), 'bukan-jam');
});

test('formatJakartaDateTime: tanggal + jam WIB', () => {
  const label = formatJakartaDateTime('2026-11-16T19:00:00Z');
  assert.ok(label.includes('17 Nov 2026'), label);
  assert.ok(label.includes('02.00'), label);
});

test('timelineSegmentDurationMin: ISO, HH:MM, dan lintas tengah malam', () => {
  assert.equal(
    timelineSegmentDurationMin('2026-11-11T07:00:00+07:00', '2026-11-11T09:15:00+07:00'),
    135
  );
  assert.equal(timelineSegmentDurationMin('07:00', '09:15'), 135);
  // Lintas tengah malam dalam format lama: 23:30 -> 01:00 = 90 menit.
  assert.equal(timelineSegmentDurationMin('23:30', '01:00'), 90);
  assert.equal(
    timelineSegmentDurationMin('2026-11-16T23:30:00+07:00', '2026-11-17T01:00:00+07:00'),
    90
  );
  assert.equal(timelineSegmentDurationMin('bukan-jam', '09:15'), 0);
});

test('resolveShiftWindow tanpa offset memakai +07:00 (bukan lokal browser)', () => {
  assert.deepEqual(resolveShiftWindow({ startTime: '07:00', endTime: '15:00' }, '2026-11-16'), {
    from: '2026-11-16T07:00:00+07:00',
    to: '2026-11-16T15:00:00+07:00',
  });
  // Lintas tengah malam: to jatuh keesokan harinya.
  assert.deepEqual(resolveShiftWindow({ startTime: '22:00', endTime: '06:00' }, '2026-11-16'), {
    from: '2026-11-16T22:00:00+07:00',
    to: '2026-11-17T06:00:00+07:00',
  });
});

test('Demo rollup day: kunci hari pertama adalah tanggal WIB dari `to`', async () => {
  // `to` 2026-11-17 02:00 WIB = 2026-11-16 19:00 UTC — kunci UTC akan
  // menulis 2026-11-16, kunci WIB yang benar 2026-11-17.
  const page = await apiClient.getTelemetryRollup({
    group_by: 'day',
    from: '2026-11-10T00:00:00+07:00',
    to: '2026-11-17T02:00:00+07:00',
    limit: 20,
    envelope: true,
  });
  assert.ok(page.data.length > 0);
  assert.equal(page.data[0].groupKey, '2026-11-17');
  assert.equal(page.data[0].bucket, '2026-11-17');
});

test('Demo rollup month: kunci bulan pertama adalah bulan WIB dari `to`', async () => {
  // `to` 2026-12-01 00:30 WIB = 2026-11-30 17:30 UTC — kunci UTC akan
  // menulis 2026-11, kunci WIB yang benar 2026-12.
  const page = await apiClient.getTelemetryRollup({
    group_by: 'month',
    from: '2026-11-01T00:00:00+07:00',
    to: '2026-12-01T00:30:00+07:00',
    limit: 20,
    envelope: true,
  });
  assert.ok(page.data.length > 0);
  assert.equal(page.data[0].groupKey, '2026-12');
  assert.equal(page.data[1].groupKey, '2026-11');
});

test('Demo timeline: start/end ISO 8601 Asia/Jakarta + durasi tetap terrekoniliasi', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m');
  assert.equal(segs.length, 33);
  assert.equal(segs[0].start, '2026-11-11T07:00:00+07:00');
  assert.equal(segs[segs.length - 1].end, '2026-11-11T15:00:00+07:00');
  // Durasi dari ISO harus sama dengan duration_min segmen (bukan NaN).
  for (const s of segs) {
    assert.equal(timelineSegmentDurationMin(s.start, s.end), s.duration_min, `${s.start}–${s.end}`);
  }
  assert.equal(
    segs.reduce((acc, s) => acc + s.duration_min, 0),
    480
  );
});
