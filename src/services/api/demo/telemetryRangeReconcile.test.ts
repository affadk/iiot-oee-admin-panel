// E32.2 (FAT-283): dipecah dari telemetryRange.test.ts — E11 T11.4
// (rekonsiliasi angka seed demo: timeline vs summary vs hourly vs
// downtime events; demo saja, tanpa stub HTTP).
// Kode sumber tidak diubah, hanya pemecahan file tes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../client';

// ---------------------------------------------------------------------------
// E11 T11.4 (FAT-46 / F-4): angka seed demo terrekoniliasi (gap G2, G21).
// Shift summary adalah KEBENARAN: jendela 480 mnt = RUNNING 388 + PLANNED
// 60 + UNPLANNED 32; operating 420 = run 388 + unplanned 32.
// ---------------------------------------------------------------------------

test('Demo rekonsiliasi: Σ durasi timeline per state = shift summary (bucket 15m)', async () => {
  const summary = await apiClient.getShiftSummary('CNC-MILLING-01');
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m');
  const byState = new Map<string, number>();
  for (const s of segs) byState.set(s.fsm_state, (byState.get(s.fsm_state) ?? 0) + s.duration_min);
  const total = segs.reduce((acc, s) => acc + s.duration_min, 0);
  assert.equal(total, summary.planned_production_time_min); // 480
  assert.equal(byState.get('RUNNING'), summary.run_time_min); // 388
  assert.equal(byState.get('PLANNED_DOWNTIME'), summary.planned_downtime_min); // 60
  assert.equal(byState.get('UNPLANNED_DOWNTIME'), summary.unplanned_downtime_min); // 32
  assert.equal(
    (byState.get('RUNNING') ?? 0) + (byState.get('UNPLANNED_DOWNTIME') ?? 0),
    summary.operating_time_min
  ); // 420
});

test('Demo rekonsiliasi: Σ durasi timeline per state sama pada semua bucket + gapless', async () => {
  // E12 T12.11 (X-4 / FAT-59): start/end kini ISO 8601 — toMin mengekstrak
  // jam-dindingnya (jam WIB, sama dengan yang tertulis di ISO +07:00).
  const toMin = (v: string) => {
    const hhmm = v.includes('T') ? v.slice(11, 16) : v;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const bucketMin: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60 };
  for (const bucket of ['1m', '5m', '15m', '1h'] as const) {
    const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', bucket);
    const byState = new Map<string, number>();
    for (const s of segs) byState.set(s.fsm_state, (byState.get(s.fsm_state) ?? 0) + s.duration_min);
    assert.equal(byState.get('RUNNING'), 388, `RUNNING bucket ${bucket}`);
    assert.equal(byState.get('PLANNED_DOWNTIME'), 60, `PLANNED bucket ${bucket}`);
    assert.equal(byState.get('UNPLANNED_DOWNTIME'), 32, `UNPLANNED bucket ${bucket}`);
    assert.equal(segs.reduce((acc, s) => acc + s.duration_min, 0), 480, `total bucket ${bucket}`);
    // Gapless: ujung satu segmen = awal segmen berikut, 07:00–15:00.
    assert.equal(segs[0].start, '2026-11-11T07:00:00+07:00', `awal bucket ${bucket}`);
    assert.equal(segs[segs.length - 1].end, '2026-11-11T15:00:00+07:00', `akhir bucket ${bucket}`);
    for (let i = 1; i < segs.length; i++) {
      assert.equal(segs[i].start, segs[i - 1].end, `celah bucket ${bucket} idx ${i}`);
    }
    // Tidak ada segmen yang melewati batas bucket.
    const bm = bucketMin[bucket];
    for (const s of segs) {
      assert.equal(
        Math.floor(toMin(s.start) / bm),
        Math.floor((toMin(s.end) - 1) / bm),
        `segmen ${s.start}–${s.end} melewati batas bucket ${bucket}`
      );
    }
  }
});

test('Demo rekonsiliasi: bucket mengubah segmentasi (bukan segmen yang sama untuk semua bucket)', async () => {
  const counts: Record<string, number> = {};
  for (const bucket of ['1m', '5m', '15m', '1h'] as const) {
    counts[bucket] = (await apiClient.getShiftTimeline('CNC-MILLING-01', bucket)).length;
  }
  // 480 menit / bucket + 1 pecahan di batas state 09:47 (5m/15m).
  assert.deepEqual(counts, { '1m': 480, '5m': 97, '15m': 33, '1h': 10 });
});

test('Demo rekonsiliasi: Σ hourly_run_sec/operating = shift summary; downtime per jam diturunkan dari operating−run (E12 T12.14)', async () => {
  const summary = await apiClient.getShiftSummary('CNC-MILLING-01');
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  const runSec = hourly.reduce((acc, p) => acc + (p.hourly_run_sec ?? 0), 0);
  const opSec = hourly.reduce((acc, p) => acc + (p.hourly_operating_sec ?? 0), 0);
  assert.equal(runSec, summary.run_time_min * 60); // 23.280 dtk = 388 mnt
  assert.equal(opSec, summary.operating_time_min * 60); // 25.200 dtk = 420 mnt
  // E12 T12.6a (Opsi A / FAT-70): Σ parts per jam = ringkasan (334/328/6).
  const totalParts = hourly.reduce((acc, p) => acc + (p.parts_produced ?? 0), 0);
  const goodParts = hourly.reduce((acc, p) => acc + (p.good_count ?? 0), 0);
  const defectParts = hourly.reduce((acc, p) => acc + (p.defect_count ?? 0), 0);
  assert.equal(totalParts, summary.total_parts); // 334
  assert.equal(goodParts, summary.good_parts); // 328
  assert.equal(defectParts, summary.defect_parts); // 6
  // E12 T12.14 (F-10 / FAT-66): `hourly_downtime_sec` DIHAPUS dari tipe +
  // seed — downtime per jam diturunkan dari data yang tersisa:
  // operating − run. Turunan ini hanya menangkap downtime UNPLANNED
  // (Σ 1.920 dtk = 32 mnt): jam 12:00 yang sepenuhnya planned punya
  // operating 0 (gap G8) sehingga planned-nya tidak tertangkap turunan
  // ini. Σ downtime penuh 92 mnt (5.520 dtk = planned 60 + unplanned 32)
  // sumber kebenarannya ada di downtime_events — dt-ev-02 (1.920 dtk) +
  // dt-ev-04 (3.600 dtk), dibuktikan pada test 'event downtime cocok'
  // di bawah, bukan lagi dari titik per jam.
  const derivedDowntimeByHour = new Map(
    hourly.map((p) => [p.bucket, (p.hourly_operating_sec ?? 0) - (p.hourly_run_sec ?? 0)])
  );
  assert.deepEqual(
    [...derivedDowntimeByHour.entries()],
    [
      ['2026-11-11T07:00:00+07:00', 350],
      ['2026-11-11T08:00:00+07:00', 274],
      ['2026-11-11T09:00:00+07:00', 216],
      ['2026-11-11T10:00:00+07:00', 360],
      ['2026-11-11T11:00:00+07:00', 252],
      ['2026-11-11T12:00:00+07:00', 0], // jam planned penuh: operating 0 (G8), turunan 0
      ['2026-11-11T13:00:00+07:00', 180],
      ['2026-11-11T14:00:00+07:00', 288],
    ]
  );
  const derivedDtSec = [...derivedDowntimeByHour.values()].reduce((acc, v) => acc + v, 0);
  assert.equal(derivedDtSec, summary.unplanned_downtime_min * 60); // 1.920 dtk = 32 mnt
  for (const v of derivedDowntimeByHour.values()) {
    assert.ok(v >= 0, 'downtime turunan per jam tidak boleh negatif');
  }
});

test('Demo rekonsiliasi: jam 12:00 tidak diubah (sepenuhnya planned, gap G8)', async () => {
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  const noon = hourly.find((p) => p.bucket === '2026-11-11T12:00:00+07:00');
  assert.ok(noon);
  assert.equal(noon.hourly_operating_sec, 0);
  assert.equal(noon.hourly_run_sec, 0);
  // E12 T12.14 (F-10 / FAT-66): tidak ada lagi `hourly_downtime_sec`
  // (dulu 3600). Downtime 3.600 dtk jam ini sumber kebenarannya adalah
  // downtime event dt-ev-04 (12:00–13:00) — dibuktikan pada test
  // 'event downtime cocok' di bawah.
  assert.equal(noon.availability, 0);
  assert.equal(noon.state, 'PLANNED_DOWNTIME');
});

test('E12 T12.14: titik hourly seed tidak lagi membawa hourly_downtime_sec', async () => {
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  assert.equal(hourly.length, 8);
  for (const p of hourly) {
    assert.ok(!('hourly_downtime_sec' in p), `jam ${p.hour} tidak boleh membawa hourly_downtime_sec`);
  }
});

test('Demo rekonsiliasi: availability tiap jam konsisten dengan run/operating', async () => {
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  for (const p of hourly) {
    const opSec = p.hourly_operating_sec ?? 0;
    if (opSec === 0) continue; // jam 12:00, G8
    const expected = Math.round(((p.hourly_run_sec ?? 0) / opSec) * 1000) / 10;
    assert.equal(p.availability, expected, `availability jam ${p.hour}`);
  }
});

test('Demo rekonsiliasi: event downtime cocok dengan segmen timeline (durasi + waktu)', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m');
  const unplanned = segs.filter((s) => s.downtime_id === 'dt-ev-02');
  assert.equal(unplanned.reduce((acc, s) => acc + s.duration_min, 0), 32);
  assert.equal(unplanned[0].start, '2026-11-11T09:15:00+07:00');
  assert.equal(unplanned[unplanned.length - 1].end, '2026-11-11T09:47:00+07:00');
  const planned = segs.filter((s) => s.downtime_id === 'dt-ev-04');
  assert.equal(planned.reduce((acc, s) => acc + s.duration_min, 0), 60);
  assert.equal(planned[0].start, '2026-11-11T12:00:00+07:00');
  assert.equal(planned[planned.length - 1].end, '2026-11-11T13:00:00+07:00');

  // Jalur yang dipakai overlay timeline (useOeeAnalytics): histori
  // downtime perangkat pada jendela 7 hari default halaman OEE.
  const page = await apiClient.getDowntimeHistoryPage(
    {
      device_id: 'STM32-OEE-01',
      from: '2026-11-09T00:00:00+07:00',
      to: '2026-11-16T23:59:00+07:00',
      limit: 50,
      envelope: true,
    },
    undefined
  );
  const ev02 = page.data.find((d) => d.id === 'dt-ev-02');
  const ev04 = page.data.find((d) => d.id === 'dt-ev-04');
  assert.ok(ev02, 'dt-ev-02 harus ditemukan pada histori STM32-OEE-01');
  assert.ok(ev04, 'dt-ev-04 harus ditemukan pada histori STM32-OEE-01');
  assert.equal(ev02.duration_seconds, 32 * 60);
  assert.equal(ev02.started_at, '2026-11-11T09:15:00+07:00');
  assert.equal(ev02.ended_at, '2026-11-11T09:47:00+07:00');
  assert.equal(ev04.duration_seconds, 60 * 60);
  assert.equal(ev04.started_at, '2026-11-11T12:00:00+07:00');
  assert.equal(ev04.ended_at, '2026-11-11T13:00:00+07:00');

  // E12 T12.14 (F-10 / FAT-66): Σ downtime penuh shift dibuktikan dari
  // sumber kebenaran (downtime_events), bukan dari titik per jam yang
  // field-nya sudah dihapus: 1.920 + 3.600 = 5.520 dtk = 92 mnt
  // (planned 60 + unplanned 32).
  assert.equal(ev02.duration_seconds + ev04.duration_seconds, (60 + 32) * 60);
});

test('Demo rekonsiliasi: rollup machine bucket null (dokumen API, gap G21)', async () => {
  const page = await apiClient.getTelemetryRollup({
    group_by: 'machine',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 20,
    envelope: true,
  });
  assert.ok(page.data.length > 1);
  for (const row of page.data) {
    assert.equal(row.bucket, null, `bucket baris ${row.groupKey} harus null`);
  }
});
