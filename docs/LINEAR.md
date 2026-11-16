# Linear — Fondasi Tracking Development IIoT OEE Admin Panel

**Repo:** `fadk-dev/iiot-oee-admin-panel`
**Linear workspace:** Fattr · **Tim:** FAT (`Fattr`, `9b78f1b6-f10f-44ed-9f68-434213b94fca`)
**Project Linear:** `IIoT OEE Admin Panel` (baru — belum ada project di workspace per 2026-11-16)
**Dokumen acuan:** `docs/API_DOCUMENTATION.md` + `docs/admin-panel/ADMIN_PANEL_DOCUMENTATION.md`
(+ file upload asli: `API_DOCUMENTATION.md` 1780 baris, `ADMIN_PANEL_BUILD_GUIDE.md` 1553 baris)
**Status audit terakhir:** `AUDIT.md` — `tsc` 0 error, `npm test` 70/70, `npm run build` sukses
(commit audit `717c9ac` di `main`; tindak lanjut env §8 sudah selesai + push
`7f00adc` di `main`, lokal `59b0316` — lihat F1.2)

> Aturan utama: **Linear adalah satu-satunya sumber kebenaran untuk progress.**
> Chat, `AUDIT.md`, dan commit GitHub adalah bukti pendukung — bukan pengganti
> status di Linear. Tidak ada fitur, bug, atau verifikasi yang "selesai" kalau
> issue-nya di Linear belum `Done` dengan bukti yang tercantum.

---

## 1. Struktur

### 1.1 Satu Project, sebelas Epic

| Epic (parent issue) | Fase Guide | Isi |
| --- | --- | --- |
| E1 Fase 1 — Fondasi | §4.1–4.9 | Env, HTTP client, error, sesi, capability, paginasi |
| E2 Fase 2 — Kerangka UI | §5 | Routes, Sidebar, Topbar, layout |
| E3 Fase 3 — Modul Baca | §6.1–6.8 | Dashboard, Devices, Machines, Products, WO, Downtime, Audit, Telemetri |
| E4 Fase 4 — Modul Tulis | §7.1–7.4 | Mutasi, validasi, konflik 409, preservasi histori |
| E5 Fase 5 — Konsol IAM | §8 | Access Control, 18 rute |
| E6 Fase 6 — Konsol MQTT | §9.1–9.3 | Dynamic Security 23 ops, Broker Config 13 ops, Overview |
| E7 Fase 7 — Realtime | §10 | WebSocket telemetry |
| E8 Verifikasi, Testing & Go-live | §11–15 | A11y/perf, matriks uji §12, deployment §13, DoD §15 |
| E9 Refactoring struktur direktori | — | Kontrak `docs/DIRECTORY_STRUCTURE.md` + checker + pecah god-file per domain |
| E10 Mode Akses Private/Public | D1, §4.1–4.2 | Switch `VITE_ACCESS_MODE` + enforcement + kebutuhan backend (B1–B25) |
| E11 Perbaikan Telemetry & OEE | §6.8, §Q, §K | Audit 2026-11-16: 25 gap Telemetry History / OEE per jam / Timeline Shift — 5 usulan prioritas dalam scope (F-1–F-4, U-1) |

Setiap Epic adalah **parent issue**; modul di bawahnya adalah **child issue**
(`parentId` ke Epic). Tidak ada issue yatim: semua task harus punya parent Epic,
kecuali bug mendesak yang langsung di-link ke Epic yang relevan.

### 1.2 Milestone Project (per Fase)

Milestone di Project Linear = Fase Guide, supaya progress per fase terbaca di
Project Overview:

- M1 Fondasi (§4) · M2 Kerangka UI (§5) · M3 Modul Baca (§6) · M4 Modul Tulis (§7)
- M5 IAM (§8) · M6 MQTT (§9) · M7 Realtime (§10) · M8 Go-live (§11–15)

Target date milestone **tidak diisi** sampai backend tersedia — tanggal palsu
lebih merusak daripada tanpa tanggal. Target diisi saat backend / jadwal
verifikasi sudah nyata.

### 1.3 Daftar issue awal (28 issue: 8 Epic + 20 child)

Status di bawah ini adalah **status benar per 2026-11-16 dari `AUDIT.md`**,
bukan rencana. Yang sudah selesai di mode Demo tetap `Done` — dengan label
`demo` dan catatan "belum terverifikasi mode Real" di deskripsi, bukan
dianggap selesai penuh.

| # | Issue | Parent | Status awal | Prioritas | Label |
| --- | --- | --- | --- | --- | --- |
| E1 | Fase 1 — Fondasi (§4) | — | Done | High | `fase-1`, `demo` |
| F1.1 | Transport HTTP 131 operasi + switch Demo/Real | E1 | Done | High | `fase-1`, `demo`, `real-backend` |
| F1.2 | Env single source of truth (`mode.ts`) + preset login mati di env real + hapus ganti-role | E1 | Done | High | `fase-1`, `env`, `security` |
| F1.3 | Sesi & Auth: login wajib, token hanya di memori, refresh single-flight | E1 | Done | High | `fase-1`, `security` |
| F1.4 | Capability-first UI, paginasi & filter (§4.5, 4.7–4.9) | E1 | Done | Medium | `fase-1`, `demo` |
| E2 | Fase 2 — Kerangka UI (§5) | — | Done | Medium | `fase-2`, `demo` |
| F2.1 | Routes / Sidebar / Layout / Topbar + Network banner | E2 | Done | Medium | `fase-2`, `demo`, `verification` |
| E3 | Fase 3 — Modul Baca (§6) | — | Done | High | `fase-3`, `demo` |
| F3.1 | Dashboard, Live State & Analitik OEE (§6.1) | E3 | Done | High | `fase-3`, `demo` |
| F3.2 | Devices & Machines + bind lifecycle (§6.2–6.3) | E3 | Done | High | `fase-3`, `demo` |
| F3.3 | Products, Work Orders, Operators (§6.4–6.5) | E3 | Done | High | `fase-3`, `demo` |
| F3.4 | Downtime, Operational Events & Audit Sistem (§6.6–6.7) | E3 | Done | Medium | `fase-3`, `demo` |
| F3.5 | Telemetri, Ekspor & Rekonsiliasi (§6.8) | E3 | Done | Medium | `fase-3`, `demo` |
| F3.6 | Master Lines / Shifts / Shift-Schedules — halaman baru (§5, Lamp. L–N) | E3 | Done | High | `fase-3`, `demo`, `feature` |
| E4 | Fase 4 — Modul Tulis (§7) | — | Done | High | `fase-4`, `demo` |
| F4.1 | Mutasi, validasi client, matriks konflik 409, preservasi histori | E4 | Done | High | `fase-4`, `demo` |
| E5 | Fase 5 — Konsol IAM (§8) | — | Done | High | `fase-5`, `demo` |
| F5.1 | Konsol IAM — 18 rute Access Control | E5 | Done | High | `fase-5`, `demo`, `security` |
| E6 | Fase 6 — Konsol MQTT (§9) | — | Done | High | `fase-6`, `demo` |
| F6.1 | Dynamic Security 23 ops + Broker Config 13 ops + Overview | E6 | Done | High | `fase-6`, `demo`, `security` |
| E7 | Fase 7 — Realtime (§10) | — | Done* | Medium | `fase-7`, `demo` |
| F7.1 | WebSocket telemetry + reconnect + simulasi demo 5 dtk | E7 | Done | Medium | `fase-7`, `demo`, `real-backend` |
| E8 | Verifikasi, Testing & Go-live (§11–15) | — | **Todo** | High | `verification` |
| V8.1 | Verifikasi visual di browser sungguhan (3 halaman baru + Topbar) | E8 | **Todo** | High | `verification` |
| V8.2 | Verifikasi Mode Real end-to-end vs backend | E8 | **Todo — Blocked** | High | `verification`, `real-backend`, `blocked` |
| V8.3 | Uji integrasi LAN per modul (Guide §12, 1 alur E2E/modul) | E8 | **Todo — Blocked** | High | `verification`, `real-backend`, `blocked` |
| V8.4 | Deployment Nginx §13 (Vite statis, port 80/8080, CSP, no-store) | E8 | **Todo** | Medium | `deployment` |
| V8.5 | Definition of Done §15 — checklist per modul | E8 | **Todo** | High | `verification`, `docs` |
| E9 | Refactoring struktur direktori & kontrak penulisan kode | — | **In Progress** | High | `docs` |
| R9.1 | Kontrak directory-structure + checker otomatis | E9 | Done | High | `docs` |
| R9.2 | Pecah services/api: mockData, schemas, endpoints per domain | E9 | Done | High | `docs` |
| R9.3 | Pecah client.ts demo + httpClient.ts per domain | E9 | Done | High | `docs` |
| R9.4 | Pecah utils/capabilities.ts per concern | E9 | Done | Medium | `docs` |
| R9.5 | Halaman besar: ekstraksi tab/modal per halaman | E9 | Done | Medium | `docs` |
| R9.6 | Verifikasi refactoring: tsc, tests, build, preview + AUDIT.md | E9 | Done | High | `verification`, `docs` |
| E10 | Mode Akses Private/Public (LAN vs Internet) | — | **In Progress** | High | `security`, `feature` |
| A10.1 | Switch Private/Public di panel (env + enforcement + UI) | E10 | Done | High | `security`, `feature` |
| A10.2 | Kebutuhan backend mode akses (B1–B25, checklist V1–V12) | E10 | **Todo — Blocked** | High | `security`, `real-backend`, `blocked` |
| E11 | Perbaikan Telemetry & OEE (audit 2026-11-16) | — | **In Progress** | High | `fase-3` |
| T11.1 | Kirim from/to (+limit) ke hourly & aggregate Telemetry History | E11 | Done | High | `fase-3` |
| T11.2 | Ikat shift summary + timeline ke periode/shift yang sama | E11 | Done | High | `fase-3` |
| T11.3 | Rollup halaman OEE mengikuti mesin terpilih (atau label scope) | E11 | Done | High | `fase-3` |
| T11.4 | Samakan angka seed demo agar terrekoniliasi | E11 | Done | High | `fase-3`, `demo` |
| T11.5 | Label scope eksplisit di setiap widget | E11 | Done | Medium | `fase-3` |
| T11.6 | Pecah demo/telemetry.ts — checker 1 FAIL akibat E11 | E11 | Done | High | `fase-3` |

\* E7 `Done` hanya untuk simulasi demo. Verifikasi WS sungguhan ikut V8.2/V8.3.

Detail lengkap tiap issue (deskripsi, kriteria terima, bukti): lihat
`docs/linear-seed.json` — file itu adalah sumber pembuatan issue di Linear,
supaya isi Linear dan repo selalu bisa dicocokkan ulang.

### 1.4 Yang sengaja TIDAK dibuat issue terpisah

- Diskrepansi dokumen D-1 (`POST /auth/password/change` body) dan D-2
  (`GET /auth/me` shape): sudah ditangani (`mapAuthMe` defensif, API doc §L
  dipakai) dan didokumentasikan di `AUDIT.md` §3 — dicatat di deskripsi
  F1.1, bukan issue sendiri.
- Safety boundary ADR-003 (tidak ada aktuasi mesin, tidak ada
  `POST /devices/:id/command`, tidak ada `POST /clients/provision`): aturan
  permanen, dicatat di deskripsi E4/E6 dan diuji oleh `iamAndSecurity.test.ts`
  — bukan issue yang bisa `Done`.
- 4 issue onboarding Linear (`FAT-1`–`FAT-4`): milik workspace, bukan project
  ini — biarkan apa adanya, jangan dihapus dari Linear.

---

## 2. Workflow — arti tiap status (tim FAT)

Status bawaan tim FAT dipakai apa adanya, tidak dibuat status custom:

| Status Linear | Arti di project ini | Siapa yang memindahkan |
| --- | --- | --- |
| `Backlog` | Ide / temuan belum diprioritaskan. Belum ada komitmen. | Siapa saja, saat triage |
| `Todo` | Sudah disepakati, siap dikerjakan, belum dimulai. | Saat issue dibuat dari audit/rencana |
| `In Progress` | Sedang dikerjakan (ada branch/commit aktif). Hanya **satu** issue `In Progress` per orang dalam satu waktu. | Muse / Fathur saat mulai kerja |
| `In Review` | Kode sudah di-push (commit di GitHub), menunggu verifikasi: `tsc` + test + build, atau cek visual Fathur. | Muse setelah push |
| `Done` | **Semua** kriteria terima terpenuhi + bukti tercantum di issue (commit SHA, hasil test/build). Demo-only harus menulis "Demo-only" di komentar penutup. | Setelah bukti lengkap — bukan saat push |
| `Canceled` | Dibatalkan dengan alasan di komentar (mis. duplikat keputusan dokumen). Jangan hapus issue. | Setelah keputusan tercatat |
| `Duplicate` | Duplikat issue lain — komentar berisi nomor issue yang dipertahankan. | Saat triage |

Aturan tambahan:

- **Tidak ada lompat status.** `Todo` → `In Progress` → `In Review` → `Done`.
  Kalau verifikasi gagal, kembali ke `In Progress` dengan komentar berisi
  apa yang gagal.
- **Blocked bukan status.** Blocker dicatat dengan label `blocked` + komentar
  "Blocked by: …" (mis. "tidak ada backend"). Issue tetap di `Todo`, supaya
  antrean yang benar-benar bisa dikerjakan tetap terlihat.
- **Prioritas:** `Urgent` = panel tidak bisa dipakai / keamanan; `High` =
  modul Guide / verifikasi go-live; `Medium` = penyempurnaan; `Low` = nice-to-have.
  Prioritas default modul Guide adalah `High`, bukan `Urgent`.

---

## 3. Label

Label bawaan workspace yang dipakai: `Bug`, `Feature`, `Improvement`.
Label baru yang dibuat untuk project ini:

| Label | Arti |
| --- | --- |
| `fase-1` … `fase-7` | Fase Build Guide tempat issue berada |
| `demo` | Selesai / berlaku di mode Demo (belum tentu di Real) |
| `real-backend` | Butuh / menyangkut backend sungguhan |
| `blocked` | Terhambat faktor luar (saat ini: belum ada backend) |
| `verification` | Butuh pengecekan (visual / E2E / integrasi), bukan coding |
| `env` | Konfigurasi environment (`.env`, `mode.ts`) |
| `security` | Auth, IAM, token, Dynamic Security |
| `deployment` | Build, Nginx, hosting |
| `docs` | Dokumentasi / audit |

Satu issue boleh punya beberapa label, tapi **wajib** punya minimal satu
label `fase-*` (kecuali Epic E8) dan label `demo`/`real-backend` bila relevan.
Label bukan pengganti status — jangan menandai selesai dengan label.

---

## 4. Isi standar tiap issue

Setiap issue (kecuali Epic) wajib berisi di deskripsi:

1. **Referensi Guide:** nomor pasal (mis. "Guide §6.8, Lamp. A") + endpoint
   yang dicakup (mis. "`GET /api/v1/operational-events/` — trailing slash wajib").
2. **Kriteria terima:** checklist dari Definition of Done §15 yang relevan
   untuk modul itu (lihat §5 di bawah).
3. **Bukti selesai:** commit SHA GitHub + `tsc` / `npm test` / `npm run build`
   (mis. "70/70, `717c9ac`"). Tanpa bukti, issue tidak boleh `Done`.
4. **Batasan yang diketahui:** kalau Demo-only, tulis eksplisit
   ("Belum terverifikasi mode Real — lihat V8.2").

Deskripsi Epic berisi: ringkasan fase, daftar child issue, dan tautan ke
`AUDIT.md` + repo GitHub.

---

## 5. Definition of Done (Guide §15) — checklist penutup tiap modul

Sebuah modul dianggap selesai bila seluruh poin ini terpenuhi:

- [ ] Semua endpoint modul dipanggil lewat klien terpusat dengan Zod.
- [ ] Loading / empty / error / konflik / stale state tertangani dan konsisten.
- [ ] Otorisasi UI memakai capability key; `403` menurunkan capability dan
      `401` stale memaksa login ulang.
- [ ] Aksi dengan scope/atribut tidak diketahui memakai state `unknown`,
      bukan ditebak atau di-disable proaktif.
- [ ] Tidak ada evaluasi role/scope/policy yang direplikasi di klien.
- [ ] Mode remote menonaktifkan seluruh mutasi dengan banner.
- [ ] Paginasi server dan filter tercermin pada `queryKey`.
- [ ] Mutasi memakai konfirmasi, anti double-submit, dan refetch pasca-sukses.
- [ ] Konflik `409` dipetakan ke dialog dengan tindakan korektif.
- [ ] Ekspor memakai Bearer, menangani `403`/`429`, dan membaca header file.
- [ ] Tidak ada token/password di storage persisten, URL, atau log.
- [ ] Unit test klien + komponen hijau; minimal satu uji integrasi LAN per modul.
- [ ] Tidak ada tombol aktuasi mesin di seluruh panel.
- [ ] Tidak ada referensi ke endpoint yang tidak terdaftar
      (mis. `POST /clients/provision`).

Catatan jujur untuk project ini: poin "uji integrasi LAN per modul" **belum
bisa** dipenuhi sebelum backend ada — modul yang `Done` di Demo tetap
mencantumkan poin itu sebagai belum terpenuhi di V8.3, bukan dicentang paksa.

---

## 6. Cara kerja sehari-hari (Muse + Fathur)

### 6.1 Memulai pekerjaan

1. Ambil issue `Todo` dengan prioritas tertinggi di Epic yang sedang aktif.
2. Pindahkan ke `In Progress`, tulis komentar "Mulai: …" bila ada konteks.
3. Buat branch dari nama branch Linear issue itu
   (mis. `affdhikaad/fat-12-nama-issue` — Linear yang menghasilkan namanya).
4. Kerjakan di `~/workspace/iiot-oee-admin-panel/`, commit dengan pesan
   yang menyebut ID issue: `[FAT-12] …`.

### 6.2 Menyelesaikan pekerjaan

1. Verifikasi lokal: `npx tsc --noEmit` (0 error) + `npm test` + `npm run build`.
2. Push ke GitHub (`fadk-dev/iiot-oee-admin-panel`, `main` — pola snapshot
   yang selama ini dipakai, dengan approval Fathur).
3. Pindahkan issue ke `In Review`, komentar berisi: commit SHA, hasil
   test/build, dan apa yang **belum** terverifikasi.
4. Pindahkan ke `Done` hanya setelah verifikasi yang diminta issue itu
   selesai (untuk issue Demo: test/build hijau sudah cukup + catatan
   Demo-only; untuk issue verifikasi: hasil cek Fathur / backend).

### 6.3 Peran Fathur (yang hanya bisa dilakukan dia)

- Cek visual di browser sungguhan (`npm run dev`) — issue V8.1.
- Keputusan soal backend (kapan ada, URL-nya) — yang membuka blokir V8.2/V8.3.
- Pembuatan repo / import Vercel / env production — bukan di Linear, tapi
  hasilnya dicatat sebagai komentar di issue terkait.
- Approval push GitHub — tetap lewat kartu approval seperti selama ini.

### 6.4 Kalau ada temuan baru

- Temuan audit / bug baru → **buat issue baru** (label `Bug`, parent Epic
  yang relevan), jangan menumpang di issue yang sudah `Done`.
- Issue `Done` yang ternyata rusak → **reopen** (kembali ke `In Progress`)
  dengan komentar berisi bukti rusaknya, jangan buat duplikat diam-diam.
- Perubahan keputusan dokumen (mis. D-1/D-2 baru) → komentar di issue
  terkait + perbarui `AUDIT.md` §3.

### 6.5 Ritme

- **Tidak ada Sprint/Cycle paksa** untuk sekarang (tim 1 orang + Muse).
  Yang dipakai adalah Milestone per Fase (§1.2) + review mingguan singkat:
  tiap akhir minggu, lihat Project Overview — apa yang pindah ke `Done`,
  apa yang masih `blocked`, dan apa yang harus jadi `Todo` berikutnya.
- Kalau tim bertambah atau ada deadline backend, barulah Cycle mingguan
  diaktifkan di Linear — keputusan itu dicatat di issue E8, bukan diam-diam.

---

## 7. Keterkaitan GitHub ↔ Linear

| Di GitHub / repo | Di Linear |
| --- | --- |
| Commit / push | Komentar di issue + pindah ke `In Review` |
| `AUDIT.md` | Ringkasan audit per fase; issue berisi tautan ke bagiannya |
| `docs/linear-seed.json` | Cetak biru pembuatan issue (judul, deskripsi, status awal, label) |
| Branch Linear (`fat-xxx-...`) | Branch kerja untuk issue itu |
| PR / snapshot push | Disebut di komentar issue dengan SHA-nya |

`AUDIT.md` tetap menjadi laporan audit yang bisa dibaca tanpa Linear,
tapi status implementasi yang berlaku adalah status di Linear.

---

## 8. Status Linear — dibuat 2026-11-16 (terverifikasi)

- Koneksi Linear: **connected**, akses tulis diberikan Fathur 2026-11-16
  (`issues.create` + `projects.create` + `labels.create` + `issues.manage` +
  `projects.manage` + `comments.create` — semua `granted`).
- Tim: hanya `FAT / Fattr`. Pengguna: Fathur (`affdhikaad@gmail.com`, admin).
- Project: **IIoT OEE Admin Panel** — `P-FAT-1`,
  https://linear.app/fattr/project/iiot-oee-admin-panel-f2137236e571
- Label: 15 label §3 sudah dibuat (di luar `Bug`/`Feature`/`Improvement` bawaan).
- Issue: **45 issue terverifikasi** via `list_issues` (project `P-FAT-1`):
  **35 Done, 3 In Progress, 7 Todo**, 11 Epic tanpa parent, 34 child dengan
  `parentId` — persis sesuai §1.3 (28 awal + E9/R9.1–R9.6 + E10/A10.1–A10.2,
  dibuat 2026-11-16 ~14:20 WIB; R9.2/R9.3/R9.4/R9.5/R9.6 Done 2026-11-16 malam,
  tersisa A10.2 + V8.1–V8.5; E11/T11.1–T11.5 dibuat 2026-11-16 malam dari
  audit telemetry `docs/TELEMETRY_AUDIT.md`, Done 2026-11-16 malam —
  AUDIT.md §14; T11.6 ditambah setelah verifikasi independen menemukan
  checker 1 FAIL yang diperkenalkan E11, Done 2026-11-16 malam setelah
  split `demo/telemetry.ts` per domain + checker kembali 0 FAIL).
- Status tim: `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`,
  `Canceled`, `Duplicate` — dipakai apa adanya (lihat §2).

### Pemetaan kunci → nomor Linear

| Kunci | Issue Linear | Kunci | Issue Linear |
| --- | --- | --- | --- |
| E1 Fase 1 | FAT-9 | F3.3 | FAT-26 |
| E2 Fase 2 | FAT-5 | F3.4 | FAT-20 |
| E3 Fase 3 | FAT-12 | F3.5 | FAT-23 |
| E4 Fase 4 | FAT-10 | F3.6 | FAT-24 |
| E5 Fase 5 | FAT-6 | F4.1 | FAT-25 |
| E6 Fase 6 | FAT-11 | F5.1 | FAT-22 |
| E7 Fase 7 | FAT-8 | F6.1 | FAT-21 |
| E8 Verifikasi | FAT-7 | F7.1 | FAT-32 |
| F1.1 | FAT-14 | V8.1 | FAT-31 |
| F1.2 | FAT-15 | V8.2 | FAT-28 |
| F1.3 | FAT-16 | V8.3 | FAT-30 |
| F1.4 | FAT-13 | V8.4 | FAT-29 |
| F2.1 | FAT-19 | V8.5 | FAT-27 |
| F3.1 | FAT-18 | R9.4 | FAT-38 |
| F3.2 | FAT-17 | R9.5 | FAT-39 |
| E9 Refactoring | FAT-33 | R9.6 | FAT-42 |
| R9.1 | FAT-35 | E10 Akses | FAT-34 |
| R9.2 | FAT-37 | A10.1 | FAT-41 |
| R9.3 | FAT-36 | A10.2 | FAT-40 |
| E11 Telemetry | FAT-43 | T11.1 | FAT-44 |
| T11.2 | FAT-47 | T11.3 | FAT-48 |
| T11.4 | FAT-46 | T11.5 | FAT-45 |
| T11.6 | FAT-49 | | |

Perhatian: nomor FAT tidak berurutan per fase — Linear memberinya sesuai
urutan pembuatan paralel, jadi selalu pakai tabel ini (dan `docs/linear-seed.json`
bagian `created`), bukan tebakan urutan.

### Yang belum bisa dibuat lewat API

- **Milestone M1–M8 (§1.2) belum ada di Linear.** Konektor Linear yang
  tersedia tidak menyediakan tool membuat/mendaftar milestone, dan
  `save_issue` menolak nama milestone yang belum ada — jadi field
  `milestone` di `linear-seed.json` belum diterapkan ke issue. Kalau mau
  milestone tampil di Project Overview, buat M1–M8 manual di Linear
  (Project → Milestones), lalu pasang ke issue lewat UI. Sampai saat itu,
  label `fase-*` adalah penanda fase yang berlaku.
- Deskripsi FAT-17 sempat tersimpan sebagai `string\[\]` (artefak escaping
  saat pembuatan) — sudah diperbaiki 2026-11-16 menjadi `string array`.
