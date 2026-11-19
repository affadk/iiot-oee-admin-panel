# API Sync Review — Diff yang perlu ditinjau kembali

| | |
|---|---|
| **Epic** | E20 (P20.7, FAT-159) — sinkronisasi admin-panel IIoT OEE ke API docs terupdate |
| **Tanggal** | 2026-11-19 |
| **Sumber kebenaran** | API docs terupdate `~/workspace/user/files/pasted-text.txt` (2100 baris, Fastify 5.x + spec 015/020/027/032/034/035/036/037/042/043) |
| **Diff lengkap** | `docs/API_SYNC_DIFF.md` (P20.1, FAT-153) — 294 entri: 162 OK / 102 CHANGE / 21 NEW / 9 REMOVE |
| **Keputusan** | D-1–D-14 diputuskan 2026-11-19 dengan mengikuti api_docs (Fathur: "ikuti api_docs dulu") |

## 1. Keputusan D-1–D-14 — mengikuti api_docs

| # | Keputusan | Diputuskan | Dasar di api_docs |
|---|---|---|---|
| D-1 | Gerbang password mengikuti dokumen, bukan premis 401 | Flag `must_change_password` + `403 PASSWORD_ROTATION_REQUIRED` | §L 1247–1250; grep `PASSWORD_CHANGE_REQUIRED` di dokumen = 0 |
| D-2 | Bentuk kanon `/auth/me` | Panel toleran terhadap ketiganya (flat §L, nested §3.4, ringkas §6B); paralel minta backend tetapkan satu kanon (R-2) | §L 1245; §3.4 ~1553–1555; §6B 1984 |
| D-3 | Daftar atribut ABAC | Minta daftar dari spec 032/024 lengkap (R-1); panel tidak menebak | §3.4 1502, 1520 — whitelist disebut tanpa enumerasi |
| D-4 | `OFFLINE` nilai item atau hanya filter | Nilai item sah — panel tampilkan apa adanya, tanpa normalisasi ke `UNCONFIGURED` | §F.8 720 mencantumkan `OFFLINE` di filter query |
| D-5 | Nasib register manual legacy `POST /devices` | Dipertahankan berlabel legacy di UI | §E: "legacy/deprecated — dipertahankan untuk masa transisi" |
| D-6 | Otorisasi cancel WO | ADMIN LAN only | §C.6 (spesifikasi endpoint mengalahkan tabel ringkas §7H) |
| D-7 | Mutasi operators | ADMIN/SUPERVISOR (kecuali PUT — lihat R-17) | Tiga item endpoint sepakat (§H.3, §H.6, §H.7); **nuansa E21: §H.4:940 menulis PUT `/operators/:id` "ADMIN LAN only"** — D-7 ditinjau ulang untuk PUT (R-17) |
| D-8 | `oeePct` saat `performancePct` null | `null` (unknown, bukan 0) | §K 1163, 1194 — aturan null dokumen |
| D-9 | Kode 404 mesin tanpa device | `MACHINE_NOT_BOUND` | §Q intro — kode spesifik lebih berguna |
| D-10 | PUT /policies: `resource_pattern` atau `resourcePattern` | Hanya camelCase | §3.4: "tidak ada alias snake_case" |
| D-11 | §M yang masih mendokumentasikan `/clients/provision` | Panel abaikan §M, ikuti §E.3a; minta backend bersihkan §M (R-9) | §E.3a (spec 015, ADR-009) + kalimat §M sendiri |
| D-12 | Parameter tak dikenal di endpoint selain `/system/audit` | Hanya kirim parameter terdaftar | Paling aman tanpa konfirmasi backend (R-10) |
| D-13 | Pemetaan guard ekspor | `audit/export` → `access_control.read`; `op-events/export` → `telemetry.refresh` | §I 1079–1087 — guard per endpoint |
| D-14 | Nilai `must_change_password` terredaksi di salinan | Semantik jelas dari konteks kalimat (§L: "menandakan password sementara … yang wajib diganti") — implementasi jalan; salinan asli dirujuk bila tersedia | §L 1227, 1238, 1249 |

## 2. Perlu ditinjau kembali (backend)

Item di bawah **tidak** diputuskan dari dokumen saja — perlu jawaban backend sebelum
implementasi terkait dianggap final. Implementasi E20 berjalan mengikuti keputusan
§1; item ini ditandai agar tidak hilang.

> **Tambahan E21:** item tindak lanjut baru R-16–R-23 didefinisikan di
> `docs/BACKEND_SYNC_CLOSURE.md` §5.3 (acknowledgeUnvalidated, PUT operator,
> machine_id global, acknowledged di /system/audit, skema dynsec, skema
> info/audit, filter user-roles/policies, salinan api_docs baru).

| # | Item | Kontradiksi (diff) | Yang diminta ke backend | Dampak implementasi |
|---|---|---|---|---|
| R-1 | Daftar atribut ABAC | C11 — "whitelist 10 atribut" tanpa enumerasi; contoh `subject.line_id` ditolak validator panel | Daftar lengkap dari spec 032/024 | Validator ABAC panel ditandai sementara; jangan tebak |
| R-2 | Kanon `/auth/me` | C3/C7 — tiga versi bentuk; `effectiveRoles` dilarang di satu tempat, dipakai di tempat lain | Tetapkan satu bentuk kanon | Panel toleran sementara |
| R-3 | Cancel WO: ADMIN vs OPERATOR+ | C8 — §C.6 vs §7H | ~~Konfirmasi otorisasi cancel~~ **TERJAWAB 19 Nov 09:23 — `authorize("cancel", "work_order")` (ADMIN); D-6 terkonfirmasi** — **caveat E21: amandemen 09:23 tidak ada di salinan file (0 hit); penutupan definitif menunggu salinan api_docs baru (R-23)** | Gating tombol cancel |
| R-4 | Mutasi operators: ADMIN vs ADMIN/SUPERVISOR | C16 — header §H vs per-endpoint | Konfirmasi otorisasi mutasi | Gating create/update/status/password operator |
| R-5 | 404 mesin tanpa device | C9 — `MACHINE_NOT_BOUND` vs `NOT_FOUND` | Konfirmasi kode | Penanganan error UI |
| R-6 | `OFFLINE` nilai item | C12 — ada di filter query, tak ada di FSM kanonis | Konfirmasi `OFFLINE` nilai item sah | Normalisasi FSM di mapper |
| R-7 | `oeePct` saat Performance null | C14 — dokumen hanya tegaskan Performance → `null` | **TERJAWAB (E21)** — aturan null sudah tertulis §K:1163 + §K.3c:1194; D-8 didukung dokumen | Demo + mapper rollup |
| R-8 | PUT /policies casing | C4 — deskripsi PUT campur snake_case di tengah camelCase | Konfirmasi camelCase saja | Body tulis policy |
| R-9 | §M dibersihkan | C1/C5 — §M masih mendokumentasikan `/clients/provision` sebagai live | ~~Hapus provisioning dari §M~~ **SEBAGIAN TERJAWAB 19 Nov 09:23 — contoh cURL §M diperbaiki (`/clients/provision` → `/clients`); heading §M masih mendokumentasikan provisioning via `POST /clients {deviceId, access,...}` — minta backend bersihkan sisanya** — **caveat E21: amandemen 09:23 tidak ada di salinan file (baris 1340 masih `/clients/provision`); penutupan definitif menunggu salinan baru (R-23)** | Panel sudah ikuti §E.3a; §M adalah sisa lama |
| R-10 | Parameter tak dikenal di luar `/system/audit` | C17 — klausul abaikan hanya ditulis untuk `/system/audit` | Konfirmasi klausul abaikan berlaku global | Builder endpoint (panel kirim hanya parameter terdaftar) |
| R-11 | Guard ekspor | C18 — dua guard berbeda untuk dua ekspor hampir sama | Konfirmasi pemetaan guard per endpoint | Kunci capability ekspor |
| R-12 | Tabel error §2 tidak lengkap | C19 — `ROLE_IMMUTABLE`, `PASSWORD_ROTATION_REQUIRED`, `WEAK_PASSWORD`, `AUTHZ_STALE`, `MQTT_*` tidak ada di tabel | Lengkapi tabel §2 | Panel meneruskan kode generik sementara |
| R-13 | Mutasi 204 | C2 — §6B "tidak ada mutasi memakai 204" vs tabel §M 7× DELETE → 204 | Bersihkan §6B atau tabel §M | Panel sudah tangani 204 dengan benar |
| R-14 | Nama field password sekali-tampil `POST /clients` | B34 — dokumen tidak menamai field | Namai field respons | Panel baca defensif (`generatedPassword ?? password`); minor |
| R-15 | `isOnline` tak terverifikasi klien | C13 — proyeksi TTL, tapi `DeviceResponse` tak bawa `lastSeenAt` yang dapat diverifikasi | **TERJAWAB (E21) — premis salah: `DeviceResponse` membawa `lastSeenAt` (§E:~412); klien dapat memverifikasi proyeksi TTL; verifikasi saat Real E2E** | Klien terima `isOnline` jadi; minor |

## 3. Sudah terjawab oleh api_docs baru (bukan lagi terbuka)

Pertanyaan terbuka dari gaps doc (E18) yang kini dijawab api_docs terupdate:

| Item lama | Jawaban di api_docs |
|---|---|
| Tipe `operator.role` untuk label custom | String bebas, default `UNASSIGNED`; daftar otoritatif di `GET /access-control/roles` (§H) |
| Satuan `uptime` | Detik (float) (§A) |
| Overlap jadwal lintas tengah malam | `409 SHIFT_TIME_OVERLAP` + detail `{shiftId, lineId, dayOfWeek, conflictShiftId}` (§P) |
| Konfirmasi backend K-01 | `{current_password, new_password}`; `old_password` → `400 VALIDATION_ERROR` (§L) |
| Konfirmasi backend K-02 | Nested `{operator, authz}` (§L) — dengan catatan R-2 (varian §3.4) |
| Konfirmasi backend K-12 | Setiap mutasi → `bump authz_version` (§3.4) |
| K-15 (Fase 8) | `availabilityPct = run / (run + unplanned)` — planned downtime tidak menurunkan Availability (§K, ADR-019) |
| Daftar enum `event_type` | 32 nilai eksplisit + pola `COMMAND_<cmd>_DISPATCHED`, `MQTT_ADMIN_<op>`, `DEVICE_EVENT_<n>` (§I) |
| B1 skema policy | Bentuk kanonis camelCase §3.4 |
| B3 contoh ABAC | Satu contoh (`subject.line_id`); whitelist lengkap masih R-1 |
| B4 alur paksa | Gate spec 043: flag + `403 PASSWORD_ROTATION_REQUIRED` (§L) |
| B6 skema IAM | Bentuk baca §3.4 (`GET /roles`, `/permissions`, `/policies`, `/user-roles`, `/subjects/:id/effective-permissions`) |
| B7 hapus role | `409 ROLE_IN_USE` (§3.4) |
| B16 lockout | 5/60s + `Retry-After`; panel tanpa lockout paralel (§L) |
| Fase 8 (F-2 from/to; F-7/G8; G25 FSM; default 72/500) | from/to dihormati (§K.2); ADR-019 (§K); FSM 6 nilai (§6A); hourly limit default 72 (§Q.2), rollup default 500 (§K.3c) |
| R-3 otorisasi cancel WO (pembaruan 09:23) | `authorize("cancel", "work_order")` (ADMIN) — D-6 terkonfirmasi |
| R-9 §M (pembaruan 09:23, sebagian) | Contoh cURL provisioning §M diperbaiki (`/clients/provision` → `/clients`); heading §M masih usang — sisa di R-9 |
| Endpoint baru (pembaruan 09:23) | `GET /api/v1/system/access-mode` → `{mode, channel, mutations_allowed}` — masuk cakupan Batch 4 (P20.5); A10.2 keseluruhan belum terbuka |

## 4. Arsip gaps lama

`docs/BACKEND_GAPS_SYSTEM_ADMIN.md` → `docs/archive/BACKEND_GAPS_SYSTEM_ADMIN.md`
(diarsipkan 2026-11-19, E20/P20.7). Alasan: seluruh 50 gap sudah tertutup
keputusannya (E19, tabel status 50/50) dan api_docs baru kini sumber kebenaran;
dokumen gaps dipertahankan sebagai **riwayat** keputusan backend 18 Nov 2026 +
delegasi E18. Dokumen kerja aktif penggantinya: `docs/API_SYNC_DIFF.md` (diff
panel vs api_docs) + dokumen ini (tinjau-ulang).
