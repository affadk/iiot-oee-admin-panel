# Kontrak Directory Structure — IIoT OEE Admin Panel

**Status:** berlaku sejak 2026-11-16 (refactoring R9, lihat Linear Epic E9)
**Penegakan:** `npm run check:structure` (`scripts/check-directory-contract.mjs`) —
gagal (exit 1) bila ada file melewati batas keras. Jalankan juga lewat `npm run lint`.

> Aturan ini lahir dari audit 2026-11-16: 81 file, 34.784 baris, dengan 3 god-file
> (`client.ts` 4.602, `httpClient.ts` 3.371, `AccessControlPage.tsx` 2.001) yang
> membuat setiap perubahan mahal dan rawan salah. Kontrak ini menjaga supaya
> god-file tidak tumbuh lagi.

---

## 1. Riset: berapa baris ideal per file?

| Sumber | Angka |
| --- | --- |
| Robert C. Martin, *Clean Code* Bab 5 (Vertical Formatting) | File **jarang > 500 baris**; sweet spot **100–200 baris** |
| Pedoman umum ukuran kode (2026) | Optimal **100–300 baris**, maksimum **500 baris**; > 500 = kandidat split |
| Praktik route/component (React) | Satu file route/komponen **di bawah 500 baris**; 500 sengaja longgar — file 2.000 baris bukan buruk karena angkanya, tapi karena ia menahan page + sub-komponen + transform + form yang tak bisa dibaca/diuji/dipakai ulang sendiri-sendiri |
| Fungsi (Clean Code / Code Complete) | Optimal **5–20 baris**, maksimum **50 baris** tanpa justifikasi |

Angka-angka di bawah adalah terjemahan riset itu ke repo ini: **batas lunak**
(warning — pertimbangkan split saat menyentuh file) dan **batas keras**
(checker gagal — wajib split, kecuali masuk daftar pengecualian §4).

## 2. Anggaran baris per folder

| Folder / pola | Lunak | Keras | Catatan |
| --- | --- | --- | --- |
| `src/features/<domain>/*.tsx` (page) | 400 | 600 | Page hanya orkestrasi: load data + render. Tab/modal/form pindah ke `components/`, logika ke `hooks/` |
| `src/features/<domain>/components/*` | 200 | 300 | Satu komponen = satu concern (satu tab, satu modal, satu tabel) |
| `src/features/<domain>/hooks/*` | 150 | 250 | Satu hook = satu alur data (load + mutasi + state turunan) |
| `src/features/shared/*` | 300 | 500 | Utilitas antar-fitur, bukan halaman |
| `src/services/api/demo/*`, `src/services/api/http/*`, `src/services/api/schemas/*` | 400 | 600 | Satu file = satu domain (auth, devices, machines, …) |
| `src/services/api/seeds/*`, `src/services/api/endpoints/*` | 500 | 900 | Data/registry bersifat tabular dan kohesif — tetap dipecah per domain |
| `src/services/api/*.ts` (barrel/konfigurasi) | 150 | 300 | Barrel hanya komposisi + re-export, **tanpa logika bisnis**. Pengecualian: `mode.ts` (konfigurasi env, 300/500) |
| `src/services/ws/*` | 300 | 500 | Satu client socket + simulasinya |
| `src/utils/*`, `src/utils/capabilities/*` | 300 | 500 | Satu concern per file (engine, spesifikasi, validator, jaringan) |
| `src/types/*` | 300 | 500 | Satu file = satu domain |
| `src/context/*` | 200 | 300 | Satu context = satu concern (auth, tema, jaringan) |
| `src/components/*` | 250 | 350 | Komponen generik yang dipakai lintas fitur |
| `src/layouts/*` | 250 | 400 | Layout + Topbar/Sidebar |
| `src/app/*`, `src/*.tsx` | 150 | 250 | Router + entry point |
| **File test** (`*.test.ts(x)`) | 500 | 800 | Panjang karena data kasus uji; tetap satu file per modul yang diuji |
| **Fungsi** (aturan review, belum dicek otomatis) | 20 | 50 | Fungsi > 50 baris wajib dipecah atau diberi alasan di PR/komentar |

## 3. Struktur direktori target

```
src/
├── App.tsx / main.tsx            # entry point saja
├── app/
│   └── Router.tsx                # definisi route (§5 Guide), tanpa logika halaman
├── layouts/                      # AdminLayout, Topbar, Sidebar, Breadcrumbs
├── context/                      # AuthContext, ThemeContext, NetworkAccessContext
├── components/
│   ├── ui/                       # Button, Modal, Input, Select, … (generik)
│   └── industrial/               # DataTable, MetricCard, … (generik bernuansa industri)
├── features/
│   ├── auth/                     # LoginPage
│   ├── overview/                 # OverviewPage
│   ├── production/               # Products, Operators, WorkOrders, Lines, Shifts, Schedules
│   │   ├── <Domain>Page.tsx      # page (orkestrasi saja, ≤ 600 baris)
│   │   ├── components/           # <Domain><Tab|Modal|Table>.tsx (≤ 300 baris)
│   │   └── hooks/                # use<Domain>.ts (≤ 250 baris)
│   ├── assets/                   # Devices, Machines
│   ├── monitoring/               # LiveState, Downtime, OperationalEvents
│   ├── analytics/                # OEE, Telemetry, Reconciliation, Quality
│   ├── system/                   # AccessControl, AuditTrail, SystemHealth, SystemInfo
│   ├── mqtt/                     # Broker, DynamicSecurity
│   └── shared/                   # historyFilters, useHistoricalQueries (lintas fitur)
├── services/
│   ├── api/
│   │   ├── mode.ts               # SATU sumber kebenaran env (VITE_*) — lihat AUDIT.md §8
│   │   ├── endpoints/            # registry 131 endpoint, SATU FILE PER DOMAIN
│   │   │   ├── definition.ts     # EndpointDefinition + enc()
│   │   │   ├── auth.ts  devices.ts  machines.ts  …  mqtt.ts
│   │   │   └── index.ts          # gabung → ADMIN_ENDPOINTS (dipakai client + http)
│   │   ├── schemas/              # Zod DTO, SATU FILE PER LAPIS/DOMAIN
│   │   │   ├── transport.ts      # error envelope, retry, normalisasi list
│   │   │   ├── dto.ts            # skema DTO per domain
│   │   │   └── index.ts
│   │   ├── seeds/                # data demo, SATU FILE PER DOMAIN (INITIAL_*)
│   │   │   ├── production.ts  devices.ts  operators.ts  monitoring.ts  mqtt.ts  system.ts …
│   │   │   └── index.ts
│   │   ├── demo/                 # implementasi Demo (store in-memory), SATU FILE PER DOMAIN
│   │   │   ├── store.ts          # MemoryStore + singleton store
│   │   │   ├── helpers.ts        # assert*, validator, generator (dipakai semua domain)
│   │   │   ├── auth.ts  devices.ts  machines.ts  …  iam.ts  mqtt.ts
│   │   │   └── index.ts          # gabung → demoApiClient
│   │   ├── http/                 # implementasi Real (fetch), SATU FILE PER DOMAIN
│   │   │   ├── transport.ts      # fetchRaw, reqJson/reqList/reqExport, state token
│   │   │   ├── primitives.ts     # num/str/bool/iso, splitList, pageMeta, mustParse
│   │   │   ├── mappers/          # backend→lokal, SATU FILE PER DOMAIN
│   │   │   ├── auth.ts  devices.ts  machines.ts  …  iam.ts  mqtt.ts
│   │   │   └── index.ts          # gabung → httpApiClient
│   │   ├── client.ts             # BARREL: demoApiClient + selector apiClient (tanpa logika)
│   │   ├── httpClient.ts         # BARREL: httpApiClient (tanpa logika)
│   │   ├── endpoints.ts          # BARREL: ADMIN_ENDPOINTS + FORBIDDEN_ENDPOINT_PATTERNS
│   │   ├── schemas.ts            # BARREL: re-export schemas/*
│   │   └── mockData.ts           # BARREL: re-export seeds/* (nama dipertahankan untuk kompatibilitas)
│   └── ws/
│       └── telemetrySocket.ts    # SATU client WebSocket + simulasi demo
├── types/                        # SATU FILE PER DOMAIN (assets, production, mqtt, iam, …)
└── utils/
    ├── capabilities/             # engine, specs, casbin, validators, network — SATU CONCERN PER FILE
    │   └── index.ts              # barrel (nama import lama tetap jalan)
    ├── capabilities.ts           # BARREL: re-export utils/capabilities/*
    ├── historicalExport.ts       # builder endpoint + serialisasi ekspor
    └── oeeCalculations.ts        # kalkulasi OEE + guard mutasi
```

## 4. Aturan penulisan kode

1. **Satu concern per file.** File yang berisi dua concern (mis. engine capability +
   validator form) dipecah. Nama file = concern-nya.
2. **Satu domain per modul API.** Method `demo` dan `http` untuk satu domain tinggal
   di file domain yang sama namanya (`demo/devices.ts` ↔ `http/devices.ts`) dan
   **urutannya sama** di kedua sisi (dulu urutan domain demo vs HTTP berbeda —
   itu yang membuat audit sulit).
3. **Barrel hanya komposisi.** `client.ts`, `httpClient.ts`, `endpoints.ts`,
   `schemas.ts`, `mockData.ts`, `capabilities.ts` hanya menggabung + re-export.
   Logika bisnis di barrel = pelanggaran kontrak.
4. **Tanpa `this.` antar-method.** Method client memanggil sibling lewat nama
   fungsi yang di-import langsung, bukan `this.getXxx()` — supaya method bisa
   pindah file tanpa merusak binding. (Pengecualian lama: 5 pemakaian `this.` di
   `client.ts` + 8 di `httpClient.ts` sudah dihapus pada refactoring R9.)
5. **Tidak ada import lintas-fitur antar-page.** Page hanya import dari
   `components/`, `hooks/`, `services/`, `utils/`, `types/` miliknya sendiri atau
   `features/shared/`. Komponen page lain tidak boleh di-import langsung.
6. **Tidak ada duplikasi sumber kebenaran.** Satu `resolveWsUrl` (di `mode.ts`),
   satu tabel bitmask event-flag, satu definisi path endpoint (di `endpoints/`),
   satu tempat baca env (di `mode.ts`).
7. **Data seed dan registry tetap per domain.** File data boleh panjang (batas
   900) tapi tetap satu domain per file — jangan kembalikan semua seed ke satu file.
8. **Test colocated.** Test unit tinggal di samping file yang diuji
   (`<nama>.test.ts`); test kontrak API di `src/services/api/`.
9. **Pengecualian harus tercatat.** File yang masih melanggar batas keras harus
   ada di `EXCEPTIONS` pada `scripts/check-directory-contract.mjs` dengan nomor
   issue Linear — dan issue-nya harus `Todo`, bukan `Done`.

### Pengecualian yang masih berlaku (per 2026-11-16, issue Linear R9.5)

_Tidak ada pengecualian tersisa — seluruh 11 file R9.5 sudah diekstrak._

## 5. Cara memeriksa

```bash
npm run check:structure   # hitung baris + anggaran per folder; exit 1 bila ada pelanggaran keras
npm run lint              # tsc --noEmit + check:structure
```

Checker menghitung **semua baris** (termasuk import & komentar) — sama seperti
alat ukur umum (Biome `noExcessiveLinesPerFile`). Bila satu file kohesif memang
harus lebih panjang, jawabannya bukan menaikkan anggaran diam-diam: catat
pengecualian di §4 + issue Linear, lalu lanjutkan.

## 6. Referensi riset

- Martin, *Clean Code* Bab 5 — file jarang > 500 baris, sweet spot 100–200.
- Pedoman ukuran kode umum — optimal 100–300 baris/file, maksimum 500.
- Praktik route/component — satu file route/komponen di bawah 500 baris.
- Fungsi — optimal 5–20 baris, maksimum 50 baris.
