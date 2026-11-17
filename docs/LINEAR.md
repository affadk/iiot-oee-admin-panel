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

### 1.1 Satu Project, lima belas Epic

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
| E12 Lanjutan Perbaikan Telemetry & OEE | §6.8, §Q, §K | Audit 2026-11-16: 19 usulan tersisa (F-5–F-13, X-1–X-6, U-2–U-5) — admin-panel saja; infra (Nginx) + backend dikecualikan |
| E13 Backend gaps — System Admin | §3.3, §3.4, §6.7, §H, §M, §N, §O, §P | Audit 2026-11-17: 50 gap backend System Admin (SYS-B1–SYS-B50) — kontrak IAM, audit, health, MQTT DynSec/Config, master data |
| E14 Tindak lanjut panel keputusan Fase 0 | K-01–K-15 | Perubahan panel dari 12 keputusan Fase 0 yang diputuskan (K-03 slash, K-10 method, K-11 provision); K-05/K-06/K-07 diputuskan menyusul (E15) |
| E15 K-05/K-06/K-07 ikuti desain API doc | K-05–K-07 | Panel mengikuti desain API_DOCUMENTATION/Guide Lampiran A (4 body dynsec objek tunggal, password wajib min 8, mapper enabled, overview null → UNAVAILABLE); B34/B43 dicatat sebagai tugas dokumentasi backend |

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
| E9 | Refactoring struktur direktori & kontrak penulisan kode | — | Done | High | `docs` |
| R9.1 | Kontrak directory-structure + checker otomatis | E9 | Done | High | `docs` |
| R9.2 | Pecah services/api: mockData, schemas, endpoints per domain | E9 | Done | High | `docs` |
| R9.3 | Pecah client.ts demo + httpClient.ts per domain | E9 | Done | High | `docs` |
| R9.4 | Pecah utils/capabilities.ts per concern | E9 | Done | Medium | `docs` |
| R9.5 | Halaman besar: ekstraksi tab/modal per halaman | E9 | Done | Medium | `docs` |
| R9.6 | Verifikasi refactoring: tsc, tests, build, preview + AUDIT.md | E9 | Done | High | `verification`, `docs` |
| E10 | Mode Akses Private/Public (LAN vs Internet) | — | **In Progress** | High | `security`, `feature` |
| A10.1 | Switch Private/Public di panel (env + enforcement + UI) | E10 | Done | High | `security`, `feature` |
| A10.2 | Kebutuhan backend mode akses (B1–B25, checklist V1–V12) | E10 | **Todo — Blocked** | High | `security`, `real-backend`, `blocked` |
| E11 | Perbaikan Telemetry & OEE (audit 2026-11-16) | — | Done | High | `fase-3` |
| T11.1 | Kirim from/to (+limit) ke hourly & aggregate Telemetry History | E11 | Done | High | `fase-3` |
| T11.2 | Ikat shift summary + timeline ke periode/shift yang sama | E11 | Done | High | `fase-3` |
| T11.3 | Rollup halaman OEE mengikuti mesin terpilih (atau label scope) | E11 | Done | High | `fase-3` |
| T11.4 | Samakan angka seed demo agar terrekoniliasi | E11 | Done | High | `fase-3`, `demo` |
| T11.5 | Label scope eksplisit di setiap widget | E11 | Done | Medium | `fase-3` |
| T11.6 | Pecah demo/telemetry.ts — checker 1 FAIL akibat E11 | E11 | Done | High | `fase-3` |
| E12 | Lanjutan Perbaikan Telemetry & OEE (audit 2026-11-16) | — | Done | High | `fase-3` |
| T12.1 | Filter shift (tanggal + shift) di Telemetry History dan halaman OEE | E12 | Done | High | `fase-3` |
| T12.2 | Tab Aggregate menampilkan deret per-bucket | E12 | Done | Medium | `fase-3` |
| T12.3 | Kolom tabel per jam dilengkapi + samakan presisi | E12 | Done | Medium | `fase-3` |
| T12.4 | Perbaiki pemetaan planned downtime (sisi panel) | E12 | Done | Medium | `fase-3` |
| T12.5 | Empty / loading / error state di semua tabel dan kartu | E12 | Done | Medium | `fase-3` |
| T12.6 | Indikator rekonsiliasi + investigasi selisih parts | E12 | Done | Medium | `fase-3` |
| T12.7 | Samakan kolom ekspor dengan layar (+ ekspor rollup) | E12 | Done | Medium | `fase-3` |
| T12.8 | Delegasikan builder endpoint ke registry | E12 | Done | Medium | `fase-3` |
| T12.9 | Kontrol periode (date-range picker) di halaman OEE | E12 | Done | Medium | `fase-3` |
| T12.10 | Toggle scope rollup: mesin ini / semua mesin | E12 | Done | Medium | `fase-3` |
| T12.11 | Zona waktu tunggal Asia/Jakarta + label sumbu waktu timeline | E12 | Done | Medium | `fase-3` |
| T12.12 | Flag provisional konsisten di semua tampilan | E12 | Done | Medium | `fase-3` |
| T12.13 | Downtime overlay: menampilkan N dari M + paginasi | E12 | Done | Low | `fase-3` |
| T12.14 | Hapus hourly_downtime_sec (field hantu) dari tipe, seed, CSV | E12 | Done | Low | `fase-3` |
| T12.15 | Perbaiki mapping cycle_time_ms berdasarkan satuan field | E12 | Done | Low | `fase-3` |
| T12.16 | Perbaiki komentar refetchAll + isRefreshing mencakup semua query | E12 | Done | Low | `fase-3` |
| T12.17 | Reset pilihan segmen saat ganti bucket timeline | E12 | Done | Low | `fase-3` |
| T12.18 | Samakan default dengan dokumen, atau catat deviasinya | E12 | Done | Low | `fase-3` |
| T12.19 | Satu tampilan kanonis OEE per jam + tautan silang | E12 | Done | Low | `fase-3` |
| T12.6a | Terapkan Opsi A: summary parts dari Σ hourly | E12 | Done | High | `fase-3` |
| E13 | Backend gaps — System Admin (SYS-B1–SYS-B50) | — | **Todo** | High | `real-backend`, `docs` |
| SYS-B1 | POST `/access-control/policies`: body panel tidak cocok dengan kontrak backend; `subjectMatch` tidak pernah bisa diisi | E13 | **Todo** | High | `real-backend` |
| SYS-B2 | PUT `/access-control/policies/:id` (+ toggle aktif/nonaktif): method PATCH vs PUT dan nama field salah | E13 | **Todo** | High | `real-backend` |
| SYS-B3 | ABAC: grammar/atribut panel ≠ backend; placeholder panel justru contoh yang tidak valid | E13 | **Todo** | High | `real-backend` |
| SYS-B4 | GET `/auth/me`: `mustChangePassword` / `isActive` / `isProtected` dibuang; tidak ada alur ganti-password-wajib | E13 | **Todo** | High | `real-backend` |
| SYS-B5 | PUT `/access-control/roles/:id`: panel mengirim PATCH; deskripsi saja yang benar | E13 | **Todo** | Medium | `real-backend` |
| SYS-B6 | Bentuk respons GET `/roles`, `/permissions`, `/policies`, `/user-roles`, `/subjects/...`, `/info` tidak dispesifikasi field-per-field; panel menebak dan memberi default diam-diam | E13 | **Todo** | Medium | `real-backend` |
| SYS-B7 | Role preset: panel/demo mengunci keempat preset sebagai immutable — dokumen hanya mengunci ADMIN; perilaku hapus role ber-pemakaian tidak didokumentasikan | E13 | **Todo** | Medium | `real-backend` |
| SYS-B8 | Capability `access_control.read` tidak ada di panel; kunci capability panel belum tentu sama dengan katalog backend; 403 pada read bisa salah menurunkan `manage` | E13 | **Todo** | Medium | `real-backend` |
| SYS-B9 | Proyeksi capability `/auth/me`: `domain`/`surface`/`mode`/`reason` per capability dan `enforcedDomains` dibuang; mode `partial` tidak jelas sumbernya | E13 | **Todo** | Medium | `real-backend` |
| SYS-B10 | POST `/access-control/permissions`: tidak ada UI; demo aktif memblokir dengan kode karangan; casing body belum pasti | E13 | **Todo** | Medium | `real-backend` |
| SYS-B11 | GET `/access-control/audit`: tanpa filter server-side; limit di-hardcode 100; keputusan di atas 100 hilang diam-diam | E13 | **Todo** | Medium | `real-backend` |
| SYS-B12 | Inspector `GET /subjects/:operatorId/effective-permissions`: bentuk respons tidak terdokumentasi; subjek default hardcode `SUP-042`; error deep-link ditelan | E13 | **Todo** | Low | `real-backend` |
| SYS-B13 | POST `/access-control/roles/:id/permissions`: `reason` yang diketik admin dibuang di Real mode | E13 | **Todo** | Low | `real-backend` |
| SYS-B14 | Mutasi assignment: `reason` tidak dikirim; revoke memakai composite key tanpa `id` | E13 | **Todo** | Low | `real-backend` |
| SYS-B15 | Refresh token: panel mengembalikan `authz_version` karangan (selalu 0/stale di Real); penanganan 401 `AUTHZ_STALE`/`SUBJECT_INACTIVE` generik | E13 | **Todo** | Low | `real-backend` |
| SYS-B16 | Login: lockout client-side (5 percobaan/30 dtk) vs rate limit server (5/60 dtk); dokumentasi `Retry-After` belum ada | E13 | **Todo** | Low | `real-backend` |
| SYS-B17 | GET `/access-control/user-roles` & `/policies`: panel tidak mengirim filter `operatorId`/`roleId`; muat-semua + saring client-side | E13 | **Todo** | Low | `real-backend` |
| SYS-B18 | Aturan anti-eskalasi/wildcard karangan panel/demo yang lebih ketat dari dokumen | E13 | **Todo** | Low | `real-backend` |
| SYS-B19 | Skema item audit (`OperationalEventItem`) tidak didefinisikan di dokumen mana pun; semua kolom AuditTrailPage adalah asumsi mapper | E13 | **Todo** | High | `real-backend` |
| SYS-B20 | `GET /health` tidak menyediakan field yang ditampilkan SystemHealthPage; transport HTTP mensintesis data kesehatan palsu | E13 | **Todo** | High | `real-backend` |
| SYS-B21 | PATCH ack tidak mengirim `operatorId`; dokumen bertentangan soal wajib/tidak | E13 | **Todo** | Medium | `real-backend` |
| SYS-B22 | Filter `severity` dan `acknowledged` di halaman Operational Events dibuang oleh transport HTTP; di Demo jalan, di Real mode diam-diam diabaikan | E13 | **Todo** | Medium | `real-backend` |
| SYS-B23 | Konflik dokumen: `machine_id` pada list global dan ekspor operational-events; Guide bilang didukung, API doc tidak mencantumkannya | E13 | **Todo** | Medium | `real-backend` |
| SYS-B24 | Dukungan `event_type` pada `GET /system/audit` tidak ada di dokumen; panel bisa mengirimnya (via URL) dan demo mengabaikannya | E13 | **Todo** | Medium | `real-backend` |
| SYS-B25 | Bentuk envelope `meta` list tidak didefinisikan; paginasi cursor dan total bisa gagal diam-diam | E13 | **Todo** | Low | `real-backend` |
| SYS-B26 | System audit tidak bisa diekspor: tidak ada endpoint ekspor dan tidak ada tombolnya di UI | E13 | **Todo** | Low | `real-backend` |
| SYS-B27 | Tidak ada endpoint info/versi backend; SystemInfoPage murni statis | E13 | **Todo** | Low | `real-backend` |
| SYS-B28 | Rotasi password MQTT: http memakai POST, dokumen memakai PATCH | E13 | **Todo** | High | `real-backend` |
| SYS-B29 | Enable/disable klien MQTT: http memakai POST + `{disabled}`, dokumen memakai PATCH + `{enabled}` | E13 | **Todo** | High | `real-backend` |
| SYS-B30 | Provisioning perangkat: http mengubah nilai `access` menjadi `telemetry` / `telemetry+state` | E13 | **Todo** | High | `real-backend` |
| SYS-B31 | Tambah peran ke klien: http mengirim `{roles:[{rolename, priority}]}`, dokumen memakai `{rolename, priority?}` | E13 | **Todo** | High | `real-backend` |
| SYS-B32 | Tambah ACL ke peran: http mengirim `{acls:[acl]}`, dokumen memakai objek ACL tunggal `{acltype, topic, ...}` | E13 | **Todo** | High | `real-backend` |
| SYS-B33 | Buat klien: password kosong dikirim sebagai string kosong; auto-generate tidak dijamin dokumen; field `textname`/`textdescription`/`groups`/`clientid` dibuang di sebagian mode | E13 | **Todo** | High | `real-backend` |
| SYS-B34 | Bentuk respons `POST /clients` (password sekali tampil) tidak dinamai di dokumen | E13 | **Todo** | Medium | `real-backend` |
| SYS-B35 | Mapper `mapMqttClient`: logika `enabled` bisa terbalik bila backend mengembalikan `enabled:false` | E13 | **Todo** | Medium | `real-backend` |
| SYS-B36 | Tambah klien ke grup: http mengirim `{clients:[{username}]}`, dokumen memakai `{username, priority?}` | E13 | **Todo** | Medium | `real-backend` |
| SYS-B37 | Tambah peran ke grup: http mengirim `{roles:[{rolename}]}`, dokumen memakai `{rolename, priority?}` | E13 | **Todo** | Medium | `real-backend` |
| SYS-B38 | `GET /mqtt/configuration` tanpa trailing slash; dokumen API mewajibkan trailing slash | E13 | **Todo** | Medium | `real-backend` |
| SYS-B39 | Stage konfigurasi: panel mengirim `{config, summary}`, dokumen memakai `{config, baseVersionId?, reason?, comment?}` | E13 | **Todo** | Medium | `real-backend` |
| SYS-B40 | Detail error 422 staging: dokumen menyebut field `details`, panel hanya mem-parsing `issues` | E13 | **Todo** | Medium | `real-backend` |
| SYS-B41 | Apply/rollback: panel tidak mengirim `acknowledgeUnvalidated`, dan hanya polling operasi satu kali | E13 | **Todo** | Medium | `real-backend` |
| SYS-B42 | `POST /backups` tidak ada di dokumen (endpoint hantu); tidak ada restore/download backup | E13 | **Todo** | Medium | `real-backend` |
| SYS-B43 | Model konfigurasi terstruktur tidak dispesifikasi; field, default, dan enum status versi/operasi ditebak panel | E13 | **Todo** | Medium | `real-backend` |
| SYS-B44 | Overview: bentuk dalam `{dynamicSecurity, configuration}` tidak dispesifikasi; `null` (plugin nonaktif) diubah panel menjadi nilai yang menyesatkan | E13 | **Todo** | Low | `real-backend` |
| SYS-B45 | Filter Shift Schedules: panel memakai snake_case, Guide memakai camelCase | E13 | **Todo** | Medium | `real-backend` |
| SYS-B46 | Respons list/detail Shift Schedule: field denormalisasi (`shiftName/shiftCode/startTime/endTime`) tidak dijamin dokumen | E13 | **Todo** | Medium | `real-backend` |
| SYS-B47 | Operators: `is_active` pada create dihilangkan http; proteksi `ADM-001` berbeda status demo vs dokumen | E13 | **Todo** | Low | `real-backend` |
| SYS-B48 | List DynSec & Operators tanpa pagination/filter server-side; panel mengambil semua | E13 | **Todo** | Low | `real-backend` |
| SYS-B49 | Hapus Production Line: demo memblokir bila line dipakai operator; dokumen hanya menyebut machines + snapshot WO | E13 | **Todo** | Low | `real-backend` |
| SYS-B50 | Hapus Shift: demo hanya memeriksa shift_schedules, bukan snapshot WO; efek ubah jam shift ke jadwal yang ada tidak dispesifikasi | E13 | **Todo** | Low | `real-backend` |
| E14 | Tindak lanjut panel keputusan Fase 0 (K-01–K-15) | — | Done | High | `real-backend`, `docs` |
| P14.1 | K-03: GET /mqtt/configuration wajib trailing slash | E14 | Done | High | `real-backend` |
| P14.2 | K-10: PUT untuk updateIamRole + updateIamPolicy | E14 | Done | High | `real-backend` |
| P14.3 | K-10: PATCH rotasi password + toggle dynsec ({enabled}) | E14 | Done | High | `real-backend` |
| P14.4 | K-11: provisioning lewat POST /clients/provision | E14 | Done | High | `real-backend` |
| P14.5 | Verifikasi E14: tsc, tests, build, preview, checker + AUDIT.md §17 | E14 | Done | High | `verification`, `docs` |
| E15 | K-05/K-06/K-07: ikuti desain API_DOCUMENTATION | — | Done | High | `real-backend`, `docs` |
| P15.1 | K-05: 4 body sub-operasi dynsec ke objek tunggal | E15 | Done | High | `real-backend` |
| P15.2 | K-06 B33: password wajib di UI buat klien (min 8) | E15 | Done | High | `real-backend` |
| P15.3 | K-06 B35: perbaiki logika enabled mapMqttClient | E15 | Done | High | `real-backend` |
| P15.4 | K-07 B44: overview configuration null → UNAVAILABLE | E15 | Done | High | `real-backend` |
| P15.5 | Verifikasi E15: tsc, tests, build, preview, checker + AUDIT.md §18 | E15 | Done | High | `verification`, `docs` |

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
- Issue: **129 issue terverifikasi** via `list_issues` (project `P-FAT-1`):
  **70 Done, 1 In Progress, 58 Todo**, 15 Epic tanpa parent, 114 child dengan
  `parentId` — persis sesuai §1.3 (28 awal + E9/R9.1–R9.6 + E10/A10.1–A10.2,
  dibuat 2026-11-16 ~14:20 WIB; R9.2/R9.3/R9.4/R9.5/R9.6 Done 2026-11-16 malam,
  tersisa A10.2 + V8.1–V8.5; E11/T11.1–T11.6 dibuat 2026-11-16 malam dari
  audit telemetry `docs/TELEMETRY_AUDIT.md`, Done 2026-11-16 malam —
  AUDIT.md §14, Epic E11 ditutup 2026-11-17; E12/T12.1–T12.19 dibuat
  2026-11-17 dari `docs/E12_PROPOSAL.md` — admin-panel saja, infra Nginx +
  backend dikecualikan, Done 2026-11-17 — AUDIT.md §15, Epic E12 ditutup
  2026-11-17, di-push `af5011f`; T12.6a (Opsi A, FAT-70) dibuat 2026-11-17
  atas keputusan Fathur, Done 2026-11-17 — AUDIT.md §15; E13/SYS-B1–SYS-B50 dibuat 2026-11-17 dari `docs/BACKEND_GAPS_SYSTEM_ADMIN.md` — gap backend System Admin, belum dikerjakan, Epic E13 Todo; E14/P14.1–P14.5 dibuat 2026-11-17 dari keputusan Fase 0 Fathur (decision log Lampiran C `docs/BACKEND_UPGRADE_PLAN.md`) — tindak lanjut panel, Done 2026-11-17 — AUDIT.md §17, Epic E14 ditutup 2026-11-17; E15/P15.1–P15.5 dibuat 2026-11-17 dari keputusan Fathur mengikuti desain API_DOCUMENTATION untuk K-05/K-06/K-07 (decision log Lampiran C `docs/BACKEND_UPGRADE_PLAN.md`) — tindak lanjut panel, Done 2026-11-17 — AUDIT.md §18, Epic E15 ditutup 2026-11-17).
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
| E12 Lanjutan | FAT-50 | T12.1 | FAT-54 |
| T12.2 | FAT-51 | T12.3 | FAT-53 |
| T12.4 | FAT-55 | T12.5 | FAT-52 |
| T12.6 | FAT-56 | T12.7 | FAT-60 |
| T12.8 | FAT-61 | T12.9 | FAT-62 |
| T12.10 | FAT-57 | T12.11 | FAT-59 |
| T12.12 | FAT-58 | T12.13 | FAT-63 |
| T12.14 | FAT-66 | T12.15 | FAT-67 |
| T12.16 | FAT-68 | T12.17 | FAT-69 |
| T12.18 | FAT-65 | T12.19 | FAT-64 |
| T12.6a | FAT-70 | | |
| E13 Backend gaps | FAT-71 | SYS-B1 | FAT-72 |
| SYS-B2 | FAT-73 | SYS-B3 | FAT-74 |
| SYS-B4 | FAT-75 | SYS-B5 | FAT-76 |
| SYS-B6 | FAT-77 | SYS-B7 | FAT-78 |
| SYS-B8 | FAT-79 | SYS-B9 | FAT-80 |
| SYS-B10 | FAT-81 | SYS-B11 | FAT-82 |
| SYS-B12 | FAT-83 | SYS-B13 | FAT-84 |
| SYS-B14 | FAT-85 | SYS-B15 | FAT-86 |
| SYS-B16 | FAT-87 | SYS-B17 | FAT-88 |
| SYS-B18 | FAT-89 | SYS-B19 | FAT-90 |
| SYS-B20 | FAT-91 | SYS-B21 | FAT-92 |
| SYS-B22 | FAT-93 | SYS-B23 | FAT-94 |
| SYS-B24 | FAT-95 | SYS-B25 | FAT-96 |
| SYS-B26 | FAT-97 | SYS-B27 | FAT-98 |
| SYS-B28 | FAT-99 | SYS-B29 | FAT-100 |
| SYS-B30 | FAT-101 | SYS-B31 | FAT-102 |
| SYS-B32 | FAT-103 | SYS-B33 | FAT-104 |
| SYS-B34 | FAT-105 | SYS-B35 | FAT-106 |
| SYS-B36 | FAT-107 | SYS-B37 | FAT-108 |
| SYS-B38 | FAT-109 | SYS-B39 | FAT-110 |
| SYS-B40 | FAT-111 | SYS-B41 | FAT-112 |
| SYS-B42 | FAT-113 | SYS-B43 | FAT-114 |
| SYS-B44 | FAT-115 | SYS-B45 | FAT-116 |
| SYS-B46 | FAT-117 | SYS-B47 | FAT-118 |
| SYS-B48 | FAT-119 | SYS-B49 | FAT-120 |
| SYS-B50 | FAT-121 |  |  |
| E14 Tindak lanjut panel | FAT-122 | P14.1 | FAT-123 |
| P14.2 | FAT-124 | P14.3 | FAT-125 |
| P14.4 | FAT-126 | P14.5 | FAT-127 |
| E15 K-05/K-06/K-07 ikuti API doc | FAT-128 | P15.1 | FAT-129 |
| P15.2 | FAT-130 | P15.3 | FAT-131 |
| P15.4 | FAT-132 | P15.5 | FAT-133 |

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
