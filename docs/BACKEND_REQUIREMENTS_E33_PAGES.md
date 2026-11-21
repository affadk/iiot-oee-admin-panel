# Spesifikasi Kebutuhan Backend — Opsi 3: Tiga Halaman (Alarm, Audit, IAM)

**Tanggal:** 2026-11-21
**Tujuan:** backend menyesuaikan mengikuti admin-panel. Panel sudah selesai
tahap A–C analisis halaman Opsi 3 (Push #20, `7c53435`, terverifikasi live
2026-11-21) — tiga halaman kini tampil terpisah (Alarm & Event, Audit Trail,
Audit IAM) — tetapi data di baliknya **belum** terpisah: masih satu tabel
`operational_events`, satu enum 32 nilai, dan `/system/audit` masih alias.
Dokumen ini adalah kontrak yang diminta panel dari backend, dengan bentuk /
payload data yang persis. Tiap bagian memakai pola yang sama: **keadaan
sekarang → yang diminta → payload → kriteria selesai → tiket Linear**.

**Rujukan:**
- Analisis awal: `~/workspace/audit-vs-operational-events-analysis.md`
  (2026-11-20) — masalah, keputusan, tiga opsi; Fathur memilih Opsi 3.
- Analisis halaman: `~/workspace/analisis-halaman-opsi-3.md` (2026-11-21) —
  3 halaman, fitur tiap halaman, tahap A–C (panel, selesai) dan D–I (backend).
- Panel live: https://iiot-oee-admin-panel.vercel.app
  (deploy `7c53435`); API live: https://oee.fadik.web.id/api/v1;
  OpenAPI live yang dipakai sebagai rujukan: salinan 2026-11-20
  (`~/workspace/oee-live-openapi-2026-11-20b.json`, 141 operasi).
- Epic: E33 (FAT-290). Tiket backend yang sudah ada: B33.1 FAT-295, B33.2
  FAT-296, B33.3 FAT-297, B33.4 FAT-298, D33.1 FAT-299. **Baru di dokumen
  ini: B33.5 FAT-303** (cacat live + paging IAM audit).

**Konvensi yang dipakai di seluruh dokumen:**
- Field memakai **camelCase** sebagai bentuk kanonik (sesuai Spec 042 §3.4;
  panel menerima camelCase dan snake_case lewat `pick`, tapi kontrak
  tertulis di sini adalah camelCase).
- Semua waktu adalah **string ISO-8601** dengan zona waktu, waktu server
  (contoh: `"2026-11-21T03:33:00.000Z"`). **Jangan kirim epoch numerik**
  (angka) dan jangan kirim string kosong — lihat §5 kenapa ini penting.
- Paginasi cursor mengikuti bentuk yang sudah dipakai
  `GET /operational-events` (lihat §6).
- OpenAPI live **wajib diperbarui** untuk setiap perubahan di dokumen ini —
  panel memverifikasi kontrak terhadap OpenAPI live, bukan terhadap janji.

---

## §0 — Ringkasan perubahan

| # | Endpoint | Perubahan | Tiket |
|---|---|---|---|
| 1 | `GET /operational-events` | Param `category=system\|operational` + field `category` per baris + field `alarmState` per baris + param `alarmState` + `meta.totalCount` adalah **total asli** + `meta.counts` | FAT-295, FAT-298 |
| 2 | `GET /system/audit` | Param `category` + jawab R-18/R-19; tetap alias sampai P33.4, lalu deprecated | FAT-295 |
| 3 | `GET /system/audit-trail` | **Endpoint baru** — store audit append-only (record §2) | FAT-296 |
| 4 | `PATCH /operational-events/{id}/ack` | Selain mengubah state ack, **tulis satu entri audit baru** (§3); sertakan entrinya di respons | FAT-297 |
| 5 | `GET /access-control/audit` | Field `timestamp` ISO wajib per baris + paging cursor + skema respons di OpenAPI | FAT-303 (baru) |

**Urutan yang disarankan:** §5 dulu (cacat yang terlihat live hari ini) →
§1 → §2 → §3 → §4. §1–§4 bisa dikerjakan berurutan; §5 independen dan
bisa jalan paralel.

---

## §1 — B33.1: Kategori event + jawab R-18/R-19 (FAT-295)

### Keadaan sekarang
- Satu enum tertutup 32 nilai (`eventType`, FR-034-26/27, api_docs §I)
  yang tercampur tiga keluarga (lihat tabel di bawah).
- `GET /system/audit` didefinisikan api_docs §I sebagai **alias** feed
  operasional — bukan store sendiri.
- Divergensi OpenAPI live vs dokumen (masih terbuka sejak 18 Nov):
  **R-18** — apakah tidak adanya `machine_id` di
  `GET /operational-events` global itu disengaja? OpenAPI live justru
  MENERIMA `machine_id`/`machineId` di endpoint itu.
  **R-19** — apakah filter `acknowledged` didukung di `/system/audit`?
  OpenAPI live TIDAK menerima `acknowledged` di `/system/audit`, tapi
  MENERIMA di `/operational-events`.
- Panel hari ini mengirim ke `GET /operational-events`:
  `device_id?, event_type?, acknowledged?: boolean, from?, to?, limit?, cursor?`
  dan ke `GET /system/audit`: `from?, to?, event_type?, machine_id?, limit?, cursor?`.

### Yang diminta
1. **Jawab R-18 dan R-19 secara tertulis** (di tiket + di OpenAPI):
   tentukan mana yang benar, lalu samakan dokumen, OpenAPI live, dan
   perilaku server. Bila `machine_id` di global memang disengaja tidak
   didukung, server harus menolaknya dengan 400 (bukan diam-diam
   mengabaikan). Bila `acknowledged` di `/system/audit` memang tidak
   didukung, nyatakan dan panel tidak akan memakainya.
2. **Param `category`** di kedua endpoint: `category=system|operational`
   (opsional; tanpa param = semua, seperti sekarang).
3. **Field `category` di tiap record** respons (`"system"` atau
   `"operational"`) — supaya panel bisa menampilkan dan menyaring kategori
   secara konsisten tanpa menebak dari `eventType`.
4. **Pembagian keluarga** (final, dari enum kanonik 32 nilai + 3 pola):

   | Kategori | `eventType` |
   |---|---|
   | `operational` (15: 14 eksplisit + 1 pola) | `DEVICE_CREDENTIAL_ROTATED`, `DEVICE_CREDENTIAL_ROTATION_REFUSED`, `DEVICE_OFFLINE`, `DEVICE_ONLINE`, `DEVICE_PROVISIONED`, `DEVICE_REVOKED`, `MACHINE_BOUND`, `MACHINE_UNBOUND`, `WO_DISPATCH_ACK_ERROR`, `WO_DISPATCH_ACK_SUCCESS`, `WO_DISPATCH_INITIATED`, `WO_DISPATCH_TIMEOUT_UNACKNOWLEDGED`, `WORK_ORDER_CANCELLED`, `WORK_ORDER_COMPLETED`, `DEVICE_EVENT_<n>` |
   | `system` (17 eksplisit + 2 pola) | `AUTH_TOKEN_REFRESHED`, `MASTER_DATA_MUTATION`, `MOSQUITTO_CONFIG_APPLIED`, `MOSQUITTO_CONFIG_APPLY_FAILED`, `MOSQUITTO_CONFIG_DISCARDED`, `MOSQUITTO_CONFIG_RECOVERY_FAILED`, `MOSQUITTO_CONFIG_RESTAGED`, `MOSQUITTO_CONFIG_ROLLBACK_FAILED`, `MOSQUITTO_CONFIG_ROLLED_BACK`, `MOSQUITTO_CONFIG_STAGED`, `OPERATOR_DELETED`, `OPERATOR_PASSWORD_ROTATED`, `OPERATOR_PROVISIONED`, `OPERATOR_STATUS_CHANGED`, `OPERATOR_UPDATED`, `PRODUCT_DELETED`, `SECURITY_REJECTION`, `COMMAND_<PAUSE\|RESUME\|RESET_COUNTER\|PLANNED_DT_START\|PLANNED_DT_END\|COUNT_ADJUST>_DISPATCHED`, `MQTT_ADMIN_<op>` |
   | — (masuk `system`) | `OPERATIONAL_EVENT_ACKNOWLEDGED` — entri ack adalah aksi manusia terhadap sistem, jadi ia keluarga `system` dan masuk arsip audit (§2), BUKAN keluarga operasional. |

   Total eksplisit: 14 + 17 + 1 = 32 — cocok dengan enum kanonik.
   Bila backend menambahkan `eventType` baru kelak, ia **wajib** masuk
   salah satu kategori di atas (tidak ada `eventType` tanpa kategori).

### Payload
```http
GET /api/v1/operational-events?category=operational&acknowledged=false&limit=50
GET /api/v1/system/audit?category=system&from=2026-11-14T00:00:00.000Z&to=2026-11-21T00:00:00.000Z&limit=50
```

Satu baris respons (field yang sudah ada hari ini ditambah `category` —
field lain tidak berubah):

```json
{
  "id": 1148,
  "recordedAt": "2026-11-20T09:53:00.000Z",
  "deviceId": "STM32-OEE-SIM",
  "machineId": "MILLING-5-AXIS-SIM",
  "woId": null,
  "eventType": "DEVICE_OFFLINE",
  "category": "operational",
  "triggerSource": null,
  "eventCode": null,
  "snapshotTotalCount": null,
  "snapshotRunSec": null,
  "description": "Perangkat STM32-OEE-SIM offline",
  "createdAt": "2026-11-20T09:53:00.000Z",
  "acknowledged": false,
  "machineName": "Milling 5-Axis CNC (Simulation)",
  "acknowledgedAt": null,
  "acknowledgedBy": null,
  "ackNote": null
}
```

### Kriteria selesai
- [ ] R-18 dan R-19 dijawab tertulis di FAT-295; OpenAPI live dan perilaku
  server konsisten dengan jawaban itu.
- [ ] `category` bekerja di kedua endpoint (filter benar; salah satu dari
  32 nilai + 3 pola tidak pernah lolos tanpa kategori).
- [ ] Tiap baris membawa `category` yang benar menurut tabel di atas.
- [ ] Panel memverifikasi live: filter kategori di halaman Alarm & Event
  dan Audit Trail menampilkan keluarga yang benar.

---

## §2 — B33.2: Audit trail store terpisah, append-only (FAT-296)

### Keadaan sekarang
- Tidak ada store audit. `/system/audit` membaca tabel
  `operational_events` yang sama dengan daftar kerja. Baris audit bisa
  berubah (kolom ack) — melanggar 21 CFR Part 11 §11.10(e) / ALCOA+.
- Panel sudah menyiapkan tampilan arsipnya (AuditTrailPage tanpa kolom
  ack, subjudul jujur — P33.1) tetapi tampilannya masih membaca alias.

### Yang diminta
1. **Store baru yang terpisah secara fisik** dari `operational_events`
   (tabel/layanan sendiri). Setiap mutasi sistem dan setiap aksi manusia
   terhadap sistem menulis satu baris ke sini — bukan ke feed operasional.
2. **Endpoint baru** `GET /api/v1/system/audit-trail` (gerbang sama
   dengan `/system/audit` hari ini: ADMIN + LAN). Panel P33.4 (FAT-294)
   akan memindahkan AuditTrailPage ke endpoint ini.
3. **Append-only, tanpa pengecualian:** TIDAK ADA route
   PUT/PATCH/DELETE ke store ini — bahkan admin hanya boleh baca.
   Mengedit data tidak boleh mengedit riwayatnya.
4. **Waktu dari server** (bukan jam operator) dan **nomor urut `seq`**
   yang monoton tanpa celah — ini penanda integritas arsip. Bila suatu
   hari dipakai rantai hash (`prevHash`/`hash`), `seq` tetap ada sebagai
   penanda urut yang bisa diperiksa panel.
5. **Retensi dinyatakan tertulis** di tiket (berapa lama entri disimpan,
   apa yang terjadi setelahnya) — panel menampilkan catatan retensi itu
   bila backend menyediakannya di respons (`meta.retentionDays` — opsional).

### Payload — record audit trail
```json
{
  "id": "aud-20261121-000123",
  "seq": 123,
  "recordedAt": "2026-11-21T03:33:00.000Z",
  "actor": "ADM-001",
  "actorRole": "ADMIN",
  "action": "OPERATOR_PROVISIONED",
  "category": "system",
  "entityType": "operator",
  "entityId": "OPR-1001",
  "entityLabel": "Operator 1001",
  "oldValue": null,
  "newValue": { "operatorId": "OPR-1001", "role": "OPERATOR" },
  "reason": "Penambahan operator shift pagi",
  "source": "panel",
  "prevHash": "9f2c…",
  "hash": "a41d…"
}
```
Keterangan field:
- `id` — string unik stabil (boleh UUID / nomor urut berformat).
- `seq` — integer monoton naik, tanpa celah, dimulai dari 1. Wajib.
- `recordedAt` — string ISO-8601, waktu server saat kejadian. Wajib.
- `actor` — `operator_id` pelaku, atau `"system"` bila aksi otomatis
  sistem (mis. token refresh oleh sistem tetap tercatat dengan
  `actor: "system"`).
- `action` — `eventType` yang sama dengan enum §1 (keluarga `system`),
  supaya panel bisa memakai satu daftar aksi.
- `entityType` / `entityId` / `entityLabel` — objek yang diubah
  (`operator` / `device` / `machine` / `work-order` / `config` / …).
- `oldValue` / `newValue` — JSON bebas (objek/skalar/null). `oldValue:
  null` = pembuatan baru; `newValue: null` = penghapusan. **Wajib ada
  keduanya** (null eksplisit, bukan field hilang) — ini inti
  "old→new" audit trail.
- `reason` — string, boleh null bila aksi tidak meminta alasan (panel
  menampilkan "—").
- `source` — dari mana aksi dicatat (`"panel"` / `"hmi"` / `"api"` /
  `"system"`).
- `prevHash` / `hash` — rantai integritas; bila belum diimplementasi,
  kirim `null` eksplisit (jangan hilangkan field) dan nyatakan di tiket.

### Payload — query + respons
```http
GET /api/v1/system/audit-trail?actor=ADM-001&category=system&entityId=OPR-1001&from=2026-11-14T00:00:00.000Z&to=2026-11-21T00:00:00.000Z&limit=50&cursor=…
```
```json
{
  "data": [ { "…record seperti di atas…" } ],
  "pagination": {
    "limit": 50,
    "nextCursor": "…",
    "hasMore": true,
    "truncated": true,
    "totalCount": 1284
  }
}
```
`totalCount` di sini adalah **total asli** baris yang cocok dengan filter
(bukan panjang halaman) — lihat §6.

### Kriteria selesai
- [ ] Store terpisah live; `GET /system/audit-trail` mengembalikan record
  sesuai bentuk di atas (termasuk `seq` tanpa celah dan `oldValue` /
  `newValue` eksplisit).
- [ ] Tidak ada route update/delete ke store ini (panel memverifikasi
  dengan mencoba — harus 404/405, bukan 200).
- [ ] Semua mutasi sistem yang sudah ada (provision operator, perubahan
  master data, konfigurasi MQTT, dsb.) menulis ke store baru ini sejak
  deploy — bukan hanya mutasi baru setelahnya.
- [ ] OpenAPI live mendokumentasikan endpoint + skema responsnya.
- [ ] `/system/audit` lama tetap hidup sebagai alias sampai P33.4
  selesai — penghapusannya diputuskan setelah itu (jangan putuskan
  sebelum panel pindah).

---

## §3 — B33.3: Ack menulis entri audit baru, tanpa memutasi baris audit (FAT-297)

### Keadaan sekarang
- `PATCH /operational-events/{id}/ack` (body `{operatorId | operator_id,
  note}`) mengubah state ack event operasional — dan ack itu sendiri
  sudah tercatat sebagai event `OPERATIONAL_EVENT_ACKNOWLEDGED` di feed
  yang sama. Yang belum: tidak ada entri di **arsip audit** (§2) yang
  mencatat ack tersebut sebagai jejak tersendiri.

### Yang diminta
1. Setiap ack yang berhasil **wajib** menulis SATU entri baru ke store
   audit §2 (tidak pernah mengubah baris audit yang sudah ada):
   - `action`: `"OPERATIONAL_EVENT_ACKNOWLEDGED"`
   - `entityType`: `"operational-event"`, `entityId`: id event yang di-ack
     (string), `entityLabel`: ringkasan event (mis. `"DEVICE_OFFLINE /
     STM32-OEE-SIM"`)
   - `oldValue`: `{ "acknowledged": false }`
   - `newValue`: `{ "acknowledged": true, "acknowledgedBy": "<operator_id>", "acknowledgedAt": "<ISO>", "note": "<note atau null>" }`
   - `actor`: operator yang melakukan ack; `reason`: `note` yang sama
     (atau null bila tanpa catatan).
2. Respons ack menyertakan entri audit yang baru dibuat, supaya panel
   bisa menautkan keduanya tanpa query kedua.

### Payload — respons ack
```http
PATCH /api/v1/operational-events/1148/ack
Content-Type: application/json

{ "operatorId": "ADM-001", "note": "Dilihat — mesin sudah kembali online" }
```
```json
{
  "id": 1148,
  "recordedAt": "2026-11-20T09:53:00.000Z",
  "eventType": "DEVICE_OFFLINE",
  "category": "operational",
  "acknowledged": true,
  "acknowledgedBy": "ADM-001",
  "acknowledgedAt": "2026-11-21T03:40:00.000Z",
  "ackNote": "Dilihat — mesin sudah kembali online",
  "auditEntry": {
    "id": "aud-20261121-000124",
    "seq": 124,
    "recordedAt": "2026-11-21T03:40:00.000Z",
    "actor": "ADM-001",
    "action": "OPERATIONAL_EVENT_ACKNOWLEDGED",
    "entityType": "operational-event",
    "entityId": "1148",
    "oldValue": { "acknowledged": false },
    "newValue": {
      "acknowledged": true,
      "acknowledgedBy": "ADM-001",
      "acknowledgedAt": "2026-11-21T03:40:00.000Z",
      "note": "Dilihat — mesin sudah kembali online"
    },
    "reason": "Dilihat — mesin sudah kembali online"
  }
}
```
Catatan: field lain event (`deviceId`, `machineId`, …) tetap seperti §1.

### Kriteria selesai
- [ ] Setiap ack live menghasilkan tepat satu entri audit baru
  (`seq` naik 1); ack yang sama diulang (idempoten) TIDAK menulis entri
  ganda.
- [ ] Respons ack menyertakan `auditEntry` sesuai bentuk di atas.
- [ ] Entri ack bisa ditemukan di `GET /system/audit-trail` dengan filter
  `action=OPERATIONAL_EVENT_ACKNOWLEDGED` atau `entityId=<id event>`.
- [ ] Tidak ada jalur yang mengubah baris audit yang sudah ada.

---

## §4 — B33.4: State `rtn-unacknowledged` dari server + hitungan total (FAT-298)

### Keadaan sekarang (bukti live)
- Panel menurunkan state ini sendiri (`eventAckState.ts`, P33.2):
  event yang sudah di-ack → `acked`; `DEVICE_OFFLINE` yang belum di-ack
  dan diikuti `DEVICE_ONLINE` untuk `device_id` yang sama dengan
  `recorded_at` yang LEBIH BARU → `rtn-unack`; selainnya
  `active-unack`. Derivasi ini **best-effort dalam halaman yang dimuat**:
  bila ONLINE-nya ada di halaman lain atau di luar filter, hasilnya
  tetap `active-unack`. Terverifikasi live 2026-11-21: pasangan
  OFFLINE 20 Nov 16.53 → ONLINE 16.54 (STM32-OEE-SIM) menampilkan badge
  "Clear — belum di-ack"; OFFLINE 17.21 tetap "Belum Ack" karena ONLINE
  lebih barunya ada di halaman 1.
- Hitungan tab juga best-effort: tidak ada query COUNT total di backend —
  `meta.count` / `total_count` hari ini adalah **panjang halaman**,
  bukan total dataset. Panel menampilkan jumlah tab sebagai batas bawah
  ("50+") dan mendokumentasikannya sebagai kejujuran angka.

### Yang diminta
1. **Field `alarmState` di tiap baris `operational-events`** (dan di
   `/system/audit` selama masih dipakai):
   `"active-unack" | "rtn-unack" | "acked"`.
   Aturan server (cermin persis aturan panel, tetapi dihitung dari **log
   lengkap server**, bukan dari halaman yang dimuat):
   - `acknowledged == true` → `"acked"`.
   - `acknowledged == false` dan `eventType == "DEVICE_OFFLINE"` dan
     ada `DEVICE_ONLINE` untuk `deviceId` yang sama dengan `recordedAt`
     yang LEBIH BARU (strict) → `"rtn-unack"`.
   - Selainnya → `"active-unack"`.
   - **Pertanyaan untuk backend (jawab di tiket):** apakah aturan
     "clear" di atas hanya berlaku untuk `DEVICE_OFFLINE`, atau ada tipe
     event lain yang juga punya pasangan clear? Bila ada, sebutkan
     pasangannya di tiket + OpenAPI. Panel hari ini hanya mengenal
     pasangan OFFLINE→ONLINE.
2. **Param filter `alarmState`** di `GET /operational-events`
   (`alarmState=active-unack|rtn-unack|acked`, bisa digabung dengan
   `acknowledged`/`category`/filter lain).
3. **Hitungan total yang asli:**
   - `pagination.totalCount` = **total baris yang cocok dengan filter**
     (bukan panjang halaman). Ini perbaikan atas perilaku hari ini —
     panel hari ini memakai fallback "panjang halaman" bila
     `totalCount` tidak ada.
   - `pagination.counts` (baru, opsional tapi diminta): ringkasan state
     untuk filter yang sama, supaya panel bisa menampilkan jumlah tab
     yang pasti tanpa query tambahan:
     ```json
     "pagination": {
       "limit": 50,
       "nextCursor": "…",
       "hasMore": true,
       "truncated": true,
       "totalCount": 1284,
       "counts": { "activeUnack": 37, "rtnUnack": 12, "acked": 1235 }
     }
     ```
     Bila `counts` tidak diimplementasi, `totalCount` yang asli saja
     sudah cukup untuk tab "Riwayat"; tab "Perlu Tindakan" tetap butuh
     satu query `acknowledged=false` untuk totalnya — nyatakan di tiket
     mana yang dipilih.

### Payload — baris dengan `alarmState`
```json
{
  "id": 1148,
  "recordedAt": "2026-11-20T09:53:00.000Z",
  "deviceId": "STM32-OEE-SIM",
  "eventType": "DEVICE_OFFLINE",
  "category": "operational",
  "alarmState": "rtn-unack",
  "acknowledged": false,
  "acknowledgedAt": null,
  "acknowledgedBy": null,
  "ackNote": null
}
```
```http
GET /api/v1/operational-events?alarmState=rtn-unack&limit=50
GET /api/v1/operational-events?acknowledged=false&limit=1
```

### Kriteria selesai
- [ ] `alarmState` ada di tiap baris dan stabil: nilainya sama di halaman
  berapapun dan filter apapun (tidak bergantung pada halaman yang dimuat).
- [ ] Pasangan OFFLINE 20 Nov 16.53 → ONLINE 16.54 (STM32-OEE-SIM)
  mengembalikan `alarmState: "rtn-unack"`; OFFLINE 17.21 yang ONLINE
  lebih barunya ada di halaman lain **tetap** `"rtn-unack"` (inilah
  perbaikan atas derivasi panel).
- [ ] `totalCount` adalah total asli; bila `counts` diimplementasi,
  jumlahnya cocok dengan filter yang sama.
- [ ] Panel memverifikasi live: badge "Clear — belum di-ack" tampil
  konsisten, dan jumlah tab tampil pasti (tanpa "+").

---

## §5 — B33.5 (BARU): Endpoint IAM audit — timestamp + paging (FAT-303)

### Keadaan sekarang — cacat yang terbukti live (2026-11-21, 10:33–10:35 WIB)
- Halaman baru Audit IAM (`/admin/iam-audit`, P33.6) tampil dengan benar:
  tabel, filter, pintasan "Hanya DENY" (4 baris DENY, OPR-1001), paginasi
  25/halaman, export CSV — semua berfungsi.
- **Tetapi semua sel Waktu menampilkan "01 Jan 1970, 07.00"** (epoch Unix)
  di semua baris dan semua halaman. Baris-baris juga nyaris identik
  (ADM-001, `ALLOW (shadow)`, action `read`/`read_raw`).
- Akar masalah (sudah dilacak ke kode, bukan tebakan): panel membaca waktu
  lewat mapper `mapIamAuditDecision` →
  `timestamp: iso(pick(r.timestamp, r.created_at, r.createdAt))`, dan
  helper `iso()` panel berbunyi:
  `iso(v) = (typeof v === 'string' && v ? v : new Date(0).toISOString())`.
  Artinya: bila backend **tidak mengirim** `timestamp`/`created_at`/
  `createdAt` sebagai **string ISO-8601 yang tidak kosong** — atau
  mengirimnya sebagai **angka** (epoch detik/ms) — panel jatuh ke
  `new Date(0)` = 1 Jan 1970. Jadi satu dari dua kemungkinan ini yang
  terjadi di backend: (a) field waktu tidak ada di respons, atau
  (b) ada tetapi berupa angka / nama lain.
- Fakta pendukung: skema respons `200` untuk
  `GET /api/v1/access-control/audit` di OpenAPI live **kosong** (`{}`) —
  kontrak responsnya tidak terdokumentasi sama sekali.
- Panel hari ini mengirim: `{limit: 100, subject?, decision?:
  ALLOW|DENY, mode?: shadow|enforce, from?, to?}` dan menerima array
  keputusan **tanpa envelope paginasi** — panel melakukan paginasi
  client-side (25 baris dari 100 yang dimuat). Itu limitasi yang
  didokumentasikan di P33.6, bukan cacat — tetapi paging server-side
  tetap diminta di bawah ini.

### Yang diminta
1. **Field `timestamp` wajib di tiap baris**, string ISO-8601 waktu
   server saat keputusan dibuat (contoh `"2026-11-21T03:33:00.000Z"`).
   Panel menerima `timestamp`, `created_at`, atau `createdAt` — salah
   satu cukup — tetapi **harus string ISO, bukan angka**. Bila backend
   hari ini menyimpan epoch numerik, konversikan ke ISO string di
   serialisasi respons (jangan ubah penyimpanan bila tidak perlu).
2. **Paging server-side:** param `cursor` + `limit` (pertahankan filter
   yang sudah ada: `subject`, `decision`, `mode`, `from`, `to`).
   Respons memakai envelope cursor yang sama dengan §6 (bukan array
   telanjang). `limit` default tetap 100 bila tidak dikirim.
3. **Dokumentasikan skema respons 200 di OpenAPI** (hari ini kosong).
4. **Jangan ubah arti field lain** — panel membaca: `id`/`auditId`,
   `subject`, `decision` (`ALLOW`/`DENY`), `mode` (`shadow`/`enforce`),
   `action`, `resource`, `reason`.

### Payload — request + respons
```http
GET /api/v1/access-control/audit?decision=DENY&limit=25&cursor=…
```
```json
{
  "data": [
    {
      "id": "iam-aud-9f31",
      "timestamp": "2026-11-21T03:33:12.000Z",
      "subject": "OPR-1001",
      "decision": "DENY",
      "mode": "shadow",
      "action": "read",
      "resource": "operator:*",
      "reason": "shadow:no matching policy for role(s) [OPERATOR] on operator:*"
    }
  ],
  "pagination": {
    "limit": 25,
    "nextCursor": "…",
    "hasMore": true,
    "truncated": true,
    "totalCount": 100
  }
}
```

### Kriteria selesai
- [ ] Semua baris membawa `timestamp` string ISO yang benar (bukan epoch,
  bukan null, bukan angka) — panel memverifikasi live: kolom Waktu
  menampilkan tanggal/jam keputusan yang sebenarnya, bukan 01 Jan 1970.
- [ ] Paging cursor bekerja (`cursor` + `limit`, `hasMore`/`nextCursor`
  benar); panel memindahkan paginasi ke server-side (tiket panel
  follow-up setelah ini live — panel akan menghapus paginasi client-side).
- [ ] Skema respons 200 terdokumentasi di OpenAPI live.
- [ ] Filter yang sudah ada (`subject`/`decision`/`mode`/`from`/`to`)
  tetap bekerja seperti sekarang.

---

## §6 — Kontrak umum (berlaku untuk semua bagian)

- **Waktu:** string ISO-8601, waktu server. Tidak ada epoch numerik, tidak
  ada string kosong, tidak ada field waktu yang hilang (kirim null
  eksplisit hanya bila kejadiannya memang tanpa waktu — dan jelaskan di
  tiket bila ada field seperti itu).
- **Paginasi cursor** (bentuk yang sudah dipakai `GET /operational-events`):
  ```json
  "pagination": { "limit": 50, "nextCursor": "…", "hasMore": true, "truncated": true, "totalCount": 1284 }
  ```
  `totalCount` = total baris yang cocok dengan filter (bukan panjang
  halaman). `hasMore`/`nextCursor` konsisten dengan `totalCount`.
- **Envelope error** tidak berubah (`{error, message, issues?}`).
- **Gerbang:** endpoint audit baru (§2) memakai gerbang yang sama dengan
  `/system/audit` hari ini (ADMIN + LAN). Endpoint lain mempertahankan
  gerbangnya masing-masing.
- **OpenAPI:** setiap perubahan di dokumen ini wajib tercermin di OpenAPI
  live (`https://oee.fadik.web.id/docs/openapi.json`) sebelum panel
  menyatakan selesai — panel memverifikasi kontrak terhadap OpenAPI live.
- **Kompatibilitas selama transisi:** jangan memutus panel yang sudah live.
  Field baru bersifat aditif (panel lama mengabaikannya); endpoint baru
  (§2) tidak menggantikan endpoint lama sampai P33.4 selesai dan
  diumumkan di tiket.

---

## §7 — Cara panel memverifikasi (untuk backend: yang akan dicek)

1. **B33.5 (§5):** buka `/admin/iam-audit` sebagai ADM-001 — kolom Waktu
   menampilkan tanggal/jam sebenarnya; paging next/prev bekerja;
   "Hanya DENY" tetap menyaring 4 baris.
2. **B33.1 (§1):** filter `category` di kedua endpoint mengembalikan
   keluarga yang benar; tiap baris membawa `category`.
3. **B33.2 (§2):** `GET /system/audit-trail` mengembalikan record dengan
   `seq` tanpa celah + `oldValue`/`newValue`; percobaan update/delete
   mengembalikan 404/405.
4. **B33.3 (§3):** ack satu event dari panel → `auditEntry` ada di
   respons dan bisa ditemukan di `/system/audit-trail`.
5. **B33.4 (§4):** pasangan OFFLINE 16.53 → ONLINE 16.54 menampilkan
   `alarmState: "rtn-unack"` dari server; jumlah tab tampil pasti
   (tanpa "+").

---

## §8 — Daftar tugas backend (ringkas, untuk diserahkan)

| Urutan | Tugas | Tiket | Bukti selesai |
|---|---|---|---|
| 1 | IAM audit: `timestamp` ISO + paging cursor + skema OpenAPI | **FAT-303** (baru) | §5 |
| 2 | Kategori event + jawab R-18/R-19 | FAT-295 | §1 |
| 3 | Store audit append-only + `GET /system/audit-trail` | FAT-296 | §2 |
| 4 | Ack menulis entri audit baru | FAT-297 | §3 |
| 5 | `alarmState` server-side + `totalCount` asli (+ `counts`) | FAT-298 | §4 |
| 6 | (Panel) P33.4 konsumsi kontrak baru | FAT-294 | Setelah §1 + §2 live |
| 7 | (Dokumen) D33.1 ADR + kriteria selesai Opsi 3 | FAT-299 | Setelah §1–§5 live |
