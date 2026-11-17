# DRAFT — Epic E12: Lanjutan Perbaikan Telemetry & OEE

**Status:** DISETUJUI Fathur 2026-11-17 — Epic E12 (FAT-50) + T12.1–T12.19
(FAT-51–FAT-69) dibuat di Linear. Cakupan: admin-panel saja; infra (konfigurasi
Nginx) dan backend dikecualikan.
**Tanggal:** 2026-11-17
**Acuan:** `docs/TELEMETRY_AUDIT.md` (audit 2026-11-16 malam, 25 gap, 24 usulan),
`docs/LINEAR.md` §1.3, `AUDIT.md` §13–§14.

## Konteks

E11 (FAT-43, T11.1–T11.6) selesai 2026-11-16 malam: keempat gap Tinggi (G1–G4)
tertutup, 117/117 test hijau, checker 0 FAIL, push `bec4c8a`, Linear 35 Done /
3 In Progress / 7 Todo. Yang tersisa dari audit: **19 usulan** (F-5–F-13, X-1–X-6,
U-2–U-5) untuk gap G5–G24. Semuanya dalam scope panel, kecuali catatan server di
F-7/G8 dan G25 (butuh backend — tetap di luar scope).

Satu sisa E11 yang belum tertutup dan perlu diselidiki: **Σ parts hourly vs
summary masih selisih (334 vs 350)** — dicatat di `AUDIT.md` §14 sebagai batasan
di luar scope E11. Diusulkan masuk Wave 1 sebagai investigasi (lihat T12.6).

## Wave 1 — diusulkan dikerjakan dulu (6 issue)

| # | Usulan | Gap | Inti pekerjaan |
|---|--------|-----|----------------|
| T12.1 | X-1 Filter shift (tanggal + shift) | G19, G1 | Filter shift di Telemetry History + halaman OEE; kirim `date`/`shift`/`from`/`to` yang disejajarkan dengan jam shift. "Shift 1 kemarin" jadi satu klik, bukan hitung manual + edit URL. |
| T12.2 | F-5 Tab Aggregate menampilkan deret per-bucket | G6, G12 | Kembalikan seluruh `rows` dari `getTelemetryAggregate` (bukan `rows[0]`), render tabel/grafik per bucket + flag `provisional` per baris. |
| T12.3 | F-6 Kolom tabel per jam + samakan presisi | G9 | Tampilkan `good_count`, `hourly_operating_sec`, `hourly_run_sec`, `sampleCount` di `OeeHourlyTable`; presisi 2 desimal; samakan perlakuan kapasitas unknown dengan rollup ("— (Kapasitas 0/Unknown)"). |
| T12.4 | F-7 Perbaiki pemetaan planned downtime (sisi panel) | G7, G8 | Mapper membaca `time_sec.planned` bila backend mengirimnya (bukan hardcode `0`); `planned_production_time_min` dari field-nya sendiri. Keputusan definisi server (jam planned penuh dikeluarkan dari penyebut availability vs 0%) disepakati dulu dengan tim backend sebelum bagian server. |
| T12.5 | U-2 Empty / loading / error state | G17 | Hook mengembalikan `isLoading`/`isError`; tabel menampilkan "Tidak ada data pada rentang ini" vs "Gagal memuat" vs skeleton; kartu ringkasan tidak hilang begitu saja. Sesuai Guide §5. |
| T12.6 | U-3 Indikator rekonsiliasi + investigasi selisih parts | G2 | Catatan kaki di halaman OEE: Σ `hourly_run_sec` vs `run_time_min` vs Σ durasi timeline per state; peringatan bila selisih > ambang. Termasuk investigasi selisih Σ parts hourly vs summary (334 vs 350) yang tersisa dari E11. |

## Wave 2 — fungsionalitas & fleksibilitas lanjutan (7 issue)

| # | Usulan | Gap |
|---|--------|-----|
| T12.7 | F-8 Samakan kolom ekspor dengan layar (+ ekspor rollup) | G5, G22 |
| T12.8 | F-9 Delegasikan builder endpoint ke registry | G14 |
| T12.9 | X-2 Kontrol periode (date-range picker) di halaman OEE | G1, G19 |
| T12.10 | X-3 Toggle scope rollup: mesin ini / semua mesin | G4 |
| T12.11 | X-4 Zona waktu tunggal `Asia/Jakarta` + label sumbu waktu timeline | G11 |
| T12.12 | X-5 Flag `provisional` konsisten di semua tampilan | G12 |
| T12.13 | X-6 Downtime overlay: "menampilkan N dari M" + paginasi | G18 |

## Wave 3 — kerapian & konsistensi (6 issue)

| # | Usulan | Gap |
|---|--------|-----|
| T12.14 | F-10 Hapus `hourly_downtime_sec` (field hantu) dari tipe, seed, CSV | G16 |
| T12.15 | F-11 Perbaiki mapping `cycle_time_ms` berdasarkan satuan field | G20 |
| T12.16 | F-12 Perbaiki komentar `refetchAll` + `isRefreshing` mencakup semua query | G10 |
| T12.17 | F-13 Reset pilihan segmen saat ganti bucket timeline | G13 |
| T12.18 | U-4 Samakan default dengan dokumen, atau catat deviasinya | G15 |
| T12.19 | U-5 Satu tampilan kanonis OEE per jam + tautan silang | G23 |

## Di luar scope E12 (tetap dicatat, bukan pekerjaan panel)

- **G25 — state FSM `SETUP`/`IDLE`:** butuh backend (enum FSM, skema MQTT, CAgg).
  Tanpa ini program SMED tidak bisa diukur dari data.
- **G8 sisi server:** definisi availability untuk jam planned penuh — keputusan
  backend/CAgg, perlu disepakati sebelum F-7 bagian server.
- **G24:** inkonsistensi transport (`getOeeHourly` tanpa `assertAuthenticatedHttp`)
  — diizinkan dokumen §H (open read-only); hanya kerapian, tidak diusulkan
  sebagai issue kecuali Fathur meminta.

## Kriteria selesai (per issue, pola E11)

`tsc` 0 error, test hijau (test baru untuk perilaku yang diubah), build OK,
preview HTTP 200, checker struktur 0 FAIL, commit per fix, issue Linear Done
hanya setelah verifikasi independen.

## Langkah bila disetujui ("lanjut") — DISETUJUI 2026-11-17

1. Buat Epic E12 di Linear (parent) + T12.1–T12.6 sebagai child, label `fase-3`.
2. Perbarui `docs/linear-seed.json` + `docs/LINEAR.md` §1.1/§1.3/§8.
3. Implementasi Wave 1 satu fix demi satu fix (urut T12.1 → T12.6), verifikasi
   per fix, commit per fix; Wave 2/3 dibuatkan issue-nya setelah Wave 1 selesai
   (atau sekaligus bila Fathur minta semua 19 langsung).
4. Cek kecil yang ikut diselesaikan: status Epic E11 (FAT-43) di Linear —
   keenam child-nya Done, jadi epic-nya bisa ditutup bila belum.

## Yang TIDAK dilakukan dalam draft ini — diperbarui 2026-11-17

Tidak ada perubahan codebase (implementasi Wave 1–3 berjalan setelah
persetujuan). Issue Linear E12 + T12.1–T12.19 sudah dibuat; Epic E11
(FAT-43) ditutup karena keenam child-nya Done.
