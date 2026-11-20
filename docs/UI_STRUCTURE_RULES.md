# Aturan Struktur UI — IIoT OEE Admin Panel

**Status:** berlaku sejak 2026-11-20 (Epic E31, audit struktur UI)
**Pasangan:** `docs/DIRECTORY_STRUCTURE.md` (kontrak R9 — anggaran baris +
penegakan checker) — dokumen ini **melengkapi, bukan mengganti** kontrak itu.
Kontrak R9 mengatur *ukuran* file; dokumen ini mengatur *bentuk* UI:
pemisahan komponen, pemakaian ulang, dan modular per halaman.

**Baseline audit 2026-11-20** (`~/workspace/ui-audit-findings.md`,
338 file / 62.289 baris, checker 0 FAIL): 43 file melewati batas lunak;
6 file tinggal 1–16 baris lagi dari FAIL checker; `DataTable` dipakai 5
file vs 16 tabel hand-rolled; `ui/Select` dipakai 1 file vs 29 file pakai
`<select>` mentah; `LoadErrorBanner` 5 pemakai vs error inline di 10 file;
`EmptyStateBlock` 2 pemakai vs "Tidak ada data" di 18 tempat; 4 halaman
CRUD production adalah klon kerangka yang sama; aturan 5 kontrak
(larangan import lintas-fitur) BERSIH — 0 pelanggaran.

---

## 1. Prinsip

1. **Page hanya orkestrasi.** `*Page.tsx` memuat data (lewat hook),
   menyusun layout, dan me-render. Tabel, form, modal, tab, dan filter
   tinggal di `components/`; alur data tinggal di `hooks/`.
2. **Reusable dulu, hand-rolled terakhir.** Sebelum menulis JSX baru,
   cek `components/ui/`, `components/industrial/`, dan
   `features/shared/` — bila polanya sudah ada, pakai. Bypass hanya
   dengan alasan tercatat di komentar (bukan karena kebiasaan).
3. **Satu concern per file.** Satu file = satu komponen, satu hook,
   satu domain. File jamak (`*Modals.tsx`, `*Dialogs.tsx`) dilarang
   untuk kode baru; yang lama dipecah saat disentuh.
4. **Satu sumber kebenaran.** Format, konstanta, dan pola tampil
   didefinisikan sekali di tempat bersama (§4) — bukan literal yang
   disalin ke tiap file.
5. **Pecah sebelum batas keras.** File yang sisa <50 baris ke batas
   keras wajib dipecah dulu sebelum fitur baru ditambahkan ke file itu.

---

## 2. Aturan

### R1. Semua tabel pakai `DataTable`

`components/industrial/DataTable.tsx` (loading / error / empty /
skeleton / cursor pagination / row-click, berbasis tanstack
`ColumnDef`) adalah satu-satunya cara menampilkan tabel. Pengecualian:
kolom butuh render kustom yang tidak didukung `ColumnDef` — alasannya
ditulis sebagai komentar di atas tabel dan dicatat di issue Linear.
*Alasan:* 16 tabel hand-rolled mengulang thead/tbody + state
loading/error/empty sendiri (audit §4.3a).

### R2. Semua `<select>` pakai `ui/Select`

Tidak ada `<select>` mentah di `features/`. `components/ui/Select.tsx`
menyediakan label + error + hint yang konsisten.
*Alasan:* 29 file pakai `<select>` mentah, `ui/Select` hanya 1 pemakai.

### R3. Error / empty / loading pakai komponen shared

- Error: `features/shared/LoadErrorBanner.tsx` (atau pola setara di
  `components/` bila sudah dipindah — lihat R7).
- Kosong: `features/shared/EmptyStateBlock.tsx` — tanpa string
  "Tidak ada data" inline.
- Loading: skeleton `DataTable` untuk tabel; untuk non-tabel, spinner
  / teks loading mengikuti pola yang sama di tiap halaman (jangan
  karang varian baru).
*Alasan:* error inline di 10 file, empty-state di 18 tempat, string
"Memuat/Loading" di 72 tempat tanpa komponen bersama.

### R4. Satu hook = satu alur data

Hook melayani satu tab / satu query / satu alur. Hook yang melayani
>1 tab/query dipecah per tab/query. Hook **dilarang** menampung state
modal — state modal tinggal di komponen modal itu sendiri.
*Alasan:* `useBrokerConfig` (5 alur, 16 useState, 249/250 baris) dan
`useOeeAnalytics` (5 query domain, 247/250 baris) nyaris memecahkan
checker; keduanya melayani banyak tab sekaligus.

### R5. Komponen tinggal di `components/`

File `.tsx` komponen **dilarang** di root fitur — pindah ke
`features/<domain>/components/`. Helper non-komponen tinggal di
`features/<domain>/utils/` (atau `helpers/`); bila dipakai >1 fitur,
pindah ke `features/shared/` dengan subfolder yang benar (R7).
*Alasan:* `DeviceDetailModal`, `DeviceHealthDrawer`,
`DowntimeReasonModal`, `BackendHealthIndicator` masih di root fitur;
7 helper longgar di root `features/analytics/`.

### R6. Satu format tanggal

`utils/formatDate.ts` (`formatDateTime`, `formatRelativeAge`) adalah
satu-satunya pemformat tanggal tampil (zona Asia/Jakarta).
`toLocaleString()` mentah dilarang di `features/`.
*Alasan:* `toLocaleString()` mentah di 21 file; `formatJakartaDateTime`
di `utils/historicalExport` hanya dipakai halaman histori.

### R7. Satu `FilterBar` generik

Filter halaman baru memakai komponen filter bersama (label + select +
search + reset) di `components/industrial/` — bukan `*FilterBar` baru.
Empat `*FilterBar` lama + `OperatorsToolbar` + `OperationalEventsFilters`
digabung bertahap ke komponen ini.
*Alasan:* satu pola, enam implementasi (audit §4.3e).

### R8. Page hanya orkestrasi (target, bukan sekadar warning)

Tabel / form / modal / tab **dilarang inline** di `*Page.tsx`.
Batas lunak page 400 baris diperlakukan sebagai **target refactor**:
page yang melewatinya masuk daftar refactor (P2), bukan sekadar
warning yang dibiarkan.
*Alasan:* 4 halaman CRUD production (379–454 baris) menanam tabel +
form modal inline dengan kerangka identik; `DowntimeEventsPage`
584 baris menanam ekspor + definisi kolom.

### R9. Pecah dulu file di ambang batas keras

File yang sisa <50 baris ke batas keras wajib dipecah **sebelum**
fitur baru ditambahkan ke file itu (bukan sesudah checker FAIL).
Daftar pantauan berjalan: `useBrokerConfig` (249/250),
`useOeeAnalytics` (247/250), `TelemetryTabPanels` (296/300),
`DowntimeEventsPage` (584/600), `modeAndTransport.test.ts`
(792/800), `AuthContext` (282/300).
*Alasan:* edit berikutnya ke file-file ini kemungkinan besar
memecahkan `npm run lint`.

### R10. Satu file skema / type / mapper = satu domain

`schemas/dto.ts`, `types/*.ts`, `mappers/*.ts` tidak boleh lintas
domain — pecah per domain seperti `endpoints/` dan `demo/` yang sudah
benar. Aturan ini di luar UI murni, tapi menghambat modularitas
halaman (page mengimpor skema/type dari file god-domain).
*Alasan:* `dto.ts` 540 baris menampung skema semua domain;
`types/mqtt.ts` 396 baris mencampur DynSec + broker config;
`mappers/monitoring.ts` 531 baris mencampur monitoring + downtime
+ telemetry.

---

## 3. Anatomi halaman modular (target)

```
features/<domain>/
├── <Domain>Page.tsx            # orkestrasi saja (≤ 400 baris):
│                              # use<Domain> + layout + <Komponen/>
├── components/
│   ├── <Domain>Table.tsx      # satu tabel (pakai DataTable, R1)
│   ├── <Domain>FormModal.tsx  # satu form modal
│   ├── <Domain>FilterBar.tsx  # HANYA bila FilterBar generik (R7)
│   │                         # belum mencakup kasusnya — jika tidak,
│   │                         # pakai komponen generik
│   └── <Domain>DetailModal.tsx
├── hooks/
│   └── use<Domain>.ts         # satu alur (R4)
└── utils/                     # helper khusus domain (bila ada)
```

Contoh yang sudah benar (dipertahankan): `AccessControlPage.tsx`
(303 baris, 6 tab terpisah — hasil split R9), `WorkOrdersPage.tsx`
(DataTable + FilterBar + DetailModal terpisah), `DevicesPage.tsx` /
`MachinesPage.tsx` (modal terpisah), `TelemetryHistoryPage.tsx`
(kolom/tab/filter terpisah).

Contoh yang harus diperbaiki dulu (P0–P2): `DowntimeEventsPage`,
4 halaman CRUD production, `OverviewPage` (tabel rollup inline),
`Topbar` (form ganti password inline).

---

## 4. Katalog reusable (pakai dulu)

| Komponen | Lokasi | Untuk |
|---|---|---|
| `Button`, `Badge`, `Modal`, `Input`, `Select`, `ConfirmationDialog`, `ConflictDialog` | `components/ui/` | Semua halaman (adopsi Button/Badge/Modal/Input sudah penuh; **Select wajib — R2**) |
| `DataTable`, `CursorPaginationBar` | `components/industrial/` | Semua tabel (**wajib — R1**) |
| `MetricCard`, `MachineStateBadge` | `components/industrial/` | Kartu metrik, badge status FSM/online |
| `HistoricalExportToolbar` | `components/industrial/` | Ekspor halaman histori (jangan tulis logika ekspor di Page) |
| `LoadErrorBanner`, `EmptyStateBlock`, `TableStateRow` | `features/shared/` | Error / empty / state tabel (**wajib — R3**; lihat R7 soal penataan ulang `shared/`) |
| `formatDateTime`, `formatRelativeAge` | `utils/formatDate.ts` | Semua tanggal tampil (**wajib — R6**; dibuat di E31.8) |
| `FilterBar` (generik) | `components/industrial/` | Semua filter halaman (**wajib — R7**; dibuat di E31.9) |

Bila komponen yang dibutuhkan belum ada di katalog, buat di
`components/ui/` (generik) atau `components/industrial/` (bernuansa
industri) — **bukan** di dalam file Page atau di root fitur.

---

## 5. Penegakan

| Aturan | Cara cek |
|---|---|
| Anggaran baris (kontrak R9) | `npm run check:structure` — otomatis, gagal bila lewati keras |
| R1–R3, R6 (larangan pola) | Review: grep `<table`, `<select`, `toLocaleString()`, `Tidak ada data`, `bg-red-50` di `features/` harus mengarah ke komponen shared (atau komentar pengecualian) |
| R4, R5, R8, R10 | Review: Page >400 baris / hook multi-alur / komponen di root fitur = temuan refactor, masuk daftar P2 |
| R9 | Daftar pantauan §2-R9 diperbarui tiap audit; file di daftar tidak boleh menerima fitur baru sebelum dipecah |

Pengecualian harus tercatat seperti kontrak R9 §4: di `EXCEPTIONS`
checker + nomor issue Linear (status `Todo`).

---

## 6. Roadmap refactor (Epic E31)

| Prioritas | Isi | Tiket Linear |
|---|---|---|
| P0 — mendesak (ambang FAIL) | Pecah `useBrokerConfig`, `useOeeAnalytics`, `TelemetryTabPanels`, `DowntimeEventsPage` | E31.2–E31.5 |
| P1 — fondasi reusable | `ui/Select`, `LoadErrorBanner` + `EmptyStateBlock`, `utils/formatDate.ts`, `FilterBar` generik, audit adopsi `DataTable` | E31.6–E31.10 |
| P2 — modular per halaman | CRUD production, Overview + Monitoring, Layouts + Auth, Analytics + System + Assets + MQTT | E31.11–E31.14 |
| P3 — layanan/tipe | Pecah `dto.ts` + `types/mqtt.ts` + mappers, `telemetrySocket`, `historyFilters`, rapikan `features/shared/` | E31.15–E31.16 |

Urutan kerja yang disarankan: **P0 dulu** (mencegah checker FAIL),
lalu **P1** (fondasi dipakai semua halaman), lalu **P2** per domain,
**P3** terakhir. Tiap tiket refactor diverifikasi seperti biasa
(`tsc` 0, tes hijau, build OK, checker 0 FAIL) + tidak mengubah
perilaku halaman.
